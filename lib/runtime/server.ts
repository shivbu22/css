import {
  errorMessage,
  type GenerateEvent,
  type ModelCatalog,
  type Runtime,
} from '@/lib/core/types';

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function consumeNdjson(
  response: Response,
  onEvent: (event: GenerateEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!response.body) throw new Error('The server returned no stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf('\n');
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as GenerateEvent);
        } catch {
          /* a truncated line at the end of a stream is not worth failing over */
        }
      }
      newline = buffer.indexOf('\n');
    }
  }

  if (signal?.aborted) throw new Error('Cancelled');
}

export const serverRuntime: Runtime = {
  id: 'server',
  label: 'Local Ollama',
  placement: 'Generated on this machine through Next route handlers',

  async models(): Promise<ModelCatalog> {
    try {
      const response = await fetch('/api/models', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readError(response));
      return (await response.json()) as ModelCatalog;
    } catch (error) {
      return { models: [], defaultModel: '', reachable: false, note: errorMessage(error) };
    }
  },

  async generate(request, sink, signal) {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) throw new Error(await readError(response));
    await consumeNdjson(response, sink, signal);
  },

  async compile(code) {
    const response = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { js?: string };
    if (!data.js) throw new Error('The compiler returned nothing.');
    return data.js;
  },
};
