import { performance } from 'node:perf_hooks';
import { Injectable } from '../decorators/injectable.js';
import type { ExecutionContext } from '../http/execution-context.js';
import type { Interceptor } from '../http/interfaces.js';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  async intercept(ctx: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    const started = performance.now();
    try {
      return await next();
    } finally {
      const ms = (performance.now() - started).toFixed(1);
      const method = (ctx.req.method ?? 'GET').toUpperCase();
      const path = ctx.url.pathname;
      console.log(`${method} ${path} — ${ms} ms`);
    }
  }
}
