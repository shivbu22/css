/**
 * Portable signal plumbing: `AbortSignal.any` / `AbortSignal.timeout` are newer
 * than some of the runtimes this code has to survive in, so the small pieces we
 * actually need are built here by hand. Isomorphic — no Node APIs.
 */

export interface LinkedSignal {
  signal: AbortSignal;
  dispose: () => void;
}

export function linkSignals(...signals: (AbortSignal | undefined)[]): LinkedSignal {
  const controller = new AbortController();
  const listeners: Array<() => void> = [];

  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    const onAbort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', onAbort, { once: true });
    listeners.push(() => signal.removeEventListener('abort', onAbort));
  }

  return {
    signal: controller.signal,
    dispose: () => listeners.forEach((off) => off()),
  };
}

export function timeoutSignal(ms: number, reason = `Timed out after ${Math.round(ms / 1000)}s`): LinkedSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(reason)), ms);
  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timer),
  };
}

export function abortReasonMessage(signal: AbortSignal, fallback = 'Cancelled'): string {
  const reason = signal.reason;
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string' && reason) return reason;
  return fallback;
}
