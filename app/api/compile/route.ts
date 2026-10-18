import { transform } from 'sucrase';
import { errorMessage } from '@/lib/core/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SOURCE = 200_000;

/**
 * JSX/TS → JS for the React preview.
 *
 * `imports` turns the component's ESM into CommonJS, which the preview's tiny
 * module loader feeds from the React UMD globals — no bundler anywhere.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const code = typeof (payload as { code?: unknown })?.code === 'string' ? (payload as { code: string }).code : '';
  if (!code.trim()) {
    return Response.json({ error: 'code is required.' }, { status: 400 });
  }
  if (code.length > MAX_SOURCE) {
    return Response.json({ error: 'Source is too large to compile.' }, { status: 413 });
  }

  try {
    const result = transform(code, {
      transforms: ['jsx', 'typescript', 'imports'],
      production: true,
      filePath: 'Component.jsx',
    });
    return Response.json({ js: result.code });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 422 });
  }
}
