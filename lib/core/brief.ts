/**
 * The design brief — the stage that makes five outputs describe *one* animation.
 *
 * Generation is two-pass: the model first commits to a small machine-checkable
 * spec, then every target is rendered from that spec plus a deterministic
 * structure contract (class names, keyframe names, palette, timing). Without
 * this, the five artifacts are five unrelated snippets.
 */
import { z } from 'zod';
import { truncate } from './types';

export const BriefSchema = z.object({
  name: z.string().min(1).max(80),
  summary: z.string().max(400).default(''),
  elements: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().max(200).default(''),
      }),
    )
    .min(1)
    .max(8),
  keyframes: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        from: z.string().min(1).max(200),
        to: z.string().min(1).max(200),
      }),
    )
    .min(1)
    .max(6),
  palette: z.array(z.string().min(1).max(30)).min(1).max(6),
  easing: z.string().min(1).max(60).default('ease-in-out'),
  durationMs: z.number().int().positive().max(60_000).default(1200),
  loop: z.boolean().default(true),
  notes: z.array(z.string().max(200)).max(6).default([]),
});

export type Brief = z.infer<typeof BriefSchema>;

export const BRIEF_SYSTEM_PROMPT = `You are a motion designer writing a build spec for an animated UI component.

Reply with a single JSON object and nothing else — no prose, no markdown fences.

Schema:
{
  "name": "short title, 2-4 words",
  "summary": "one sentence describing the motion",
  "elements": [{ "name": "Core Dot", "description": "what it is and how it moves" }],
  "keyframes": [{ "name": "pulse", "from": "transform: scale(1); opacity: .8", "to": "transform: scale(1.3); opacity: 1" }],
  "palette": ["#22d3ee", "#0f172a", "#e2e8f0"],
  "easing": "cubic-bezier(.4, 0, .2, 1)",
  "durationMs": 1400,
  "loop": true,
  "notes": ["keep the accent colour for the active element"]
}

Rules:
- 1-5 elements, 1-4 keyframes. Names are short nouns.
- "from"/"to" must be CSS declarations (property: value; ...), not prose.
- palette entries are hex colours, most important first.
- durationMs is a whole number of milliseconds for one cycle.
- Set "loop": false only when the prompt asks for a one-shot animation.`;

/** Pull the JSON object out of a model response and validate it. */
export function parseBrief(
  raw: string,
): { ok: true; brief: Brief } | { ok: false; error: string; raw: string } {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: 'Response contained no JSON object', raw };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (error) {
    return { ok: false, error: `Invalid JSON: ${(error as Error).message}`, raw };
  }
  const result = BriefSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    return {
      ok: false,
      error: `Brief did not match the schema: ${issue.path.join('.') || 'root'} — ${issue.message}`,
      raw,
    };
  }
  return { ok: true, brief: result.data };
}

/** Deterministic fallback so a failed brief stage never blocks generation. */
export function fallbackBrief(prompt: string): Brief {
  const title = truncate(prompt.replace(/^(make|create|build|a|an|the)\s+/gi, ''), 48);
  return {
    name: title || 'Untitled motion',
    summary: truncate(prompt, 200),
    elements: [{ name: 'Subject', description: truncate(prompt, 160) }],
    keyframes: [
      {
        name: 'motion',
        from: 'transform: none; opacity: 1',
        to: 'transform: scale(1.08); opacity: 0.85',
      },
    ],
    palette: ['#22d3ee', '#0b1020', '#e2e8f0'],
    easing: 'ease-in-out',
    durationMs: 1200,
    loop: true,
    notes: ['Generated from the fallback brief — the model did not return valid JSON.'],
  };
}

/** `Neon Pulse · Ring` → `neon-pulse-ring` (stable across every target). */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining accents after decomposition
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (!slug) return 'part';
  return /^[0-9]/.test(slug) ? `x${slug}` : slug;
}

export function elementClass(name: string): string {
  return `pc-el-${slugify(name)}`;
}

export function keyframeName(name: string): string {
  return `pc-key-${slugify(name)}`;
}

/**
 * The structure contract. Identical text goes into all five target prompts, so
 * the HTML markup, the CSS selectors, the JS selectors, the React JSX and the
 * Python visualisation all agree on names by construction rather than by luck.
 */
export function buildContract(brief: Brief): string {
  const elements = brief.elements
    .map((element) => `  - .${elementClass(element.name)} — ${element.name}: ${element.description}`)
    .join('\n');
  const keyframes = brief.keyframes
    .map((keyframe) => `  - ${keyframeName(keyframe.name)}: ${keyframe.from} → ${keyframe.to}`)
    .join('\n');

  return [
    'STRUCTURE CONTRACT — every implementation must follow this exactly:',
    'root element: <div class="pc-stage"> … </div>',
    `elements:\n${elements}`,
    `keyframes (CSS @keyframes names, no renaming):\n${keyframes}`,
    `palette (most important first): ${brief.palette.join(', ')}`,
    `timing: ${brief.durationMs}ms per cycle, easing ${brief.easing}, ${
      brief.loop ? 'loops forever' : 'plays once'
    }`,
    brief.notes.length ? `notes: ${brief.notes.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
