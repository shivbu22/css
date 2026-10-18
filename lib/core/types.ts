/**
 * Core domain types.
 *
 * Everything in `lib/core` must stay isomorphic: it is imported by client
 * components *and* by server route handlers. No `fs`, no `process`-only APIs.
 */
import type { Brief } from './brief';

export const TARGETS = ['css', 'html', 'javascript', 'react', 'python'] as const;
export type Target = (typeof TARGETS)[number];

export type Quality = 'draft' | 'polished';
export type RuntimeId = 'server' | 'client';

export interface TargetMeta {
  /** Human label used in tabs and chat. */
  label: string;
  /** Language tag shown on the code pane. */
  lang: string;
  /** Suggested file name on download. */
  file: string;
  /** Which preview surface this target uses. */
  preview: 'web' | 'react' | 'python';
  /** How this artifact joins the others. */
  join: string;
}

export const TARGET_META: Record<Target, TargetMeta> = {
  css: {
    label: 'CSS',
    lang: 'css',
    file: 'styles.css',
    preview: 'web',
    join: 'Styles the classes defined by the HTML artifact.',
  },
  html: {
    label: 'HTML',
    lang: 'html',
    file: 'index.html',
    preview: 'web',
    join: 'Carries the structure contract: the classes the CSS styles and the JS animates.',
  },
  javascript: {
    label: 'JavaScript',
    lang: 'javascript',
    file: 'app.js',
    preview: 'web',
    join: 'Attaches behaviour to the HTML artifact without libraries.',
  },
  react: {
    label: 'React',
    lang: 'jsx',
    file: 'Component.jsx',
    preview: 'react',
    join: 'Self-contained component that reproduces the same animation with hooks.',
  },
  python: {
    label: 'Python',
    lang: 'python',
    file: 'animation.py',
    preview: 'python',
    join: 'Standalone script (stdlib + matplotlib/numpy) with no browser dependencies.',
  },
};

/* -------------------------------------------------------------------------- */
/* Generation contract                                                        */
/* -------------------------------------------------------------------------- */

export type GenerateMode = 'fanout' | 'target' | 'refine';

export interface GenerateRequest {
  mode: GenerateMode;
  /** The original build request, kept for context on refine/reroll calls. */
  prompt: string;
  model: string;
  quality: Quality;
  /** Reuse a brief from an earlier stage instead of paying for a new one. */
  brief?: Brief | null;
  /** Single target for `mode: 'target'`. */
  target?: Target;
  /** One-or-more targets for `mode: 'refine'`. */
  targets?: Target[];
  /** Natural-language revision request for `mode: 'refine'`. */
  instruction?: string;
  /** The code being revised (single-target refine). */
  current?: string;
  /** Per-target current code, for refining several targets at once. */
  currentByTarget?: Partial<Record<Target, string>>;
}

export type GenerateEvent =
  | { type: 'brief-start' }
  | { type: 'brief'; brief: Brief }
  | { type: 'brief-error'; error: string }
  | { type: 'target-start'; target: Target }
  | { type: 'target-delta'; target: Target; text: string }
  | { type: 'target-done'; target: Target; code: string; ms: number }
  | { type: 'target-error'; target: Target; error: string }
  | { type: 'note'; text: string; targets?: Target[] }
  | { type: 'error'; error: string }
  | { type: 'done' };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  /** Ask the backend for guaranteed-valid JSON (used by the brief stage). */
  json?: boolean;
  signal?: AbortSignal;
}

/** A single streaming completion. The only thing a model backend must provide. */
export type ChatFn = (messages: ChatMessage[], options: ChatOptions) => AsyncIterable<string>;

export interface ModelCatalog {
  models: string[];
  defaultModel: string;
  reachable: boolean;
  note?: string;
  fake?: boolean;
}

/** The seam between the two runtimes: local Ollama (server) and WebLLM (browser). */
export interface Runtime {
  id: RuntimeId;
  label: string;
  /** Where generation happens, for the UI badge. */
  placement: string;
  models(): Promise<ModelCatalog>;
  generate(
    request: GenerateRequest,
    sink: (event: GenerateEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  /** JSX/TS → JS, used by the React preview. */
  compile(code: string): Promise<string>;
}

/* -------------------------------------------------------------------------- */
/* Small shared helpers                                                       */
/* -------------------------------------------------------------------------- */

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/** Stable, dependency-free hash — used for cache-busting keys and `key` props. */
export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function truncate(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}
