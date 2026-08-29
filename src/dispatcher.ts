import 'reflect-metadata';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Container } from './container.js';
import { collectRoutes, matchRoute, type CompiledRoute } from './router.js';
import { ValidationError, ValidationPipe } from './pipes/validation.pipe.js';
import { HTTP_CODE } from './tokens.js';
import type { Constructor } from './types.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface MiniNestApp {
  server: Server;
  container: Container;
  listen: (port?: number) => Promise<string>;
  close: () => Promise<void>;
}

type RequestContext = {
  req: IncomingMessage;
  res: ServerResponse;
  routes: CompiledRoute[];
  container: Container;
  url: URL;
  match?: { route: CompiledRoute; pathParams: Record<string, string> };
  body?: unknown;
  result?: unknown;
};

const pipe = new ValidationPipe();

export function createApp(
  controllers: Constructor[],
  container = new Container(),
): MiniNestApp {
  const routes = collectRoutes(controllers);
  const server = createServer((req, res) => {
    void handle(req, res, routes, container);
  });

  return {
    server,
    container,
    listen(port = 0) {
      return new Promise((resolve, reject) => {
        server.listen(port, '127.0.0.1', () => {
          const address = server.address();
          if (!address || typeof address === 'string') {
            reject(new Error('Failed to bind HTTP server'));
            return;
          }
          resolve(`http://127.0.0.1:${address.port}`);
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  routes: CompiledRoute[],
  container: Container,
): Promise<void> {
  const ctx: RequestContext = {
    req,
    res,
    routes,
    container,
    url: new URL(req.url ?? '/', 'http://127.0.0.1'),
  };

  try {
    matchStage(ctx);
    ctx.body = await readBody(ctx.req);
    ctx.result = await invokeStage(ctx);
    serializeStage(ctx);
  } catch (error) {
    writeError(res, error);
  }
}

function matchStage(ctx: RequestContext): void {
  const matched = matchRoute(ctx.routes, ctx.req.method ?? 'GET', ctx.url.pathname);
  if (!matched) {
    throw new HttpError(404, 'Not Found');
  }
  ctx.match = matched;
}

async function invokeStage(ctx: RequestContext): Promise<unknown> {
  const { route, pathParams } = ctx.match!;
  const controller = ctx.container.resolve(route.controller) as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  const args = await buildArgs(route, {
    body: ctx.body,
    pathParams,
    query: ctx.url.searchParams,
  });
  return controller[route.handlerName](...args);
}

function serializeStage(ctx: RequestContext): void {
  const status = resolveStatus(ctx);
  if (status === 204) {
    ctx.res.writeHead(204);
    ctx.res.end();
    return;
  }
  sendJson(ctx.res, status, ctx.result);
}

function resolveStatus(ctx: RequestContext): number {
  const route = ctx.match!.route;
  const explicit = Reflect.getOwnMetadata(
    HTTP_CODE,
    route.controller.prototype,
    route.handlerName,
  ) as number | undefined;
  if (typeof explicit === 'number') {
    return explicit;
  }
  if (ctx.result === undefined) {
    return 204;
  }
  return ctx.req.method === 'POST' ? 201 : 200;
}

async function buildArgs(
  route: CompiledRoute,
  ctx: {
    body: unknown;
    pathParams: Record<string, string>;
    query: URLSearchParams;
  },
): Promise<unknown[]> {
  const indexes = Object.keys(route.params).map(Number);
  const args: unknown[] = [];
  const paramtypes = (Reflect.getMetadata(
    'design:paramtypes',
    route.controller.prototype,
    route.handlerName,
  ) ?? []) as Constructor[];

  for (const index of indexes) {
    const meta = route.params[index];
    if (!meta) {
      continue;
    }

    if (meta.type === 'param') {
      args[index] = ctx.pathParams[meta.name ?? ''];
    } else if (meta.type === 'query') {
      args[index] = ctx.query.get(meta.name ?? '') ?? undefined;
    } else {
      args[index] = await pipe.transform(ctx.body, paramtypes[index]);
    }
  }

  return args;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Invalid JSON'));
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload ?? null);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof ValidationError) {
    sendJson(res, 400, { statusCode: 400, errors: error.errors });
    return;
  }
  if (error instanceof HttpError) {
    sendJson(res, error.status, { statusCode: error.status, message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  sendJson(res, 500, { statusCode: 500, message });
}
