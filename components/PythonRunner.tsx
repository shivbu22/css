'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildHtmlDocument } from '@/lib/core/preview';
import {
  PYODIDE_BUNDLED,
  analyzePython,
  importedModules,
  pyodidePackagesFor,
  type PythonAnalysis,
} from '@/lib/core/pyodideSafe';
import { errorMessage } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { Button, Chip, Icons, Spinner } from './ui';

/**
 * Python that runs in the tab.
 *
 * Pyodide is loaded on demand from a CDN (no 10 MB dependency in the bundle) and
 * cached by the browser after the first run. Generated code is untrusted, so the
 * safest surface available is used: a browser sandbox with no filesystem and no
 * network, plus a pre-flight check that flags desktop and network imports instead
 * of letting them fail obscurely.
 */
const PYODIDE_URL =
  process.env.NEXT_PUBLIC_PYODIDE_URL || 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs';
const PYODIDE_FALLBACK_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/pyodide.mjs';

interface PythonReport {
  images: string[];
  html: string | null;
}

interface PyodideRuntime {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  /** Required for numpy/matplotlib/pandas — bundled with Pyodide, not preinstalled. */
  loadPackage?: (names: string | string[]) => Promise<void>;
  setStdout: (options: { batched: (text: string) => void }) => void;
  setStderr?: (options: { batched: (text: string) => void }) => void;
}

/** Runs after the user's script: collects figures and any FuncAnimation. */
const SNAPSHOT = `
import io as _io, base64 as _base64
_report = {"images": [], "html": None}
try:
    import matplotlib.pyplot as _plt
    for _num in _plt.get_fignums():
        _buf = _io.BytesIO()
        _plt.figure(_num).savefig(_buf, format="png", dpi=110, bbox_inches="tight")
        _report["images"].append(_base64.b64encode(_buf.getvalue()).decode("ascii"))
    _plt.close("all")
    try:
        from matplotlib.animation import FuncAnimation as _FuncAnimation
        for _name, _value in list(globals().items()):
            if isinstance(_value, _FuncAnimation):
                _report["html"] = _value.to_jshtml()
                break
    except Exception:
        pass
except Exception:
    pass
_report
`;

let runtimePromise: Promise<PyodideRuntime> | null = null;

async function loadRuntime(): Promise<PyodideRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const attempt = async (url: string) => {
        const sdk = (await import(/* webpackIgnore: true */ url)) as {
          loadPyodide: (options: { indexURL: string }) => Promise<PyodideRuntime>;
        };
        return sdk.loadPyodide({ indexURL: url.slice(0, url.lastIndexOf('/') + 1) });
      };
      try {
        return await attempt(PYODIDE_URL);
      } catch (error) {
        if (PYODIDE_URL === PYODIDE_FALLBACK_URL) throw error;
        return attempt(PYODIDE_FALLBACK_URL);
      }
    })();

    runtimePromise.catch(() => {
      runtimePromise = null; // let the next attempt retry cleanly
    });
  }
  return runtimePromise;
}

/**
 * `loadPackage` can resolve without installing anything (a blocked or 404'd
 * wheel is not always fatal), so every requested module is verified before the
 * user's script runs.
 */
async function missingModules(runtime: PyodideRuntime, modules: string[]): Promise<string[]> {
  if (!modules.length) return [];
  const result = await runtime.runPythonAsync(
    `import importlib.util as _quintet_util\n[_n for _n in ${JSON.stringify(modules)} if _quintet_util.find_spec(_n) is None]`,
  );
  const proxy = result as { toJs?: () => unknown; destroy?: () => void } | null;
  const value = proxy && typeof proxy.toJs === 'function' ? proxy.toJs() : result;
  proxy?.destroy?.();
  return Array.isArray(value) ? value.map(String) : [];
}

function VerdictChip({ analysis }: { analysis: PythonAnalysis }) {
  const tone = {
    safe: 'ok',
    unverified: 'warn',
    unsupported: 'err',
  }[analysis.verdict] as 'ok' | 'warn' | 'err';

  return <Chip tone={tone}>{analysis.headline}</Chip>;
}

