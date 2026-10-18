/**
 * The session — the one piece of state every view renders.
 *
 * A session is a message log plus one artifact slot per target. Chat, five-up and
 * focus are three renderings of this same reducer, which is why a refine typed in
 * chat updates the tabs, and a reroll in focus shows up in the transcript.
 */
import type { Brief } from './brief';
import { TARGETS, type GenerateEvent, type Quality, type RuntimeId, type Target } from './types';

export type ArtifactStatus = 'pending' | 'streaming' | 'ready' | 'error';
/** Canvas = preview-first with a rail, Grid = all five at a glance, Chat = talking. */
export type SessionMode = 'canvas' | 'grid' | 'chat';
export type RunKind = 'fanout' | 'target' | 'refine';

export interface Artifact {
  target: Target;
  status: ArtifactStatus;
  /** Raw text arriving from the model (already fence-filtered for display). */
  stream: string;
  /** Cleaned file contents once the target completes. */
  code: string;
  error: string | null;
  ms: number | null;
  version: number;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant';
  kind: 'prompt' | 'refine' | 'reroll' | 'note' | 'error';
  text: string;
  targets: Target[];
  at: number;
}

export interface SessionState {
  prompt: string;
  model: string;
  quality: Quality;
  mode: SessionMode;
  focus: Target;
  runtimeId: RuntimeId;
  brief: Brief | null;
  briefStatus: 'idle' | 'loading' | 'ready' | 'error';
  briefError: string | null;
  artifacts: Record<Target, Artifact>;
  messages: SessionMessage[];
  running: boolean;
  /** Which target caused the current run, when it is a single-target run. */
  activeTarget: Target | null;
  error: string | null;
  lastRun: RunKind | null;
}

export type SessionAction =
  | { type: 'settings'; patch: Partial<Pick<SessionState, 'model' | 'quality' | 'mode' | 'focus'>> }
  | { type: 'prompt'; text: string }
  | { type: 'reroll'; target: Target; instruction?: string }
  | { type: 'refine'; targets: Target[]; instruction: string }
  | { type: 'run-error'; error: string }
  | { type: 'note'; text: string; kind?: SessionMessage['kind']; targets?: Target[] }
  | { type: 'event'; event: GenerateEvent }
  | { type: 'restore'; state: SessionState }
  | { type: 'reset' };

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function emptyArtifact(target: Target): Artifact {
  return { target, status: 'pending', stream: '', code: '', error: null, ms: null, version: 0 };
}

export function emptyArtifacts(): Record<Target, Artifact> {
  return TARGETS.reduce(
    (acc, target) => {
      acc[target] = emptyArtifact(target);
      return acc;
    },
    {} as Record<Target, Artifact>,
  );
}

export function createSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    prompt: '',
    model: '',
    quality: 'draft',
    mode: 'canvas',
    focus: 'html',
    runtimeId: 'server',
    brief: null,
    briefStatus: 'idle',
    briefError: null,
    artifacts: emptyArtifacts(),
    messages: [],
    running: false,
    activeTarget: null,
    error: null,
    lastRun: null,
    ...overrides,
  };
}

function message(
  role: SessionMessage['role'],
  kind: SessionMessage['kind'],
  text: string,
  targets: Target[] = [],
): SessionMessage {
  return { id: nextId('msg'), role, kind, text, targets, at: Date.now() };
}

function withArtifact(state: SessionState, target: Target, patch: Partial<Artifact>): SessionState {
  return {
    ...state,
    artifacts: { ...state.artifacts, [target]: { ...state.artifacts[target], ...patch } },
  };
}

