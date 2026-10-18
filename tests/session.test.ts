import { describe, expect, it } from 'vitest';
import {
  applyGenerateEvent,
  completedCount,
  createSession,
  fromStoredSession,
  readyTargets,
  sessionReducer,
  toStoredSession,
  type SessionState,
} from '@/lib/core/session';
import { fallbackBrief } from '@/lib/core/brief';

function startPrompt(state: SessionState, text = 'pulsing neon loader'): SessionState {
  return sessionReducer(state, { type: 'prompt', text });
}

describe('session reducer', () => {
  it('starts a prompt with a clean slate and a transcript entry', () => {
    const state = startPrompt(createSession(), 'pulsing neon loader');
    expect(state.running).toBe(true);
    expect(state.prompt).toBe('pulsing neon loader');
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: 'user', kind: 'prompt' });
    expect(state.artifacts.css.status).toBe('pending');
  });

  it('applies a full fan-out run', () => {
    let state = startPrompt(createSession());
    state = applyGenerateEvent(state, { type: 'brief-start' });
    state = applyGenerateEvent(state, { type: 'brief', brief: fallbackBrief('x') });
    state = applyGenerateEvent(state, { type: 'target-start', target: 'css' });
    state = applyGenerateEvent(state, { type: 'target-delta', target: 'css', text: '.pc-stage {}\n' });
    expect(state.artifacts.css.stream).toBe('.pc-stage {}\n');
    state = applyGenerateEvent(state, { type: 'target-done', target: 'css', code: '.pc-stage {}', ms: 900 });
    state = applyGenerateEvent(state, { type: 'done' });

    expect(state.artifacts.css).toMatchObject({ status: 'ready', code: '.pc-stage {}', ms: 900, version: 1 });
    expect(state.artifacts.css.stream).toBe('');
    expect(state.running).toBe(false);
    expect(state.briefStatus).toBe('ready');
    expect(readyTargets(state)).toEqual(['css']);
  });

  it('isolates a failing target from the others', () => {
    let state = startPrompt(createSession());
    state = applyGenerateEvent(state, { type: 'target-done', target: 'css', code: 'a { color: red; }', ms: 10 });
    state = applyGenerateEvent(state, { type: 'target-error', target: 'html', error: 'timed out' });

    expect(state.artifacts.css.status).toBe('ready');
    expect(state.artifacts.css.code).toBe('a { color: red; }');
    expect(state.artifacts.html).toMatchObject({ status: 'error', error: 'timed out' });
    expect(state.artifacts.python.status).toBe('pending');
    expect(completedCount(state)).toBe(2);
  });

  it('counts a reroll as a new version of one target only', () => {
    let state = startPrompt(createSession());
    state = applyGenerateEvent(state, { type: 'target-done', target: 'css', code: 'v1', ms: 5 });
    state = applyGenerateEvent(state, { type: 'target-done', target: 'html', code: 'html-v1', ms: 5 });

    state = sessionReducer(state, { type: 'reroll', target: 'css' });
    state = applyGenerateEvent(state, { type: 'target-done', target: 'css', code: 'v2', ms: 7 });

    expect(state.artifacts.css.version).toBe(2);
    expect(state.artifacts.css.code).toBe('v2');
    expect(state.artifacts.html.version).toBe(1);
    expect(state.lastRun).toBe('target');
    expect(state.messages.at(-1)).toMatchObject({ kind: 'reroll', targets: ['css'] });
  });

  it('keeps the existing code when a reroll fails', () => {
    let state = startPrompt(createSession());
    state = applyGenerateEvent(state, { type: 'target-done', target: 'react', code: 'ok', ms: 1 });
    state = sessionReducer(state, { type: 'reroll', target: 'react' });
    state = applyGenerateEvent(state, { type: 'target-error', target: 'react', error: 'boom' });

    expect(state.artifacts.react.status).toBe('error');
    expect(state.artifacts.react.code).toBe('ok');
  });

  it('records a refine against the chosen targets', () => {
    let state = startPrompt(createSession());
    state = sessionReducer(state, { type: 'refine', targets: ['css', 'javascript'], instruction: 'slower, rounder' });
    expect(state.lastRun).toBe('refine');
    expect(state.messages.at(-1)?.text).toContain('slower, rounder');
    expect(state.messages.at(-1)?.targets).toEqual(['css', 'javascript']);
  });

  it('notes brief fallbacks in the transcript and surfaces run errors', () => {
    let state = startPrompt(createSession());
    state = applyGenerateEvent(state, { type: 'brief-error', error: 'no JSON' });
    expect(state.briefStatus).toBe('error');
    expect(state.messages.at(-1)?.text).toMatch(/fell back/i);

    state = applyGenerateEvent(state, { type: 'error', error: 'Cannot reach Ollama' });
    expect(state.running).toBe(false);
    expect(state.error).toBe('Cannot reach Ollama');
    expect(state.messages.at(-1)?.kind).toBe('error');
  });

  it('resets artifacts but keeps settings', () => {
    let state = startPrompt(createSession({ model: 'qwen3-coder', quality: 'polished' }));
    state = applyGenerateEvent(state, { type: 'target-done', target: 'css', code: 'x', ms: 1 });
    state = sessionReducer(state, { type: 'reset' });

    expect(state.artifacts.css.code).toBe('');
    expect(state.model).toBe('qwen3-coder');
    expect(state.quality).toBe('polished');
  });
});

describe('persistence', () => {
  it('round-trips a session', () => {
    let state = startPrompt(createSession({ model: 'qwen3-coder' }), 'typewriter heading');
    state = applyGenerateEvent(state, { type: 'brief', brief: fallbackBrief('typewriter heading') });
    state = applyGenerateEvent(state, { type: 'target-done', target: 'css', code: '.pc-el-label {}', ms: 42 });

    const restored = fromStoredSession(toStoredSession(state), createSession({ model: 'qwen3-coder' }));
    expect(restored.prompt).toBe('typewriter heading');
    expect(restored.artifacts.css.code).toBe('.pc-el-label {}');
    expect(restored.artifacts.css.status).toBe('ready');
    expect(restored.artifacts.html.status).toBe('pending');
    expect(restored.brief?.name).toBeTruthy();
  });
});
