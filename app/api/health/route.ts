import { serverConfig } from '@/lib/server/config';
import { listOllamaModels } from '@/lib/server/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = serverConfig();

  if (config.fake) {
    return Response.json({
      ok: true,
      runtime: 'server',
      fake: true,
      model: 'demo',
      reachable: true,
      note: 'Demo mode: canned generations, no model calls.',
    });
  }

  const catalog = await listOllamaModels();
  return Response.json(
    {
      ok: catalog.reachable,
      runtime: 'server',
      fake: false,
      baseUrl: config.baseUrl,
      model: catalog.defaultModel,
      models: catalog.models.length,
      reachable: catalog.reachable,
      note: catalog.note,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