export function applyGenerateEvent(state: SessionState, event: GenerateEvent): SessionState {
  switch (event.type) {
    case 'brief-start':
      return { ...state, briefStatus: 'loading', briefError: null, running: true };

    case 'brief':
      return { ...state, brief: event.brief, briefStatus: 'ready', briefError: null };

    case 'brief-error':
      return {
        ...state,
        briefStatus: 'error',
        briefError: event.error,
        messages: [
          ...state.messages,
          message('assistant', 'note', `Brief stage fell back to defaults: ${event.error}`),
        ],
      };

    case 'target-start':
      return withArtifact({ ...state, running: true, activeTarget: event.target }, event.target, {
        status: 'streaming',
        stream: '',
        error: null,
        ms: null,
      });

    case 'target-delta':
      return withArtifact(state, event.target, {
        status: 'streaming',
        stream: state.artifacts[event.target].stream + event.text,
      });

    case 'target-done':
      return withArtifact(state, event.target, {
        status: 'ready',
        code: event.code,
        stream: '',
        ms: event.ms,
        error: null,
        version: state.artifacts[event.target].version + 1,
      });

    case 'target-error':
      return withArtifact(state, event.target, { status: 'error', error: event.error, stream: '' });

    case 'note':
      return {
        ...state,
        messages: [...state.messages, message('assistant', 'note', event.text, event.targets ?? [])],
      };

    case 'error':
      return {
        ...state,
        error: event.error,
        running: false,
        messages: [...state.messages, message('assistant', 'error', event.error)],
      };

    case 'done':
      return { ...state, running: false, activeTarget: null };

    default:
      return state;
  }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'settings':
      return { ...state, ...action.patch };

    case 'prompt':
      return {
        ...createSession({
          model: state.model,
          quality: state.quality,
          mode: state.mode,
          focus: state.focus,
          runtimeId: state.runtimeId,
        }),
        prompt: action.text,
        briefStatus: 'loading',
        running: true,
        lastRun: 'fanout',
        messages: [message('user', 'prompt', action.text)],
      };

    case 'reroll':
      return {
        ...state,
        artifacts: { ...state.artifacts, [action.target]: { ...state.artifacts[action.target], status: 'streaming', stream: '', error: null } },
        running: true,
        activeTarget: action.target,
        focus: action.target,
        error: null,
        lastRun: 'target',
        messages: [
          ...state.messages,
          message(
            'user',
            'reroll',
            action.instruction?.trim()
              ? `Re-roll ${action.target}: ${action.instruction.trim()}`
              : `Re-roll ${action.target}`,
            [action.target],
          ),
        ],
      };

    case 'refine':
      return {
        ...state,
        running: true,
        activeTarget: action.targets.length === 1 ? action.targets[0] : null,
        error: null,
        lastRun: 'refine',
        messages: [
          ...state.messages,
          message(
            'user',
            'refine',
            `${action.targets.length === TARGETS.length ? 'Refine all targets' : `Refine ${action.targets.join(', ')}`}: ${action.instruction}`,
            action.targets,
          ),
        ],
      };

    case 'run-error':
      return {
        ...state,
        running: false,
        error: action.error,
        messages: [...state.messages, message('assistant', 'error', action.error)],
      };

    case 'note':
      return {
        ...state,
        messages: [
          ...state.messages,
          message('assistant', action.kind ?? 'note', action.text, action.targets ?? []),
        ],
      };

    case 'event':
      return applyGenerateEvent(state, action.event);

    case 'restore':
      return action.state;

    case 'reset':
      return createSession({ model: state.model, quality: state.quality, runtimeId: state.runtimeId });

    default:
      return state;
  }
}

export function isArtifactReady(state: SessionState, target: Target): boolean {
  return state.artifacts[target].status === 'ready' && state.artifacts[target].code.length > 0;
}

export function readyTargets(state: SessionState): Target[] {
  return TARGETS.filter((target) => isArtifactReady(state, target));
}

export function completedCount(state: SessionState): number {
  return TARGETS.filter((target) => {
    const status = state.artifacts[target].status;
    return status === 'ready' || status === 'error';
  }).length;
}

/** Persisted shape — deliberately narrow so restores stay cheap and safe. */
export interface StoredSession {
  prompt: string;
  model: string;
  quality: Quality;
  brief: Brief | null;
  artifacts: Record<Target, { code: string; version: number; ms: number | null }>;
  at: number;
}

export function toStoredSession(state: SessionState): StoredSession {
  const artifacts = TARGETS.reduce(
    (acc, target) => {
      const artifact = state.artifacts[target];
      acc[target] = { code: artifact.code, version: artifact.version, ms: artifact.ms };
      return acc;
    },
    {} as StoredSession['artifacts'],
  );

  return {
    prompt: state.prompt,
    model: state.model,
    quality: state.quality,
    brief: state.brief,
    artifacts,
    at: Date.now(),
  };
}

export function fromStoredSession(stored: StoredSession, base: SessionState): SessionState {
  const artifacts = emptyArtifacts();
  for (const target of TARGETS) {
    const saved = stored.artifacts?.[target];
    if (saved?.code) {
      artifacts[target] = {
        ...emptyArtifact(target),
        status: 'ready',
        code: saved.code,
        version: saved.version ?? 1,
        ms: saved.ms ?? null,
      };
    }
  }

  return {
    ...base,
    prompt: stored.prompt ?? '',
    model: stored.model || base.model,
    quality: stored.quality ?? 'draft',
    brief: stored.brief ?? null,
    briefStatus: stored.brief ? 'ready' : 'idle',
    artifacts,
    messages: stored.prompt
      ? [
          {
            id: nextId('msg'),
            role: 'user',
            kind: 'prompt',
            text: stored.prompt,
            targets: [],
            at: stored.at ?? Date.now(),
          },
          {
            id: nextId('msg'),
            role: 'assistant',
            kind: 'note',
            text: 'Restored your last session.',
            targets: readyTargetsFrom(artifacts),
            at: stored.at ?? Date.now(),
          },
        ]
      : [],
    running: false,
    error: null,
  };
}

function readyTargetsFrom(artifacts: Record<Target, Artifact>): Target[] {
  return TARGETS.filter((target) => artifacts[target].code.length > 0);
}
