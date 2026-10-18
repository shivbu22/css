'use client';

import { countLines, summarizeCode } from '@/lib/core/parse';
import type { Artifact } from '@/lib/core/session';
import { TARGETS, TARGET_META, truncate, type Target } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { BriefPanel } from './BriefPanel';
import { useSession } from './SessionProvider';
import { StatusDot } from './ui';

function secondaryLine(artifact: Artifact): string {
  switch (artifact.status) {
    case 'streaming':
      return 'streaming…';
    case 'error':
      return truncate(artifact.error ?? 'failed', 46);
    case 'ready':
      return summarizeCode(artifact.code, 46) || 'generated';
    default:
      return 'not generated yet';
  }
}

export function ArtifactRail({ className }: { className?: string }) {
  const { state, setFocus } = useSession();

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="space-y-0.5 p-2">
        {TARGETS.map((target) => {
          const artifact = state.artifacts[target];
          const active = state.focus === target;
          const meta = TARGET_META[target];

          return (
            <button
              key={target}
              type="button"
              aria-current={active}
              onClick={() => setFocus(target)}
              className={cn(
                'w-full rounded-lg px-2.5 py-2 text-left transition',
                active ? 'bg-raised ring-1 ring-inset ring-hair' : 'hover:bg-raised',
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <StatusDot status={artifact.status} />
                  <span className="truncate text-[12.5px] font-medium text-fg">{meta.label}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-faint">
                  {artifact.status === 'ready' && artifact.code
                    ? `${countLines(artifact.code)}L`
                    : artifact.status === 'streaming'
                      ? '···'
                      : ''}
                </span>
              </span>
              <span className="mt-0.5 block truncate pl-3.5 text-[10.5px] text-faint">
                {secondaryLine(artifact)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-hair p-2">
        <BriefPanel variant="compact" />
      </div>
    </div>
  );
}
