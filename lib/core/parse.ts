/**
 * Defensive parsing for local-model output.
 *
 * Small models fence their code, prefix it with "Sure! Here's the CSS:", and
 * occasionally hand back a paragraph instead of a file. Nothing here trusts the
 * model: fences are unwrapped, prose is trimmed, and the result is checked for
 * plausibility before the UI ever sees it.
 */
import type { Target } from './types';

const FENCE = /^\s*(?:```|~~~)/;

function normaliseNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Unwrap the code from a model response.
 *
 * If fenced blocks exist, the largest one wins — that reliably discards both a
 * leading "here you go" and a trailing explanation. An unclosed fence (still
 * streaming) yields everything after it.
 */
export function stripFences(raw: string): string {
  const lines = normaliseNewlines(raw).split('\n');
  const blocks: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (FENCE.test(line)) {
      if (current) {
        blocks.push(current.join('\n'));
        current = null;
      } else {
        current = [];
      }
      continue;
    }
    if (current) current.push(line);
  }
  if (current && current.length) blocks.push(current.join('\n'));

  if (blocks.length) {
    const largest = blocks.reduce((best, block) => (block.length > best.length ? block : best), '');
    return largest.trim();
  }
  return lines.join('\n').trim();
}

const PROSE_LEAD =
  /^(here('s| is)|sure[,!:]?|below is|the following|this (is|code|implementation|file)|i (have|will)|note:|okay[,!]?|output:)/i;
const PROSE_TAIL = /^(this (code|implementation|component|script)|note that|explanation:|enjoy|let me know)/i;

/** Strip fences plus the prose a model wraps around them. */
export function cleanCode(raw: string, _target?: Target): string {
  const fenced = stripFences(raw);
  const lines = fenced.split('\n');

  while (lines.length > 1 && lines[0].trim() === '') lines.shift();
  while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();

  // Drop a leading "Here's the CSS:" style line, but never a line of real code.
  if (lines.length > 1 && PROSE_LEAD.test(lines[0].trim()) && !/[{};<>]/.test(lines[0])) {
    lines.shift();
  }
  if (lines.length > 1) {
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
  }
  while (lines.length > 1 && PROSE_TAIL.test(lines[lines.length - 1].trim())) {
    lines.pop();
    while (lines.length > 1 && lines[lines.length - 1].trim() === '') lines.pop();
  }

  return lines.join('\n').trim();
}

const REFUSAL = /^(i (can'?t|cannot|am unable)|sorry|as an ai)/i;

/** Is this plausibly a complete file for the target? Drives the retry nudge. */
export function looksUsable(code: string, target: Target): boolean {
  const text = code.trim();
  if (text.length < 24) return false;
  if (REFUSAL.test(text)) return false;

  switch (target) {
    case 'css':
      return text.includes('{') && text.includes('}');
    case 'html':
      return /<[a-z][\s\S]*>/i.test(text);
    case 'javascript':
      return /(function|=>|addEventListener|document\.|requestAnimationFrame)/.test(text);
    case 'react':
      return /(<[A-Za-z]|=>|function)/.test(text);
    case 'python':
      return /(def |import |for |while |=|print\()/.test(text);
    default:
      return true;
  }
}

/**
 * Line-level filter for streaming display: fence delimiter lines are dropped as
 * they arrive so the pane shows code rather than ```css noise. Final content is
 * still cleaned by `cleanCode` when the target completes.
 */
export function createDeltaFilter(): (chunk: string) => string {
  let pending = '';
  return (chunk: string): string => {
    pending += chunk;
    const cut = pending.lastIndexOf('\n');
    if (cut === -1) return '';
    const complete = pending.slice(0, cut).split('\n');
    pending = pending.slice(cut + 1);
    const kept = complete.filter((line) => !FENCE.test(line));
    return kept.length ? `${kept.join('\n')}\n` : '';
  };
}

/** One-line preview of a file, for chat cards and history rows. */
export function summarizeCode(code: string, max = 90): string {
  const line =
    code
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.length > 0 && !entry.startsWith('//') && !entry.startsWith('#')) ?? '';
  return line.length <= max ? line : `${line.slice(0, max - 1)}…`;
}

export function countLines(code: string): number {
  return code ? code.split('\n').length : 0;
}
