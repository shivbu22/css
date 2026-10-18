/**
 * In-memory sliding-window limiter.
 *
 * Good enough for a single local process, which is exactly the footprint of the
 * server runtime. A hosted deployment would move this to Redis next to the GPU
 * host — noted in the README rather than pretended otherwise.
 */
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limitPerMinute: number): RateLimitResult {
  if (limitPerMinute <= 0) return { ok: true, remaining: Infinity, retryAfterSeconds: 0 };

  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((at) => at > windowStart);

  if (recent.length >= limitPerMinute) {
    hits.set(key, recent);
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000)),
    };
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 500) {
    for (const [entryKey, times] of hits) {
      if (!times.some((at) => at > windowStart)) hits.delete(entryKey);
    }
  }

  return { ok: true, remaining: limitPerMinute - recent.length, retryAfterSeconds: 0 };
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || 'local';
}
