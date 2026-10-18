'use client';

/**
 * Browser-only runtime.
 *
 * Same engine, different backend: WebLLM in a worker instead of Ollama, and
 * Sucrase fetched in the page instead of compiled in a route handler. This is
 * what makes the static build work with no server at all.
 *
 * Trade-off, stated honestly in the UI as well: browser models are a 1-4 GB
 * download, need WebGPU, and are weaker than a local qwen3-coder. This runtime is
 * the *distribution* mode, not the quality mode.
 */
import { runGeneration } from '@/lib/core/orchestrate';
import {
  type ChatFn,
  type ChatMessage,
  type ChatOptions,
  type ModelCatalog,
  type Runtime,
} from '@/lib/core/types';

const SUCRASE_URL = process.env.NEXT_PUBLIC_SUCRASE_URL || 'https://esm.run/sucrase';
const DEFAULT_WEBLLM_MODEL =
  process.env.NEXT_PUBLIC_WEBLLM_MODEL || 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';

const FALLBACK_MODELS = [
  DEFAULT_WEBLLM_MODEL,
  'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  'Llama-3.2-3B-Instruct-q4f16_1-MLC',
];

/* -------------------------------------------------------------------------- */
/* Async queue: turns worker messages into an async iterable                  */
/* -------------------------------------------------------------------------- */

function createQueue<T>() {
  const values: T[] = [];
  let resolveNext: ((result: IteratorResult<T>) => void) | null = null;
  let finished = false;
  let failure: Error | null = null;

  return {
    push(value: T) {
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value, done: false });
      } else {
        values.push(value);
      }
    },
    finish() {
      finished = true;
      if (resolveNext) {
        const resolve = resolveNext;
        resolveNext = null;
        resolve({ value: undefined as unknown as T, done: true });
      }
    },
    fail(error: unknown) {
      failure = error instanceof Error ? error : new Error(String(error));
      this.finish();
    },
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next: () => {
          if (values.length) return Promise.resolve({ value: values.shift() as T, done: false });
          if (failure) return Promise.reject(failure);
          if (finished) return Promise.resolve({ value: undefined as unknown as T, done: true });
          return new Promise<IteratorResult<T>>((resolve) => {
            resolveNext = resolve;
          });
        },
      };
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Worker bridge                                                              */
/* -------------------------------------------------------------------------- */

interface StreamHandlers {
  push: (text: string) => void;
  finish: () => void;
  fail: (error: string) => void;
}

class WebLlmBridge {
  private worker: Worker | null = null;
  private streams = new Map<string, StreamHandlers>();
  private counter = 0;
  private progressListener: ((progress: number, text: string) => void) | null = null;

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    const worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent) => this.handle(event.data as Record<string, unknown>);
    worker.onerror = () => {
      this.worker = null;
      for (const [, handlers] of this.streams) handlers.fail('The browser model worker crashed.');
      this.streams.clear();
    };
    this.worker = worker;
    return worker;
  }

  onProgress(listener: ((progress: number, text: string) => void) | null) {
    this.progressListener = listener;
  }

  private handle(message: Record<string, unknown>) {
    const type = message.type as string;

    if (type === 'progress') {
      this.progressListener?.(Number(message.progress ?? 0), String(message.text ?? ''));
      return;
    }
    if (type === 'delta') {
      this.streams.get(String(message.id))?.push(String(message.text ?? ''));
      return;
    }
    if (type === 'end') {
      const handlers = this.streams.get(String(message.id));
      handlers?.finish();
      this.streams.delete(String(message.id));
      return;
    }
    if (type === 'error' && message.id) {
      const handlers = this.streams.get(String(message.id));
      handlers?.fail(String(message.error ?? 'Generation failed.'));
      this.streams.delete(String(message.id));
      return;
    }
    if (type === 'error') {
      for (const [, handlers] of this.streams) handlers.fail(String(message.error ?? 'Model error.'));
      this.streams.clear();
    }
  }

  chat(messages: ChatMessage[], options: ChatOptions): AsyncIterable<string> {
    const worker = this.ensureWorker();
    const id = `req-${++this.counter}`;
    const queue = createQueue<string>();

    this.streams.set(id, {
      push: queue.push,
      finish: queue.finish,
      fail: queue.fail,
    });

    worker.postMessage({
      type: 'chat',
      id,
      model: options.model,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      json: options.json ?? false,
    });

    const abort = () => {
      worker.postMessage({ type: 'abort' });
      const handlers = this.streams.get(id);
      handlers?.finish();
      this.streams.delete(id);
    };
    options.signal?.addEventListener('abort', abort, { once: true });

    return queue;
  }

  async catalog(timeoutMs = 6000): Promise<string[]> {
    const worker = this.ensureWorker();

    return new Promise<string[]>((resolve) => {
      const timer = setTimeout(() => {
        worker.removeEventListener('message', listener);
        resolve([]);
      }, timeoutMs);

      const listener = (event: MessageEvent) => {
        const data = event.data as Record<string, unknown>;
        if (data?.type === 'catalog') {
          clearTimeout(timer);
          worker.removeEventListener('message', listener);
          resolve((data.models as string[]) ?? []);
        }
      };

      worker.addEventListener('message', listener);
      worker.postMessage({ type: 'catalog' });
    });
  }
}

