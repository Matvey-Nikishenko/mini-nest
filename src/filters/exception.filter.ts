import type { ExecutionContext } from '../http/execution-context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import type { ExceptionFilter } from '../http/interfaces.js';
import { getRequestId } from '../context/request-context.js';

export class AppExceptionFilter implements ExceptionFilter {
  catch(error: unknown, ctx: ExecutionContext): void {
    if (error instanceof ValidationError) {
      send(ctx, 400, { statusCode: 400, errors: error.errors });
      return;
    }
    if (error instanceof NotFoundError) {
      send(ctx, 404, { statusCode: 404, message: error.message });
      return;
    }
    send(ctx, 500, { statusCode: 500, message: 'Internal Server Error' });
  }
}

function send(ctx: ExecutionContext, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  const requestId = getRequestId();
  ctx.res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...(requestId ? { 'x-request-id': requestId } : {}),
  });
  ctx.res.end(body);
}
