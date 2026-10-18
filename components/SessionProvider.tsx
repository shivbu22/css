'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createSession,
  fromStoredSession,
  sessionReducer,
  toStoredSession,
  type SessionMode,
  type SessionState,
  type StoredSession,
} from '@/lib/core/session';
import {
  TARGETS,
  errorMessage,
  type GenerateRequest,
  type ModelCatalog,
  type Quality,
  type Runtime,
  type Target,
} from '@/lib/core/types';
import { getRuntime, RUNTIME_ID } from '@/lib/runtime';

const STORAGE_KEY = 'quintet:session:v1';

interface SessionContextValue {
  state: SessionState;
  runtime: Runtime;
  catalog: ModelCatalog | null;
  catalogLoading: boolean;
  setMode: (mode: SessionMode) => void;
  setFocus: (target: Target) => void;
  setModel: (model: string) => void;
  setQuality: (quality: Quality) => void;
  generate: (prompt: string) => void;
  regenerateBrief: () => void;
  reroll: (target: Target, instruction?: string) => void;
  refine: (targets: Target[], instruction: string) => void;
  polish: (target: Target) => void;
  cancel: () => void;
  reset: () => void;
  compile: (code: string) => Promise<string>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const runtime = useMemo(() => getRuntime(), []);
  const [state, dispatch] = useReducer(sessionReducer, undefined, () =>
    createSession({ runtimeId: RUNTIME_ID }),
  );
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ---------------------------------------------------------------------- */
  /* Model catalog                                                          */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    void runtime
      .models()
      .then((result) => {
        if (cancelled) return;
        setCatalog(result);
        dispatch({
          type: 'settings',
          patch: { model: stateRef.current.model || result.defaultModel || '' },
        });
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runtime]);

  /* ---------------------------------------------------------------------- */
  /* Restore the last session                                               */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredSession;
      if (!stored?.prompt) return;
      dispatch({
        type: 'restore',
        state: fromStoredSession(stored, createSession({ runtimeId: RUNTIME_ID })),
      });
    } catch {
      /* corrupt storage is not worth surfacing */
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Persist                                                                */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const anyArtifact = TARGETS.some((target) => state.artifacts[target].code.length > 0);
    if (!state.prompt || !anyArtifact) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStoredSession(state)));
      } catch {
        /* quota or private mode — persistence is a nicety, not a requirement */
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [state]);

  /* ---------------------------------------------------------------------- */
  /* Running a generation                                                   */
  /* ---------------------------------------------------------------------- */
  const run = useCallback(
    async (request: GenerateRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await runtime.generate(
          request,
          (event) => dispatch({ type: 'event', event }),
          controller.signal,
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({ type: 'run-error', error: errorMessage(error) });
      }
    },
    [runtime],
  );

  const model = useCallback(
    (explicit?: string) => explicit || stateRef.current.model || catalog?.defaultModel || '',
    [catalog],
  );

  const generate = useCallback(
    (prompt: string) => {
      const text = prompt.trim();
      if (!text) return;
      dispatch({ type: 'prompt', text });
      void run({
        mode: 'fanout',
        prompt: text,
        model: model(),
        quality: stateRef.current.quality,
      });
    },
    [model, run],
  );

  /** Fresh brief, same prompt: re-plans the whole set. */
  const regenerateBrief = useCallback(() => {
    const prompt = stateRef.current.prompt;
    if (!prompt) return;
    dispatch({ type: 'note', text: 'Re-planning the design brief…' });
    void run({
      mode: 'fanout',
      prompt,
      model: model(),
      quality: stateRef.current.quality,
    });
  }, [model, run]);

  const reroll = useCallback(
    (target: Target, instruction?: string) => {
      const snapshot = stateRef.current;
      if (!snapshot.prompt) return;
      dispatch({ type: 'reroll', target, instruction });
      void run({
        mode: 'target',
        prompt: snapshot.prompt,
        model: model(),
        quality: snapshot.quality,
        brief: snapshot.brief,
        target,
        instruction,
      });
    },
    [model, run],
  );

  const refine = useCallback(
    (targets: Target[], instruction: string) => {
      const text = instruction.trim();
      const snapshot = stateRef.current;
      if (!text || !snapshot.prompt || !targets.length) return;

      const currentByTarget: Partial<Record<Target, string>> = {};
      for (const target of targets) {
        const code = snapshot.artifacts[target].code;
        if (code) currentByTarget[target] = code;
      }

      dispatch({ type: 'refine', targets, instruction: text });
      void run({
        mode: 'refine',
        prompt: snapshot.prompt,
        model: model(),
        quality: snapshot.quality,
        brief: snapshot.brief,
        targets,
        instruction: text,
        currentByTarget,
      });
    },
    [model, run],
  );

  /** Same engine, polished preset: draft → self-critique → fix. */
  const polish = useCallback(
    (target: Target) => {
      const snapshot = stateRef.current;
      if (!snapshot.prompt || !snapshot.artifacts[target].code) return;
      dispatch({ type: 'note', text: `Polishing ${target} — drafting, critiquing, fixing.`, targets: [target] });
      void run({
        mode: 'target',
        prompt: snapshot.prompt,
        model: model(),
        quality: 'polished',
        brief: snapshot.brief,
        target,
        instruction:
          'Raise the finish: smoother easing, better proportions, no rough edges or placeholder content. Keep the structure contract exactly.',
      });
    },
    [model, run],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: 'event', event: { type: 'done' } });
    dispatch({ type: 'note', text: 'Cancelled.' });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    dispatch({ type: 'reset' });
  }, []);

  const compile = useCallback((code: string) => runtime.compile(code), [runtime]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      runtime,
      catalog,
      catalogLoading,
      setMode: (mode) => dispatch({ type: 'settings', patch: { mode } }),
      setFocus: (focus) => dispatch({ type: 'settings', patch: { focus } }),
      setModel: (nextModel) => dispatch({ type: 'settings', patch: { model: nextModel } }),
      setQuality: (quality) => dispatch({ type: 'settings', patch: { quality } }),
      generate,
      regenerateBrief,
      reroll,
      refine,
      polish,
      cancel,
      reset,
      compile,
    }),
    [
      state,
      runtime,
      catalog,
      catalogLoading,
      generate,
      regenerateBrief,
      reroll,
      refine,
      polish,
      cancel,
      reset,
      compile,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
