'use client';

import { useEffect, useRef, useState } from 'react';
import type { SessionMessage } from '@/lib/core/session';
import { TARGETS, TARGET_META, truncate, type Target } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { BriefPanel } from './BriefPanel';
import { EmptyState } from './EmptyState';
import { useSession } from './SessionProvider';
import { Button, Icons, Spinner, StatusDot } from './ui';

function AssistantLine({ message }: { message: SessionMessage }) {
  const { setFocus, setMode } = useSession();

  if (message.kind === 'note') {
    return <p className="text-[11.5px] leading-relaxed text-faint">{message.text}</p>;
  }

  if (message.kind === 'error') {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-hair bg-err-tint px-3 py-2 text-[12px] text-err">
        <Icons.alert className="mt-0.5 size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">{message.text}</span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[12.5px] leading-relaxed text-muted">{message.text}</p>
      {message.targets.length ? (
        <div className="flex flex-wrap gap-1.5">
          {message.targets.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => {
                setFocus(target);
                setMode('canvas');
              }}
              className="chip transition hover:border-accent hover:text-accent"
            >
              <Icons.canvas className="size-3" />
              Open {TARGET_META[target].label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProgressRow() {
  const { state } = useSession();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hair px-3 py-2">
      <span className="flex items-center gap-1.5 text-[11.5px] text-accent-soft">
        <Spinner />
        {state.briefStatus === 'loading' ? 'planning the brief' : 'generating'}
      </span>
      {TARGETS.map((target) => (
        <span key={target} className="flex items-center gap-1.5 text-[11px] text-faint">
          <StatusDot status={state.artifacts[target].status} />
          {TARGET_META[target].label}
        </span>
      ))}
    </div>
  );
}

export function ChatView() {
  const { state, generate, refine } = useSession();
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<'all' | Target>('all');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const hasCode = TARGETS.some((target) => state.artifacts[target].code.length > 0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [state.messages.length, state.running, state.briefStatus]);

  if (!state.prompt) return <EmptyState />;

  const send = () => {
    const text = draft.trim();
    if (!text || state.running) return;
    if (!hasCode) generate(text);
    else if (scope === 'all') refine([...TARGETS], text);
    else refine([scope], text);
    setDraft('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="panel min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {state.messages.map((message, index) => (
          <div key={message.id} className="space-y-3">
            {message.role === 'user' ? (
              <div className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-accent-tint px-3 py-2 text-[13px] text-fg">
                  {message.text}
                </p>
              </div>
            ) : (
              <AssistantLine message={message} />
            )}

            {index === 0 && state.brief ? <BriefPanel /> : null}
          </div>
        ))}

        {state.running ? <ProgressRow /> : null}

        {!state.running && hasCode ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
            <StatusDot tone="ok" />
            {TARGETS.filter((target) => state.artifacts[target].code).length}/5 artifacts ready ·{' '}
            {truncate(state.brief?.name ?? state.prompt, 60)}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className={cn('panel space-y-2 p-3')}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="sr-only" htmlFor="chat-scope">
            Which targets to change
          </label>
          <select
            id="chat-scope"
            value={scope}
            disabled={!hasCode}
            onChange={(event) => setScope(event.target.value as 'all' | Target)}
            className="h-9 rounded-lg border border-hair bg-raised px-2 text-[12px] text-fg transition focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="all">All five</option>
            {TARGETS.map((target) => (
              <option key={target} value={target}>
                {TARGET_META[target].label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            id="chat-input"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={
              hasCode
                ? 'Describe the change — slower, rounder, higher contrast, calmer…'
                : 'Describe the animation you want'
            }
            className="min-h-[46px] flex-1 resize-y rounded-lg border border-hair bg-raised px-3 py-2 text-[13px] text-fg transition placeholder:text-faint focus:border-accent focus:outline-none"
          />

          <Button
            variant="primary"
            onClick={send}
            disabled={state.running || !draft.trim()}
            className="h-9 px-3.5"
          >
            {state.running ? <Spinner /> : null}
            {hasCode
              ? scope === 'all'
                ? 'Refine all'
                : `Refine ${TARGET_META[scope].label}`
              : 'Generate five'}
          </Button>
        </div>
        <p className="text-[10.5px] text-faint">
          Chat, Canvas and Grid are three views of one session — a refine here updates the tabs, and a
          re-roll there lands in this transcript.
        </p>
      </div>
    </div>
  );
}
