'use client';

import { useEffect, useState } from 'react';
import {
  PREVIEW_MESSAGE_TYPE,
  buildReactDocument,
  buildWebDocument,
} from '@/lib/core/preview';
import type { Artifact, SessionState } from '@/lib/core/session';
import { errorMessage, hashString, type Target } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { PythonRunner } from './PythonRunner';
import { useSession } from './SessionProvider';
import { Icons, IconButton, Segmented, Spinner } from './ui';

type Layout = 'center' | 'stretch';

/** Errors arrive over postMessage: the frame has an opaque origin. */
function usePreviewErrors(resetKey: string) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; message?: string } | null;
      if (data && data.type === PREVIEW_MESSAGE_TYPE) {
        setError(String(data.message ?? 'Preview error'));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    setError(null);
  }, [resetKey]);

  return [error, () => setError(null)] as const;
}

function ErrorBar({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-2 border-b border-hair bg-err-tint px-3 py-1.5 text-[11px] text-err">
      <Icons.alert className="mt-0.5 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{message}</span>
      <IconButton label="Dismiss preview error" onClick={onDismiss} className="size-6">
        <Icons.close className="size-3.5" />
      </IconButton>
    </div>
  );
}

/**
 * The sandboxed frame.
 *
 * `sandbox="allow-scripts"` deliberately omits `allow-same-origin`, so the frame
 * gets an opaque origin: generated code cannot touch cookies, storage or the
 * parent document. There is intentionally no "open in a new tab" escape hatch,
 * because that would hand the code a real origin.
 */
function DocumentFrame({
  doc,
  title,
  note,
  toolbar,
  className,
}: {
  doc: string;
  title: string;
  note?: string;
  toolbar?: React.ReactNode;
  className?: string;
}) {
  const key = hashString(doc);
  const [nonce, setNonce] = useState(0);
  const [error, dismiss] = usePreviewErrors(`${key}:${nonce}`);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-3 py-1.5">
        <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted">
          <Icons.shield className="size-3.5 shrink-0 text-faint" />
          <span className="truncate">{title}</span>
          {note ? <span className="truncate text-faint">· {note}</span> : null}
        </span>
        <span className="flex items-center gap-1">
          {toolbar}
          <IconButton label="Reload preview" onClick={() => setNonce((value) => value + 1)}>
            <Icons.refresh className="size-3.5" />
          </IconButton>
        </span>
      </div>

      {error ? <ErrorBar message={error} onDismiss={dismiss} /> : null}

      <iframe
        key={`${key}-${nonce}`}
        title={title}
        srcDoc={doc}
        sandbox="allow-scripts"
        className="min-h-[240px] w-full flex-1 border-0 bg-canvas"
      />
    </div>
  );
}

function ReactPreview({ code, className }: { code: string; className?: string }) {
  const { compile } = useSession();
  const [doc, setDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setDoc(null);
      setError(null);
      return;
    }
    let cancelled = false;

    compile(code)
      .then((js) => {
        if (cancelled) return;
        setDoc(buildReactDocument(js));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(errorMessage(cause));
        setDoc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, compile]);

  if (!code) {
    return <Placeholder text="No component yet — the React tab fills in as it streams." className={className} />;
  }

  if (error) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col gap-2 p-4', className)}>
        <p className="text-[12px] text-err">Could not compile this component: {error}</p>
        <p className="text-[11px] text-faint">
          A syntax error in generated JSX usually means a truncated reply — re-roll or refine the tab.
        </p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className={cn('flex min-h-0 flex-1 items-center justify-center gap-2 p-6 text-[12px] text-muted', className)}>
        <Spinner /> Transpiling JSX…
      </div>
    );
  }

  return <DocumentFrame doc={doc} title="React preview" note="React 18 · Sucrase" className={className} />;
}

function WebPreview({
  state,
  layout,
  onLayout,
  className,
}: {
  state: SessionState;
  layout: Layout;
  onLayout?: (layout: Layout) => void;
  className?: string;
}) {
  const missing = (['html', 'css', 'javascript'] as const).filter((part) => !state.artifacts[part].code);
  const doc = buildWebDocument({
    html: state.artifacts.html.code,
    css: state.artifacts.css.code,
    javascript: state.artifacts.javascript.code,
    layout,
  });

  return (
    <DocumentFrame
      doc={doc}
      title="Web preview"
      note={missing.length ? `waiting on ${missing.join(', ')}` : 'HTML + CSS + JS together'}
      className={className}
      toolbar={
        onLayout ? (
          <Segmented<Layout>
            value={layout}
            onChange={onLayout}
            options={[
              { value: 'center', label: 'Fit' },
              { value: 'stretch', label: 'Full' },
            ]}
          />
        ) : null
      }
    />
  );
}

function Placeholder({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 items-center justify-center p-6 text-center text-[12px] text-faint',
        className,
      )}
    >
      {text}
    </div>
  );
}

/** The full preview surface for the active target, with frame chrome. */
export function PreviewPanel({
  state,
  target,
  artifact,
  className,
}: {
  state: SessionState;
  target: Target;
  artifact: Artifact;
  className?: string;
}) {
  const [layout, setLayout] = useState<Layout>('center');

  if (target === 'python') {
    return <PythonRunner code={artifact.code} className={className} />;
  }
  if (target === 'react') {
    return <ReactPreview code={artifact.code} className={className} />;
  }
  return <WebPreview state={state} layout={layout} onLayout={setLayout} className={className} />;
}

/** Bare surface for gallery cards, which supply their own headers. */
export function PreviewCard({
  state,
  target,
  artifact,
  className,
}: {
  state: SessionState;
  target: Target;
  artifact: Artifact;
  className?: string;
}) {
  if (target === 'python') {
    return <PythonRunner code={artifact.code} className={className} />;
  }
  if (target === 'react') {
    if (!artifact.code) return <Placeholder text="Not generated yet." className={className} />;
    return <ReactPreview code={artifact.code} className={className} />;
  }
  return <WebPreview state={state} layout="center" className={className} />;
}
