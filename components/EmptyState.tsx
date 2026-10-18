'use client';

import { TARGETS, TARGET_META } from '@/lib/core/types';
import { useSession } from './SessionProvider';
import { Chip, Icons } from './ui';

const PRESETS = [
  {
    title: 'Neon loader',
    prompt: 'a pulsing neon loader with a soft halo and a quiet label',
    hint: 'loop · glow · scale',
  },
  {
    title: 'Bouncing ball',
    prompt: 'a bouncing ball that squashes on impact and eases back up',
    hint: 'easing · squash · ground',
  },
  {
    title: 'Typewriter heading',
    prompt: 'a typewriter heading that types itself, blinks a caret, then fades',
    hint: 'steps · caret · fade',
  },
];

const STEPS = [
  { title: 'Brief', body: 'One small call commits to elements, keyframes, palette and timing.' },
  { title: 'Contract', body: 'Class and keyframe names are derived deterministically from the brief.' },
  { title: 'Five builds', body: 'Each target renders from that contract, concurrently.' },
];

export function EmptyState() {
  const { generate, state } = useSession();

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-4 sm:p-8">
      <div className="w-full max-w-3xl animate-rise space-y-8 py-4">
        <header className="space-y-3 text-center">
          <Chip className="mx-auto">
            <Icons.spark className="size-3 text-accent" />
            brief → contract → five builds
          </Chip>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[32px]">
            One prompt. <span className="gradient-text">Five coordinated builds.</span>
          </h1>
          <p className="mx-auto max-w-xl text-[13px] leading-relaxed text-muted">
            Quintet plans a design brief first, then renders {TARGETS.length} targets from it — so the{' '}
            {TARGETS.map((target) => TARGET_META[target].label).join(', ')} versions describe the{' '}
            <em className="text-fg not-italic">same</em> animation instead of five unrelated snippets.
          </p>
        </header>

        <section className="space-y-2">
          <p className="text-center text-[10.5px] uppercase tracking-wider text-faint">
            Start from a preset
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                disabled={state.running}
                onClick={() => generate(preset.prompt)}
                className="panel-flat group p-3 text-left transition hover:border-accent disabled:opacity-50"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-semibold text-fg">{preset.title}</span>
                  <Icons.chevron className="size-3.5 text-faint transition group-hover:translate-x-0.5 group-hover:text-accent" />
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-muted">{preset.prompt}</span>
                <span className="mt-2 block font-mono text-[10px] text-faint">{preset.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="space-y-1">
              <span className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full border border-hair font-mono text-[10px] text-accent">
                  {index + 1}
                </span>
                <span className="text-[12px] font-medium text-fg">{step.title}</span>
              </span>
              <p className="text-[11px] leading-relaxed text-faint">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="text-center text-[11px] text-faint">
          Type a prompt in the bar above — <kbd className="font-mono">⌘↵</kbd> generates, <kbd className="font-mono">⌘1··5</kbd>{' '}
          switches artifacts.
        </p>

        {state.error ? <p className="text-center text-[12px] text-err">{state.error}</p> : null}
      </div>
    </div>
  );
}
