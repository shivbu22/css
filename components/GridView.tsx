'use client';

import { countLines } from '@/lib/core/parse';
import type { Artifact } from '@/lib/core/session';
import { TARGET_META, type Target } from '@/lib/core/types';
import { CodePane } from './CodePane';
import { EmptyState } from './EmptyState';
import { PreviewCard } from './PreviewPanel';
import { useSession } from './SessionProvider';
import { BriefPanel } from './BriefPanel';
import { CopyButton, DownloadButton, Panel, StatusBadge } from './ui';

/**
 * The gallery answers the question the whole product is about — "are these five
 * actually the same animation?" — by running the web trio, the React component
 * and the Python script side by side, with the three source files below.
 */
function SourceCard({ target, artifact }: { target: Target; artifact: Artifact }) {
  const meta = TARGET_META[target];

  return (
    <Panel
      className="min-h-[240px] animate-rise"
      title={
        <span className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-fg">{meta.label}</span>
          <StatusBadge status={artifact.status} />
        </span>
      }
      subtitle={artifact.code ? `${countLines(artifact.code)} lines` : meta.file}
      actions={
        <>
          <CopyButton text={artifact.code} compact />
          <DownloadButton text={artifact.code} filename={meta.file} compact />
        </>
      }
      bodyClassName="min-h-0"
    >
      <CodePane artifact={artifact} showGutter={false} showToolbar={false} />
    </Panel>
  );
}

export function GridView() {
  const { state, setFocus, setMode } = useSession();

  if (!state.prompt) return <EmptyState />;

  const openInCanvas = (target: Target) => {
    setFocus(target);
    setMode('canvas');
  };

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-auto">
      <BriefPanel variant="compact" />

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        <Panel
          className="min-h-[340px] lg:col-span-2 2xl:col-span-2"
          title="Web — HTML + CSS + JS"
          subtitle="running together in one sandboxed frame"
          actions={
            <button
              type="button"
              onClick={() => openInCanvas('html')}
              className="text-[11px] text-muted transition hover:text-accent"
            >
              Open in canvas
            </button>
          }
          bodyClassName="min-h-0"
        >
          <PreviewCard state={state} target="html" artifact={state.artifacts.html} />
        </Panel>

        <Panel
          className="min-h-[340px]"
          title="React component"
          subtitle="transpiled with Sucrase"
          actions={
            <button
              type="button"
              onClick={() => openInCanvas('react')}
              className="text-[11px] text-muted transition hover:text-accent"
            >
              Open in canvas
            </button>
          }
          bodyClassName="min-h-0"
        >
          <PreviewCard state={state} target="react" artifact={state.artifacts.react} />
        </Panel>

        <Panel
          className="min-h-[340px] lg:col-span-2"
          title="Python"
          subtitle="runs in this tab with Pyodide"
          actions={
            <button
              type="button"
              onClick={() => openInCanvas('python')}
              className="text-[11px] text-muted transition hover:text-accent"
            >
              Open in canvas
            </button>
          }
          bodyClassName="min-h-0"
        >
          <PreviewCard state={state} target="python" artifact={state.artifacts.python} />
        </Panel>

        {(['css', 'html', 'javascript'] as const).map((target) => (
          <SourceCard key={target} target={target} artifact={state.artifacts[target]} />
        ))}
      </div>
    </div>
  );
}
