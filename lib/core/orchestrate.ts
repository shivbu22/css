/**
 * The generation engine.
 *
 * This is the piece both runtimes share: the server route wires `chat` to Ollama,
 * the browser runtime wires it to WebLLM. Everything else — brief stage, fan-out,
 * streaming deltas, the repair retry, the polish pass, per-target error isolation
 * — happens exactly once, here.
 */
import { fallbackBrief, parseBrief, type Brief } from './brief';
import { cleanCode, createDeltaFilter, looksUsable } from './parse';
import {
  RETRY_NUDGE,
  REROLL_NUDGE,
  buildBriefMessages,
  buildCritiqueMessages,
  buildFixMessages,
  buildTargetMessages,
  type TargetContext,
} from './prompts';
import { qualityPreset } from './quality';
import { linkSignals, timeoutSignal } from './signals';
import {
  TARGETS,
  TARGET_META,
  errorMessage,
  type ChatFn,
  type ChatMessage,
  type ChatOptions,
  type GenerateEvent,
  type GenerateRequest,
  type Target,
} from './types';

export interface RunOptions {
  chat: ChatFn;
  emit: (event: GenerateEvent) => void;
  signal?: AbortSignal;
  /** Overrides the quality preset; the server clamps these from env. */
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  briefTimeoutMs?: number;
  /** Ask the backend for schema-valid JSON on the brief stage. */
  jsonBrief?: boolean;
}

const DEFAULT_TARGET_TIMEOUT = 240_000;
const DEFAULT_BRIEF_TIMEOUT = 90_000;

const CONNECTION_ERROR =
  /(econnrefused|fetch failed|failed to fetch|network|connection refused|load failed|socket hang up|503|502)/i;

function isConnectionError(message: string): boolean {
  return CONNECTION_ERROR.test(message);
}

