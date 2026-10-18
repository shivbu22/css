import type { GenerateEvent, GenerateRequest } from '@/lib/core/types';
import { runGeneration } from '@/lib/core/orchestrate';
import { serverConfig } from '@/lib/server/config';
import { fakeChat } from '@/lib/server/fake';
import { ollamaChat } from '@/lib/server/ollama';
import { clientKey, rateLimit } from '@/lib/server/rateLimit';
import { GenerateRequestSchema } from '@/lib/server/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = {
  'content-type': 'application/x-ndjson; charset=utf-8',
  'cache-control': 'no-cache, no-transform',
  'x-accel-buffering': 'no',
} as const;

export async function POST(request: Request) {
  const config = serverConfig();

  const limit = rateLimit(`${clientKey(request)}:generate`, config.rateLimitPerMin);
  if (!limit.ok) {
    return Response.json(
      { error: `Too many requests — try again in ${limit.retryAfterSeconds}s.` },
      { status: 429, headers: { 'retry-after': String(limit.retryAfterSeconds) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const parsed = GenerateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json(
      { error: `${issue.path.join('.') || 'body'}: ${issue.message}` },
      { status: 400 },
    );
  }

  const runRequest: GenerateRequest = {
    ...parsed.data,
    model: config.fake ? 'demo' : parsed.data.model || config.defaultModel,
    quality: parsed.data.quality ?? 'draft',
  };

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const emit = (event: GenerateEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      };

      runGeneration(runRequest, {
        chat: config.fake ? fakeChat : ollamaChat,
        emit,
        signal: request.signal,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeoutMs: config.timeoutMs,
      })
        .catch((error: unknown) => {
          emit({
            type: 'error',
            error: error instanceof Error ? error.message : 'Generation failed.',
          });
        })
        .finally(finish);
    },
    cancel() {
      /* the engine observes request.signal */
    },
  });

  return new Response(body, { headers: HEADERS });
}
