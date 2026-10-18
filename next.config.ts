import type { NextConfig } from 'next';

/**
 * Two build targets:
 *
 *  - default ("server" runtime): the normal Next app. Server route handlers talk to Ollama.
 *  - NEXT_PUBLIC_RUNTIME=client: a fully static export with no server at all; the model runs
 *    in the browser via WebLLM. `npm run build:static` drives this — it also parks `app/api`
 *    during the build, because `output: 'export'` cannot contain route handlers.
 */
const isClientRuntime = process.env.NEXT_PUBLIC_RUNTIME === 'client';

const nextConfig: NextConfig = {
  output: isClientRuntime ? 'export' : undefined,
  images: { unoptimized: true },
  // Linting runs as its own script (`npm run lint`) so production builds stay fast.
  eslint: { ignoreDuringBuilds: true },
  // Long generations stream through a route handler; keep Next from buffering them.
  experimental: { proxyTimeout: 600_000 },
};

export default nextConfig;
