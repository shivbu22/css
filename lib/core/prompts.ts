/**
 * Prompt construction.
 *
 * The structure contract from `brief.ts` is injected into every target prompt,
 * and each target gets its own system prompt with the constraints that make its
 * artifact previewable in a sandbox (no libraries, no plt.show(), no sockets).
 */
import { BRIEF_SYSTEM_PROMPT, buildContract, type Brief } from './brief';
import type { ChatMessage, Quality, Target } from './types';
import { TARGET_META } from './types';
import { qualityPreset } from './quality';

export const SHARED_RULES = `You are a senior engineer working inside Quintet, a tool that renders one design brief into five coordinated implementations of the same animation.

Hard rules for every reply:
- Output ONLY the file contents. No markdown fences, no headings, no commentary before or after.
- Follow the STRUCTURE CONTRACT exactly: use the given class names, keyframe names, palette and timing. Never rename or omit them.
- Write plain, dependency-free code unless the target description allows a specific library.
- Honour prefers-reduced-motion where the target supports it.
- If something in the request is impossible, still produce the closest working file rather than explaining.`;

const TARGET_BRIEF: Record<Target, string> = {
  css: `Target: a single CSS stylesheet.

- Style .pc-stage and every element class from the contract; the markup comes from the HTML artifact.
- Define every contract keyframe with @keyframes (same names) and wire it up with the animation shorthand.
- Use the palette for colour. Animate transform/opacity where possible so the work stays on the compositor.
- Add a @media (prefers-reduced-motion: reduce) block that keeps the layout but calms the motion.
- No @import, no external fonts, no CSS frameworks, no <style> tags.`,

  html: `Target: an HTML fragment (markup only).

- Root element: <div class="pc-stage"> containing every contract element with its exact class.
- Include a short, meaningful text node per element; mark purely decorative nodes aria-hidden="true".
- Add data-* attributes only where the JavaScript artifact genuinely needs a hook.
- No <html>, <head>, <body>, <style> or <script>. No external resources.`,

  javascript: `Target: one vanilla JavaScript file that runs after the markup is present.

- Select elements by the contract class names; never assume a framework or global.
- Guard every lookup (const stage = document.querySelector('...'); if (!stage) return;) and expose a single init function invoked immediately or on DOMContentLoaded.
- Drive motion with the Web Animations API or requestAnimationFrame, using the contract's palette and duration.
- Pause work on document visibilitychange, and respect prefers-reduced-motion.
- Never throw when the markup is missing.`,

  react: `Target: one self-contained React component file (JSX; TypeScript annotations are fine).

- Export the component as default. Import only from 'react' (and 'react-dom' if unavoidable) — anything else will fail to resolve.
- Animate with the Web Animations API inside useEffect (element.animate(keyframes, options)) and clean up in the effect's return. If you need CSS @keyframes, emit them from a <style> element rendered in the component.
- Use the contract's class names so the component can sit next to the CSS and HTML artifacts.
- No external CSS files, no CSS-in-JS libraries, no data fetching.`,

  python: `Target: one standalone Python script that visualises the same motion.

- Standard library first; numpy and matplotlib are available and are the right tools here.
- NEVER call plt.show(). Create figures (plt.figure / plt.subplots) and leave them open — the runner captures them as images.
- Prefer matplotlib.animation.FuncAnimation for movement; a module-level 'anim = FuncAnimation(...)' is rendered as an animated preview.
- Forbidden: turtle, tkinter, pygame, manim, requests/urllib, sockets, subprocess, file or network access, input().
- Structure: imports, constants taken from the contract (palette hex strings, duration in ms), a build_figure() function, and an 'if __name__ == "__main__":' entry point that prints one short status line.`,
};

export function systemPromptFor(target: Target, quality: Quality = 'draft'): string {
  const preset = qualityPreset(quality);
  return [SHARED_RULES, '', TARGET_BRIEF[target], preset.guidance ? `\n${preset.guidance}` : '']
    .filter(Boolean)
    .join('\n');
}

export function buildBriefMessages(prompt: string): ChatMessage[] {
  return [
    { role: 'system', content: BRIEF_SYSTEM_PROMPT },
    { role: 'user', content: `Build request: ${prompt}\n\nWrite the JSON spec now.` },
  ];
}

export interface TargetContext {
  brief: Brief;
  prompt: string;
  /** Revision request (refine mode). */
  instruction?: string;
  /** The code being revised. */
  current?: string;
  /** Extra push after a weak first attempt. */
  nudge?: string;
}

function userContent(target: Target, context: TargetContext): string {
  const parts = [
    buildContract(context.brief),
    '',
    `Build request: ${context.prompt}`,
    '',
    TARGET_META[target].join,
  ];

  if (context.current) {
    parts.push('', 'Current implementation:', context.current);
  }
  if (context.instruction) {
    parts.push('', `Revision request: ${context.instruction}`);
    parts.push('Return the complete revised file, not a diff or a list of changes.');
  }
  if (context.nudge) {
    parts.push('', context.nudge);
  }
  return parts.join('\n');
}

export function buildTargetMessages(
  target: Target,
  context: TargetContext,
  quality: Quality = 'draft',
): ChatMessage[] {
  return [
    { role: 'system', content: systemPromptFor(target, quality) },
    { role: 'user', content: userContent(target, context) },
  ];
}

const CRITIC_SYSTEM = `You are a strict code reviewer for generated animation artifacts.

You receive a structure contract and one implementation. Reply with a numbered list of at most 5 concrete defects, each naming the exact selector, line or property that is wrong. Judge only:
1. contract compliance — class names, keyframe names, palette, duration, easing;
2. correctness — would it run in a browser (or in the Python runner) without errors?
3. finish — is the animation complete rather than a stub?

If the file is fully correct, reply with exactly: OK`;

export function buildCritiqueMessages(
  target: Target,
  context: TargetContext,
  code: string,
): ChatMessage[] {
  return [
    { role: 'system', content: CRITIC_SYSTEM },
    {
      role: 'user',
      content: [
        buildContract(context.brief),
        '',
        `Build request: ${context.prompt}`,
        '',
        `Implementation (${TARGET_META[target].label}):`,
        code,
      ].join('\n'),
    },
  ];
}

export function buildFixMessages(
  target: Target,
  context: TargetContext,
  code: string,
  critique: string,
  quality: Quality = 'draft',
): ChatMessage[] {
  return [
    { role: 'system', content: systemPromptFor(target, quality) },
    {
      role: 'user',
      content: [
        buildContract(context.brief),
        '',
        `Build request: ${context.prompt}`,
        '',
        'Current implementation:',
        code,
        '',
        'A reviewer found these defects:',
        critique,
        '',
        'Return the complete corrected file. Fix the defects without regressing anything else.',
      ].join('\n'),
    },
  ];
}

export const RETRY_NUDGE =
  'Your previous reply did not contain a complete file. Reply now with the complete file contents only — no fences, no explanation.';

export const REROLL_NUDGE =
  'The previous attempt was discarded. Produce a fresh, complete implementation of the same contract with a different approach.';
