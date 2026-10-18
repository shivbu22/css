'use client';

import { buildContract, elementClass, keyframeName } from '@/lib/core/brief';
import { useSession } from './SessionProvider';
import { Chip, Icons, IconButton } from './ui';

function Swatches({ colours }: { colours: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {colours.map((colour) => (
        <span
          key={colour}
          title={colour}
          aria-hidden="true"
          className="size-3.5 rounded ring-1 ring-inset ring-edge"
          style={{ background: colour }}
        />
      ))}
    </div>
  );
}

/**
 * The brief is why the five artifacts match, so it is shown — but kept small:
 * the compact form lives in the rail, the full form only in Chat and on demand.
 */
export function BriefPanel({
  variant = 'full',
  className,
}: {
  variant?: 'compact' | 'full';
  className?: string;
}) {
  const { state, regenerateBrief } = useSession();
  const { brief, briefStatus, briefError, running } = state;

  const replan = (
    <IconButton
      label="Re-plan the brief and rebuild all five"
      onClick={regenerateBrief}
      disabled={running || !state.prompt}
    >
      <Icons.refresh className="size-3.5" />
    </IconButton>
  );

  if (!brief) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-hair px-3 py-2">
          <span className="text-[11.5px] text-faint">
            {briefStatus === 'loading' ? 'Planning the design brief…' : 'No brief yet'}
          </span>
          {briefStatus === 'loading' ? <Icons.spark className="size-3.5 animate-pulse text-accent" /> : null}
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={className}>
        <div className="space-y-2 rounded-xl border border-hair p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-fg">{brief.name}</p>
              <p className="mt-0.5 text-[10.5px] text-faint">
                {brief.durationMs}ms · {brief.loop ? 'loop' : 'once'} · {brief.elements.length} elements
              </p>
            </div>
            {replan}
          </div>
          <Swatches colours={brief.palette} />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="rounded-xl border border-hair p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[13.5px] font-semibold text-fg">{brief.name}</h2>
              <Chip tone="accent">{brief.durationMs}ms</Chip>
              <Chip>{brief.easing}</Chip>
              <Chip>{brief.loop ? 'loops' : 'plays once'}</Chip>
            </div>
            {brief.summary ? (
              <p className="mt-1.5 max-w-3xl text-[12px] leading-relaxed text-muted">{brief.summary}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <Swatches colours={brief.palette} />
            {replan}
          </div>
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-faint">Palette</h3>
            <ul className="mt-1.5 space-y-1">
              {brief.palette.map((colour) => (
                <li key={colour} className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                  <span
                    aria-hidden="true"
                    className="size-3 rounded-sm ring-1 ring-inset ring-edge"
                    style={{ background: colour }}
                  />
                  {colour}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-faint">
              Elements → classes
            </h3>
            <ul className="mt-1.5 space-y-1">
              {brief.elements.map((element) => (
                <li key={element.name} className="text-[11.5px] leading-snug">
                  <code className="font-mono text-[11px] text-accent-soft">
                    .{elementClass(element.name)}
                  </code>{' '}
                  <span className="text-faint">{element.name}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-faint">Keyframes</h3>
            <ul className="mt-1.5 space-y-1.5">
              {brief.keyframes.map((keyframe) => (
                <li key={keyframe.name} className="text-[11px] leading-snug">
                  <code className="font-mono text-accent-soft">{keyframeName(keyframe.name)}</code>
                  <br />
                  <span className="text-faint">
                    {keyframe.from} → {keyframe.to}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {brief.notes.length ? (
          <ul className="mt-3 space-y-0.5 text-[11px] text-faint">
            {brief.notes.map((note) => (
              <li key={note}>· {note}</li>
            ))}
          </ul>
        ) : null}

        {briefStatus === 'error' && briefError ? (
          <p className="mt-2 text-[11px] text-warn">
            Fallback brief — the model did not return valid JSON: {briefError}
          </p>
        ) : null}

        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] text-faint transition hover:text-muted">
            Structure contract shared by all five prompts
          </summary>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg border border-hair bg-raised p-2 font-mono text-[11px] leading-relaxed text-muted">
            {buildContract(brief)}
          </pre>
        </details>
      </div>
    </div>
  );
}