export async function runGeneration(request: GenerateRequest, options: RunOptions): Promise<void> {
  const preset = qualityPreset(request.quality);
  const temperature = options.temperature ?? preset.temperature;
  const maxTokens = options.maxTokens ?? preset.maxTokens;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TARGET_TIMEOUT;
  const emit: (event: GenerateEvent) => void = (event) => {
    try {
      options.emit(event);
    } catch {
      /* a closed stream must not break the run */
    }
  };

  const collect = async (
    messages: ChatMessage[],
    overrides: Partial<ChatOptions>,
    onChunk?: (text: string) => void,
    scope?: AbortSignal,
  ): Promise<string> => {
    let out = '';
    const stream = options.chat(messages, {
      model: request.model,
      temperature,
      maxTokens,
      signal: scope ?? options.signal,
      ...overrides,
    });
    for await (const chunk of stream) {
      out += chunk;
      onChunk?.(chunk);
    }
    return out;
  };

  /* --------------------------------------------------------------------- */
  /* Brief stage                                                            */
  /* --------------------------------------------------------------------- */
  let brief: Brief | null = request.brief ?? null;

  if (!brief && request.mode !== 'refine') {
    emit({ type: 'brief-start' });
    const timer = timeoutSignal(
      options.briefTimeoutMs ?? DEFAULT_BRIEF_TIMEOUT,
      'The brief stage timed out',
    );
    const linked = linkSignals(options.signal, timer.signal);
    try {
      const raw = await collect(
        buildBriefMessages(request.prompt),
        { temperature: 0.3, maxTokens: 700, json: options.jsonBrief ?? true },
        undefined,
        linked.signal,
      );
      const parsed = parseBrief(raw);
      if (parsed.ok) {
        brief = parsed.brief;
        emit({ type: 'brief', brief });
      } else {
        brief = fallbackBrief(request.prompt);
        emit({ type: 'brief-error', error: parsed.error });
        emit({ type: 'brief', brief });
      }
    } catch (error) {
      const message = errorMessage(error);
      timer.dispose();
      linked.dispose();
      if (isConnectionError(message) || options.signal?.aborted) {
        emit({ type: 'error', error: message });
        return;
      }
      brief = fallbackBrief(request.prompt);
      emit({ type: 'brief-error', error: message });
      emit({ type: 'brief', brief });
    } finally {
      timer.dispose();
      linked.dispose();
    }
  }

  const resolvedBrief = brief ?? fallbackBrief(request.prompt);

  /* --------------------------------------------------------------------- */
  /* Targets                                                                */
  /* --------------------------------------------------------------------- */
  const targets: Target[] =
    request.mode === 'fanout'
      ? request.targets?.length
        ? request.targets
        : [...TARGETS]
      : request.target
        ? [request.target]
        : request.targets?.length
          ? request.targets
          : [];

  if (!targets.length) {
    emit({ type: 'error', error: 'No targets requested.' });
    return;
  }

  const runTarget = async (target: Target): Promise<void> => {
    emit({ type: 'target-start', target });
    const started = Date.now();
    const filter = createDeltaFilter();
    const timer = timeoutSignal(
      timeoutMs,
      `${TARGET_META[target].label} exceeded ${Math.round(timeoutMs / 1000)}s`,
    );
    const linked = linkSignals(options.signal, timer.signal);

    const context: TargetContext = {
      brief: resolvedBrief,
      prompt: request.prompt,
      instruction: request.mode === 'refine' ? request.instruction : undefined,
      current:
        request.mode === 'refine'
          ? (request.currentByTarget?.[target] ?? request.current)
          : undefined,
    };

    const contextFor = (extra: Partial<TargetContext>): TargetContext => ({
      ...context,
      ...extra,
    });

    const streamTarget = async (ctx: TargetContext, overrides: Partial<ChatOptions> = {}) => {
      const raw = await collect(
        buildTargetMessages(target, ctx, request.quality),
        overrides,
        (chunk) => {
          const visible = filter(chunk);
          if (visible) emit({ type: 'target-delta', target, text: visible });
        },
        linked.signal,
      );
      return cleanCode(raw, target);
    };

    try {
      let code = await streamTarget(context);

      if (!looksUsable(code, target)) {
        const retry = await streamTarget(
          contextFor({ nudge: RETRY_NUDGE }),
          { temperature: Math.min(temperature + 0.15, 0.9) },
        );
        if (looksUsable(retry, target)) code = retry;
      }

      if (!looksUsable(code, target)) {
        throw new Error(`${TARGET_META[target].label} came back empty — the model may be overloaded.`);
      }

      if (preset.critique) {
        const polished = await runPolishPass(target, context, code, collect, linked.signal);
        if (polished) {
          code = polished.code;
          emit({
            type: 'note',
            text: `Polish pass rewrote ${TARGET_META[target].label}: ${polished.reason}`,
            targets: [target],
          });
        }
      }

      emit({ type: 'target-done', target, code, ms: Date.now() - started });
    } catch (error) {
      if (options.signal?.aborted) {
        emit({ type: 'target-error', target, error: 'Cancelled' });
      } else {
        emit({ type: 'target-error', target, error: errorMessage(error) });
      }
    } finally {
      timer.dispose();
      linked.dispose();
    }
  };

  if (request.mode === 'target') {
    await runTarget(targets[0]);
  } else {
    // Concurrent by design: one shared brief means every target is independent,
    // and batching backends (vLLM, Ollama with parallel slots) handle five
    // in roughly the wall time of one.
    await Promise.all(targets.map((target) => runTarget(target)));
  }

  emit({ type: 'done' });
}

/* ------------------------------------------------------------------------ */
/* Polish pass                                                               */
/* ------------------------------------------------------------------------ */

interface PolishResult {
  code: string;
  reason: string;
}

async function runPolishPass(
  target: Target,
  context: TargetContext,
  code: string,
  collect: (
    messages: ChatMessage[],
    overrides: Partial<ChatOptions>,
    onChunk?: (text: string) => void,
    scope?: AbortSignal,
  ) => Promise<string>,
  signal: AbortSignal,
): Promise<PolishResult | null> {
  try {
    const verdict = await collect(
      buildCritiqueMessages(target, context, code),
      { temperature: 0.1, maxTokens: 400 },
      undefined,
      signal,
    );
    const critique = verdict.trim();
    if (!critique || /^ok\b/i.test(critique)) return null;

    const defectCount = (critique.match(/^\s*\d+[.)]/gm) ?? []).length || 1;
    const fixedRaw = await collect(
      buildFixMessages(target, context, code, critique, 'polished'),
      {},
      undefined,
      signal,
    );
    const fixed = cleanCode(fixedRaw, target);
    if (!looksUsable(fixed, target)) return null;

    return {
      code: fixed,
      reason: `${defectCount} defect${defectCount === 1 ? '' : 's'} fixed`,
    };
  } catch {
    return null;
  }
}
