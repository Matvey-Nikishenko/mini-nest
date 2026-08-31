import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type RequestStore = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestStore>();

export function resolveRequestId(header: string | string[] | undefined): string {
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  return randomUUID();
}

export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
