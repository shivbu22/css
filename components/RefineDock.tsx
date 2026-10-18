'use client';

import { useState } from 'react';
import { TARGETS, TARGET_META, type Target } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { useSession } from './SessionProvider';
import { Button, Icons, KeyHint } from './ui';

export function RefineDock({
  target,
  showApplyAll = true,
  className,
}: {
  target: Target;
  showApplyAll?: boolean;
  className?: string;
}) {
  const { state, refine, reroll, polish } = useSession();
  const [text, setText] = useState('');
  const busy = state.running;
  const artifact = state.artifacts[target];
  const hasCode = artifact.code.length > 0;

  const submit = () => {
    if (!text.trim() || busy || !hasCode) return;
    refine([target], text);
    setText('');
  };

  return (
    <div className={cn('space-y-2 border-t border-hair p-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`refine-${target}`}>
          Refine {TARGET_META[target].label}
        </label>
        <input
          id={`refine-${target}`}
          value={text}
          disabled={!hasCode || busy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            hasCode
              ? `Refine ${TARGET_META[target].label} — slower easing, rounder shapes, more contrast…`
              : `Generate first to refine ${TARGET_META[target].label}`
          }
          className="h-9 flex-1 rounded-lg border border-hair bg-raised px-3 text-[12px] text-fg transition placeholder:text-faint focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <Button variant="primary" onClick={submit} disabled={!hasCode || busy || !text.trim()}>
          Refine
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          onClick={() => reroll(target)}
          disabled={busy}
          icon={<Icons.refresh className="size-3.5" />}
        >
          Re-roll
        </Button>
        <Button
          variant="ghost"
          onClick={() => polish(target)}
          disabled={busy || !hasCode}
          icon={<Icons.wand className="size-3.5" />}
          title="Draft, self-critique, then fix"
        >
          Polish
        </Button>
        {showApplyAll ? (
          <Button
            variant="ghost"
            onClick={() => refine([...TARGETS], text)}
            disabled={busy || !text.trim()}
            title="Send this instruction to all five targets"
          >
            Apply to all five
          </Button>
        ) : null}
        <span className="ml-auto flex items-center gap-1.5 text-[10.5px] text-faint">
          <KeyHint>↵</KeyHint> sends the brief + this file only
        </span>
      </div>
    </div>
  );
}
