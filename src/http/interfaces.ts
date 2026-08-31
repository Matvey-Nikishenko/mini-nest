import type { ExecutionContext } from '../http/execution-context.js';

export interface CanActivate {
  canActivate(ctx: ExecutionContext): boolean | Promise<boolean>;
}

export interface Interceptor {
  intercept(ctx: ExecutionContext, next: () => Promise<unknown>): Promise<unknown>;
}

export interface PipeTransform {
  transform(
    value: unknown,
    metadata: { type: string; data?: string; schema?: unknown },
  ): unknown | Promise<unknown>;
}

export interface ExceptionFilter {
  catch(error: unknown, ctx: ExecutionContext): void;
}

export type Middleware = (ctx: ExecutionContext) => void | Promise<void>;
