import type { ModelCatalog } from '@/lib/core/types';
import { serverConfig } from '@/lib/server/config';
import { fakeCatalog } from '@/lib/server/fake';
import { listOllamaModels } from '@/lib/server/ollama';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const config = serverConfig();
  const catalog: ModelCatalog = config.fake
    ? fakeCatalog(config.defaultModel)
    : await listOllamaModels();

  return Response.json(catalog, { headers: { 'cache-control': 'no-store' } });
}
