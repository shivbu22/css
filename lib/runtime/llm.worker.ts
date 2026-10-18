/// <reference lib="webworker" />
/**
 * The browser model host.
 *
 * WebLLM (WebGPU) must not run on the main thread — model loading blocks for
 * seconds and generation saturates the GPU. Everything about the model lives in
 * this worker; the page only sees progress and token streams.
 *
 * The module itself is fetched at runtime rather than bundled, so a static build
 * of the app does not have to ship a 1 MB+ SDK it may never use.
 */
const WEBLLM_URL = process.env.NEXT_PUBLIC_WEBLLM_URL || 'https://esm.run/@mlc-ai/web-llm';

type Incoming =
  | { type: 'load'; model: string }
  | { type: 'chat'; id: string; model: string; messages: unknown[]; temperature: number; maxTokens: number; json?: boolean }
  | { type: 'abort' }
  | { type: 'catalog' };

interface WebLlmModule {
  CreateMLCEngine: (
    model: string,
    options: { initProgressCallback?: (report: { progress?: number; text?: string }) => void },
  ) => Promise<Engine>;
  prebuiltAppConfig?: { model_list?: Array<{ model_id?: string }> };
}

interface Engine {
  chat: {
    completions: {
      create: (options: Record<string, unknown>) => Promise<AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>>;
    };
  };
  interruptGenerate?: () => void;
  unload?: () => Promise<void>;
}

let webllm: WebLlmModule | null = null;
let engine: Engine | null = null;
let loadedModel = '';

const scope = self as unknown as DedicatedWorkerGlobalScope;

function post(message: unknown) {
  scope.postMessage(message);
}

async function loadModule(): Promise<WebLlmModule> {
  if (!webllm) {
    webllm = (await import(/* webpackIgnore: true */ WEBLLM_URL)) as WebLlmModule;
  }
  return webllm;
}

async function ensureEngine(model: string): Promise<Engine> {
  if (engine && loadedModel === model) return engine;

  const sdk = await loadModule();
  if (engine) {
    try {
      await engine.unload?.();
    } catch {
      /* unloading is best-effort */
    }
    engine = null;
  }

  engine = await sdk.CreateMLCEngine(model, {
    initProgressCallback: (report) => {
      post({ type: 'progress', progress: report.progress ?? 0, text: report.text ?? '' });
    },
  });
  loadedModel = model;
  return engine;
}

scope.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;

  if (message.type === 'catalog') {
    try {
      const sdk = await loadModule();
      const models = (sdk.prebuiltAppConfig?.model_list ?? [])
        .map((entry) => entry.model_id ?? '')
        .filter(Boolean);
      post({ type: 'catalog', models });
    } catch (error) {
      post({ type: 'catalog', models: [], error: String((error as Error)?.message ?? error) });
    }
    return;
  }

  if (message.type === 'load') {
    try {
      await ensureEngine(message.model);
      post({ type: 'ready', model: message.model });
    } catch (error) {
      post({ type: 'error', error: String((error as Error)?.message ?? error) });
    }
    return;
  }

  if (message.type === 'abort') {
    try {
      engine?.interruptGenerate?.();
    } catch {
      /* nothing to interrupt */
    }
    return;
  }

  if (message.type === 'chat') {
    const { id, model, messages, temperature, maxTokens, json } = message;
    try {
      const active = await ensureEngine(model);
      const completion = await active.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      });

      for await (const chunk of completion) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) post({ type: 'delta', id, text });
      }
      post({ type: 'end', id });
    } catch (error) {
      post({ type: 'error', id, error: String((error as Error)?.message ?? error) });
    }
  }
};
