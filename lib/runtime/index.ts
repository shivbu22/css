import type { Runtime, RuntimeId } from '@/lib/core/types';
import { clientRuntime } from './client';
import { serverRuntime } from './server';

/**
 * Which runtime this build uses. `NEXT_PUBLIC_*` is inlined at build time, so the
 * static (`NEXT_PUBLIC_RUNTIME=client`) build never references the route handlers.
 */
export const RUNTIME_ID: RuntimeId = process.env.NEXT_PUBLIC_RUNTIME === 'client' ? 'client' : 'server';

export function getRuntime(id: RuntimeId = RUNTIME_ID): Runtime {
  return id === 'client' ? clientRuntime : serverRuntime;
}