export function PythonRunner({ code, className }: { code: string; className?: string }) {
  const analysis = useMemo(() => analyzePython(code), [code]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'done' | 'error'>('idle');
  const [stdout, setStdout] = useState<string[]>([]);
  const [report, setReport] = useState<PythonReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forced, setForced] = useState(false);
  const consoleRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    setStatus('idle');
    setStdout([]);
    setReport(null);
    setError(null);
    setForced(false);
  }, [code]);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [stdout]);

  const append = useCallback((text: string) => {
    const lines = text.replace(/\n$/, '').split('\n');
    setStdout((previous) => [...previous, ...lines]);
  }, []);

  const run = useCallback(async () => {
    setStatus('loading');
    setStdout([]);
    setReport(null);
    setError(null);

    try {
      const runtime = await loadRuntime();
      runtime.setStdout({ batched: append });
      runtime.setStderr?.({ batched: append });

      setStatus('running');

      // Explicit load first: loadPackagesFromImports alone does not install the
      // big bundled packages (matplotlib, pandas, scipy) in current Pyodide.
      const modules = importedModules(code);
      const bundled = modules.filter((name) => pyodidePackagesFor([name]).length > 0);
      const packages = pyodidePackagesFor(bundled);

      if (packages.length) {
        append(`[quintet] loading ${packages.join(', ')}…`);
        if (typeof runtime.loadPackage === 'function') {
          await runtime.loadPackage(packages);
        }

        const missing = await missingModules(runtime, bundled);
        if (missing.length) {
          const pipNames = missing.map((name) => PYODIDE_BUNDLED[name]).filter(Boolean);
          append(`[quintet] ${missing.join(', ')} missing after loadPackage — trying micropip`);
          try {
            await runtime.runPythonAsync(
              `import micropip\nawait micropip.install(${JSON.stringify(pipNames)})`,
            );
          } catch (installError) {
            append(`[quintet] micropip could not install: ${errorMessage(installError)}`);
          }
        } else {
          append('[quintet] packages ready');
        }
      }

      try {
        await runtime.loadPackagesFromImports(code);
      } catch {
        /* anything still missing surfaces as a normal Python error below */
      }

      await runtime.runPythonAsync(code);

      const raw = await runtime.runPythonAsync(SNAPSHOT);
      const proxy = raw as { toJs?: () => PythonReport; destroy?: () => void } | null;
      const data = typeof proxy?.toJs === 'function' ? proxy.toJs() : (raw as PythonReport);
      proxy?.destroy?.();

      setReport({ images: data?.images ?? [], html: data?.html ?? null });
      setStatus('done');
    } catch (cause) {
      setError(errorMessage(cause));
      setStatus('error');
    }
  }, [append, code]);

  const blocked = analysis.verdict === 'unsupported' && !forced;
  const busy = status === 'loading' || status === 'running';
  const hasOutput = Boolean(report?.html || report?.images.length);

  const statusLabel = {
    idle: 'not run',
    loading: 'loading runtime…',
    running: 'running…',
    done: 'finished',
    error: 'failed',
  }[status];

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted">animation.py</span>
          <VerdictChip analysis={analysis} />
          <span className="text-[11px] text-faint">{statusLabel}</span>
        </div>
        <Button
          variant="primary"
          onClick={run}
          disabled={!code || busy || blocked}
          icon={busy ? <Spinner /> : <Icons.play className="size-3.5" />}
        >
          Run in browser
        </Button>
      </div>

      {analysis.verdict !== 'safe' ? (
        <div
          className={cn(
            'space-y-2 border-b border-hair px-3 py-2 text-[11px]',
            analysis.verdict === 'unsupported' ? 'bg-err-tint text-err' : 'bg-warn-tint text-warn',
          )}
        >
          <p>
            <strong>{analysis.headline}.</strong> {analysis.detail}
          </p>
          {analysis.runLocally.length ? (
            <pre className="overflow-auto rounded-lg border border-hair bg-raised p-2 font-mono text-[11px] text-fg">
              {analysis.runLocally.join('\n')}
            </pre>
          ) : null}
          {analysis.verdict === 'unsupported' ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forced}
                onChange={(event) => setForced(event.target.checked)}
              />
              Try it anyway (it will almost certainly fail)
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-1.5">
          <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            <Icons.terminal className="size-3" /> Console
          </h4>
          <pre
            ref={consoleRef}
            className="min-h-[150px] flex-1 overflow-auto rounded-lg border border-hair bg-raised p-2 font-mono text-[11px] leading-relaxed text-fg"
          >
            {stdout.length
              ? stdout.join('\n')
              : 'print() output appears here. The runtime loads once (~10 MB) and is cached afterwards.'}
          </pre>
        </div>

        <div className="flex min-h-0 flex-col gap-1.5">
          <h4 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
            <Icons.image className="size-3" /> Output
          </h4>

          {error ? (
            <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-hair bg-err-tint p-2 font-mono text-[11px] text-err">
              {error}
            </pre>
          ) : null}

          {report?.html ? (
            <iframe
              title="Python animation"
              srcDoc={buildHtmlDocument(report.html)}
              sandbox="allow-scripts"
              className="min-h-[280px] flex-1 rounded-lg border border-hair bg-white"
            />
          ) : null}

          {report?.images.length ? (
            <div className="space-y-2">
              {report.images.map((image, index) => (
                <img
                  key={index}
                  src={`data:image/png;base64,${image}`}
                  alt={`Figure ${index + 1} from the Python script`}
                  className="w-full rounded-lg border border-hair bg-white"
                />
              ))}
            </div>
          ) : null}

          {status === 'done' && !hasOutput ? (
            <p className="rounded-lg border border-hair bg-raised p-2 text-[11px] leading-relaxed text-muted">
              Ran cleanly with no figures. To get a picture, keep a matplotlib figure open (never call{' '}
              <code className="font-mono">plt.show()</code>), or leave a module-level{' '}
              <code className="font-mono">anim = FuncAnimation(...)</code> for an animated preview.
            </p>
          ) : null}

          {status === 'idle' && !error ? (
            <p className="text-[11px] text-faint">Nothing rendered yet — press “Run in browser”.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