let bridge: WebLlmBridge | null = null;
function getBridge(): WebLlmBridge {
  if (!bridge) bridge = new WebLlmBridge();
  return bridge;
}

/* -------------------------------------------------------------------------- */
/* In-browser transpile                                                       */
/* -------------------------------------------------------------------------- */

interface SucraseModule {
  transform: (code: string, options: Record<string, unknown>) => { code: string };
}

let sucrasePromise: Promise<SucraseModule> | null = null;

async function loadSucrase(): Promise<SucraseModule> {
  if (!sucrasePromise) {
    sucrasePromise = import(/* webpackIgnore: true */ SUCRASE_URL) as Promise<SucraseModule>;
  }
  return sucrasePromise;
}

/* -------------------------------------------------------------------------- */
/* Runtime                                                                    */
/* -------------------------------------------------------------------------- */

export const clientRuntime: Runtime = {
  id: 'client',
  label: 'Browser model',
  placement: 'Runs entirely in this tab via WebLLM (WebGPU) — no server needed',

  async models(): Promise<ModelCatalog> {
    const defaultModel = DEFAULT_WEBLLM_MODEL;
    const discovered = await getBridge().catalog();
    const coder = discovered.filter((id) => /coder/i.test(id));
    const models = (coder.length ? coder : discovered.length ? discovered : FALLBACK_MODELS).slice(0, 12);

    return {
      models,
      defaultModel: models.includes(defaultModel) ? defaultModel : (models[0] ?? defaultModel),
      reachable: true,
      note: discovered.length
        ? 'Model weights download on first use and are cached by the browser.'
        : 'Could not read the WebLLM model list — showing known-good defaults.',
    };
  },

  async generate(request, sink, signal) {
    const active = getBridge();
    active.onProgress((progress, text) => {
      if (progress > 0) {
        sink({
          type: 'note',
          text: `Loading ${request.model || DEFAULT_WEBLLM_MODEL} — ${Math.round(progress * 100)}%${text ? ` (${text})` : ''}`,
        });
      }
    });

    const chat: ChatFn = (messages, options) => active.chat(messages, options);

    try {
      await runGeneration(request, { chat, emit: sink, signal });
    } finally {
      active.onProgress(null);
    }
  },

  async compile(code) {
    const sucrase = await loadSucrase();
    const result = sucrase.transform(code, {
      transforms: ['jsx', 'typescript', 'imports'],
      production: true,
      filePath: 'Component.jsx',
    });
    return result.code;
  },
};
