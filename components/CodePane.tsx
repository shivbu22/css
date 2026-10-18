'use client';

import { useMemo, useState } from 'react';
import { tokenizeLines } from '@/lib/core/highlight';
import { countLines } from '@/lib/core/parse';
import type { Artifact } from '@/lib/core/session';
import { TARGET_META } from '@/lib/core/types';
import { cn } from '@/lib/ui/cn';
import { CopyButton, DownloadButton, Icons, IconButton, Metric } from './ui';

/**
 * The code surface.
 *
 * Highlighting comes from the dependency-free tokenizer in lib/core/highlight,
 * which guarantees that the rendered text is byte-identical to the generated
 * code — so nothing is ever hidden or mangled for the sake of colour.
 */
export function CodePane({
  artifact,
  className,
  showGutter = true,
  showToolbar = true,
}: {
  artifact: Artifact;
  className?: string;
  showGutter?: boolean;
  /** Off inside gallery cards, which supply their own header and actions. */
  showToolbar?: boolean;
}) {
  const [wrap, setWrap] = useState(false);
  const streaming = artifact.status === 'streaming';
  const body = streaming ? artifact.stream : artifact.code;
  const meta = TARGET_META[artifact.target];
  const lines = useMemo(() => tokenizeLines(body, meta.lang), [body, meta.lang]);

  const placeholder = {
    pending: 'Queued — this target starts as soon as the brief is ready.',
    streaming: 'Waiting for the first tokens…',
    ready: 'Nothing here yet.',
    error: artifact.error ?? 'This target failed.',
  }[artifact.status];

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div
        className={cn(
          'flex-wrap items-center justify-between gap-2 border-b border-hair px-3 py-1.5',
          showToolbar ? 'flex' : 'hidden',
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted">{meta.file}</span>
          {body ? <Metric label="lines" value={countLines(body)} /> : null}
          {artifact.ms ? <Metric label="sec" value={(artifact.ms / 1000).toFixed(1)} /> : null}
          {artifact.version > 1 ? <Metric label="rev" value={`v${artifact.version}`} /> : null}
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label={wrap ? 'Disable soft wrap' : 'Enable soft wrap'} onClick={() => setWrap((value) => !value)}>
            <Icons.wrap className={wrap ? 'text-accent' : undefined} />
          </IconButton>
          <CopyButton text={artifact.code} compact />
          <DownloadButton text={artifact.code} filename={meta.file} compact />
        </div>
      </div>

      {artifact.status === 'error' && artifact.error && artifact.code ? (
        <p className="border-b border-hair bg-err-tint px-3 py-1.5 text-[11px] text-err">
          Re-roll failed, showing the previous revision: {artifact.error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {body ? (
          <pre
            aria-label={`${meta.label} source`}
            className={cn(
              'min-w-full px-0 py-2 font-mono text-[11.5px] leading-[1.6]',
              wrap ? 'whitespace-pre-wrap' : 'whitespace-pre',
            )}
          >
            <code>
              {lines.map((tokens, index) => (
                <span key={index} className="flex">
                  {showGutter ? (
                    <span className="sticky left-0 w-10 shrink-0 select-none pr-3 text-right text-faint">
                      {index + 1}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 pr-3">
                    {tokens.length ? (
                      tokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={`tok-${token.kind}`}>
                          {token.text}
                        </span>
                      ))
                    ) : (
                      <span> </span>
                    )}
                  </span>
                </span>
              ))}
              {streaming ? (
                <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-accent align-middle" />
              ) : null}
            </code>
          </pre>
        ) : (
          <p className="p-4 text-[12px] text-faint">{placeholder}</p>
        )}
      </div>
    </div>
  );
}
