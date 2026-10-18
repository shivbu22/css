'use client';

import { countLines } from '@/lib/core/parse';
import { TARGETS, TARGET_META } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { ArtifactRail } from './ArtifactRail';
import { CodePane } from './CodePane';
import { EmptyState } from './EmptyState';
import { PreviewPanel } from './PreviewPanel';
import { RefineDock } from './RefineDock';
import { useSession } from './SessionProvider';
import { Panel, StatusBadge, StatusDot } from './ui';

/** Compact horizontal target switcher for viewports without room for the rail. */
function TargetStrip() {
  const { state, setFocus } = useSession();

  return (
    <div className="flex gap-1 overflow-x-auto">
      {TARGETS.map((target) => {
        const artifact = state.artifacts[target];
        const active = state.focus === target;
        return (
          <button
            key={target}
            type="button"
            aria-current={active}
            onClick={() => setFocus(target)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] transition',
              active ? 'bg-raised text-fg ring-1 ring-inset ring-hair' : 'text-muted hover:bg-raised',
            )}
          >
            <StatusDot status={artifact.status} />
            {TARGET_META[target].label}
            {artifact.status === 'ready' && artifact.code ? (
              <span className="font-mono text-[10px] text-faint">{countLines(artifact.code)}L</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function CanvasView() {
  const { state } = useSession();

  if (!state.prompt) return <EmptyState />;

  const artifact = state.artifacts[state.focus];
  const meta = TARGET_META[state.focus];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
      <section className="panel-flat flex shrink-0 flex-col xl:w-[244px]">
        <div className="p-2 xl:hidden">
          <TargetStrip />
        </div>
        <div className="hidden min-h-0 flex-1 xl:flex">
          <ArtifactRail />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <Panel
          className="min-h-[380px] animate-rise"
          title={
            <span className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-fg">{meta.label}</span>
              <StatusBadge status={artifact.status} />
            </span>
          }
          subtitle={meta.join}
          bodyClassName="min-h-0"
        >
          <PreviewPanel state={state} target={state.focus} artifact={artifact} />
        </Panel>

        <Panel
          className="min-h-[320px] animate-rise"
          title="Source"
          subtitle={meta.file}
          bodyClassName="min-h-0"
        >
          <CodePane artifact={artifact} />
          <RefineDock target={state.focus} />
        </Panel>
      </div>
    </div>
  );
}
