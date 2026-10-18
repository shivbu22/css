/** Server-only configuration. Never import this from a client component. */

export interface ServerConfig {
  baseUrl: string;
  defaultModel: string;
  numCtx: number;
  keepAlive: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  rateLimitPerMin: number;
  /** Serve canned generations instead of calling a model. */
  fake: boolean;
}

function intFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function serverConfig(): ServerConfig {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:11434',
    defaultModel: process.env.OLLAMA_MODEL || 'qwen3-coder',
    numCtx: intFromEnv(process.env.OLLAMA_NUM_CTX, 8192),
    keepAlive: process.env.OLLAMA_KEEP_ALIVE || '15m',
    temperature: Number(process.env.GENERATION_TEMPERATURE ?? 0.2),
    maxTokens: intFromEnv(process.env.MAX_TARGET_TOKENS, 2048),
    timeoutMs: intFromEnv(process.env.TARGET_TIMEOUT_MS, 240_000),
    rateLimitPerMin: intFromEnv(process.env.GENERATE_RATE_LIMIT_PER_MIN, 30),
    fake: process.env.QUINTET_FAKE === '1',
  };
}
