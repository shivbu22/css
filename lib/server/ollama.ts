/**
 * Ollama client.
 *
 * Deliberately not the `ollama` SDK: the whole contract is one streaming POST to
 * `/api/chat` plus `/api/tags`, and keeping it as plain fetch means the gateway
 * can be swapped later without touching the engine.
 */
import { errorMessage, type ChatFn, type ChatOptions, type ModelCatalog } from '@/lib/core/types';
import { serverConfig } from './config';

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

export async function listOllamaModels(): Promise<ModelCatalog> {
  const { baseUrl, defaultModel } = serverConfig();

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Ollama responded ${response.status}`);

    const data = (await response.json()) as OllamaTagsResponse;
    const models = (data.models ?? [])
      .map((entry) => entry.name ?? entry.model ?? '')
      .filter(Boolean)
      .sort();

    return {
      models,
      defaultModel: models.includes(defaultModel) ? defaultModel : (models[0] ?? defaultModel),
      reachable: true,
      note: models.length
        ? undefined
        : `Ollama is running but has no models. Pull one: ollama pull ${defaultModel}`,
    };
  } catch (error) {
    return {
      models: [],
      defaultModel,
      reachable: false,
      note: `Cannot reach Ollama at ${baseUrl} (${errorMessage(error)}). Start it with \`ollama serve\`.`,
    };
  }
}

interface OllamaChunk {
  message?: { content?: string };
  done?: boolean;
  error?: string;
}

/** The engine's `ChatFn` for the local runtime. */
export async function* ollamaChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: ChatOptions,
): AsyncGenerator<string> {
  const config = serverConfig();

  const body: Record<string, unknown> = {
    model: options.model || config.defaultModel,
    messages,
    stream: true,
    keep_alive: config.keepAlive,
    options: {
      temperature: options.temperature,
      num_predict: options.maxTokens,
      num_ctx: config.numCtx,
    },
  };
  if (options.json) body.format = 'json';

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    throw new Error(
      `Cannot reach Ollama at ${config.baseUrl}. Start it with \`ollama serve\` (${errorMessage(error)}).`,
    );
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Ollama returned ${response.status} ${detail.slice(0, 300) || ''}`.trim() ||
        'Ollama request failed',
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);

        if (line) {
          let chunk: OllamaChunk;
          try {
            chunk = JSON.parse(line) as OllamaChunk;
          } catch {
            newline = buffer.indexOf('\n');
            continue;
          }
          if (chunk.error) throw new Error(chunk.error);
          const piece = chunk.message?.content;
          if (piece) yield piece;
          if (chunk.done) return;
        }
        newline = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
