import 'reflect-metadata';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Container } from './container.js';
import { collectRoutes, matchRoute, type CompiledRoute } from './router.js';
import { HTTP_CODE, USE_FILTERS, USE_GUARDS, USE_INTERCEPTORS, USE_PIPES } from './tokens.js';
import type { Constructor } from './types.js';
import { getRequestId, resolveRequestId, runWithRequestContext } from './context/request-context.js';
import { NotFoundError, ValidationError } from './errors.js';
import { AppExceptionFilter } from './filters/exception.filter.js';
import { ExecutionContext } from './http/execution-context.js';
import type {
  CanActivate,
  ExceptionFilter,
  Interceptor,
  Middleware,
  PipeTransform,
} from './http/interfaces.js';
import { LoggingInterceptor } from './interceptors/logging.interceptor.js';
import { ZodValidationPipe } from './pipes/zod-validation.pipe.js';

export interface CreateAppOptions {
  controllers: Constructor[];
  container?: Container;
  middleware?: Middleware[];
  guards?: Array<CanActivate | Constructor<CanActivate>>;
  interceptors?: Array<Interceptor | Constructor<Interceptor>>;
  pipes?: Array<PipeTransform | Constructor<PipeTransform>>;
  filters?: Array<ExceptionFilter | Constructor<ExceptionFilter>>;
}

export interface MiniNestApp {
  server: Server;
  container: Container;
  listen: (port?: number) => Promise<string>;
  close: () => Promise<void>;
}

const defaultPipe = new ZodValidationPipe();
const defaultInterceptor = new LoggingInterceptor();
const defaultFilter = new AppExceptionFilter();

export function createApp(
  controllersOrOptions: Constructor[] | CreateAppOptions,
  containerArg?: Container,
): MiniNestApp {
  const options = normalizeOptions(controllersOrOptions, containerArg);
  const container = options.container ?? new Container();
  const routes = collectRoutes(options.controllers);
  const middleware = options.middleware ?? [];
  const globalGuards = options.guards ?? [];
  const globalInterceptors = options.interceptors ?? [defaultInterceptor];
  const globalPipes = options.pipes ?? [defaultPipe];
  const filters = options.filters ?? [defaultFilter];

  const server = createServer((req, res) => {
    void handle({
      req,
      res,
      routes,
      container,
      middleware,
      globalGuards,
      globalInterceptors,
      globalPipes,
      filters,
    });
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

function normalizeOptions(
  controllersOrOptions: Constructor[] | CreateAppOptions,
  container?: Container,
): CreateAppOptions {
  if (Array.isArray(controllersOrOptions)) {
    return { controllers: controllersOrOptions, container };
  }
  return controllersOrOptions;
}

async function handle(args: {
  req: IncomingMessage;
  res: ServerResponse;
  routes: CompiledRoute[];
  container: Container;
  middleware: Middleware[];
  globalGuards: Array<CanActivate | Constructor<CanActivate>>;
  globalInterceptors: Array<Interceptor | Constructor<Interceptor>>;
  globalPipes: Array<PipeTransform | Constructor<PipeTransform>>;
  filters: Array<ExceptionFilter | Constructor<ExceptionFilter>>;
}): Promise<void> {
  const requestId = resolveRequestId(args.req.headers['x-request-id']);
  const url = new URL(args.req.url ?? '/', 'http://127.0.0.1');
  const ctx = new ExecutionContext(args.req, args.res, url, args.container);

  await runWithRequestContext(requestId, async () => {
    try {
      for (const hook of args.middleware) {
        await hook(ctx);
      }

      const matched = matchRoute(args.routes, args.req.method ?? 'GET', url.pathname);
      if (!matched) {
        throw new NotFoundError(`Cannot ${args.req.method ?? 'GET'} ${url.pathname}`);
      }
      ctx.match = matched;

      const allowed = await runGuards(ctx, args.globalGuards);
      if (!allowed) {
        sendJson(args.res, 403, { statusCode: 403, message: 'Forbidden' });
        return;
      }

      ctx.body = await readBody(args.req);
      const result = await runInterceptors(ctx, args.globalInterceptors, () =>
        invokeHandler(ctx, args.globalPipes),
      );
      serialize(ctx, result);
    } catch (error) {
      const filter = pickFilter(ctx, args.filters, args.container);
      filter.catch(error, ctx);
    }
  });
}

function pickFilter(
  ctx: ExecutionContext,
  globalFilters: Array<ExceptionFilter | Constructor<ExceptionFilter>>,
  container: Container,
): ExceptionFilter {
  const refs = ctx.match
    ? [
        ...globalFilters,
        ...readHooks<ExceptionFilter | Constructor<ExceptionFilter>>(
          USE_FILTERS,
          ctx.match.route.controller,
          ctx.match.route.handlerName,
        ),
      ]
    : globalFilters;
  const chosen = refs.at(-1) ?? defaultFilter;
  return resolveHook(chosen, container, (value): value is ExceptionFilter =>
    typeof value === 'object' && value !== null && 'catch' in value,
  );
}

async function runGuards(
  ctx: ExecutionContext,
  globalGuards: Array<CanActivate | Constructor<CanActivate>>,
): Promise<boolean> {
  const route = ctx.match!.route;
  const refs = [
    ...globalGuards,
    ...readHooks<CanActivate | Constructor<CanActivate>>(USE_GUARDS, route.controller, route.handlerName),
  ];
  for (const ref of refs) {
    const guard = resolveHook(ref, ctx.container, (value): value is CanActivate =>
      typeof value === 'object' && value !== null && 'canActivate' in value,
    );
    const allowed = await guard.canActivate(ctx);
    if (!allowed) {
      return false;
    }
  }
  return true;
}

async function runInterceptors(
  ctx: ExecutionContext,
  globalInterceptors: Array<Interceptor | Constructor<Interceptor>>,
  core: () => Promise<unknown>,
): Promise<unknown> {
  const route = ctx.match!.route;
  const refs = [
    ...globalInterceptors,
    ...readHooks<Interceptor | Constructor<Interceptor>>(
      USE_INTERCEPTORS,
      route.controller,
      route.handlerName,
    ),
  ];
  const interceptors = refs.map((ref) =>
    resolveHook(ref, ctx.container, (value): value is Interceptor =>
      typeof value === 'object' && value !== null && 'intercept' in value,
    ),
  );

  const invoke = interceptors.reduceRight<() => Promise<unknown>>(
    (next, interceptor) => () => interceptor.intercept(ctx, next),
    core,
  );
  return invoke();
}

async function invokeHandler(
  ctx: ExecutionContext,
  globalPipes: Array<PipeTransform | Constructor<PipeTransform>>,
): Promise<unknown> {
  const { route, pathParams } = ctx.match!;
  const controller = ctx.container.resolve(route.controller) as Record<
    string,
    (...args: unknown[]) => unknown
  >;
  const args = await buildArgs(ctx, globalPipes, pathParams);
  return controller[route.handlerName](...args);
}

async function buildArgs(
  ctx: ExecutionContext,
  globalPipes: Array<PipeTransform | Constructor<PipeTransform>>,
  pathParams: Record<string, string>,
): Promise<unknown[]> {
  const route = ctx.match!.route;
  const indexes = Object.keys(route.params).map(Number);
  const args: unknown[] = [];
  const pipes = [
    ...globalPipes,
    ...readHooks<PipeTransform | Constructor<PipeTransform>>(
      USE_PIPES,
      route.controller,
      route.handlerName,
    ),
  ].map((ref) =>
    resolveHook(ref, ctx.container, (value): value is PipeTransform =>
      typeof value === 'object' && value !== null && 'transform' in value,
    ),
  );

  for (const index of indexes) {
    const meta = route.params[index];
    if (!meta) {
      continue;
    }

    let value: unknown;
    if (meta.type === 'param') {
      value = pathParams[meta.name ?? ''];
    } else if (meta.type === 'query') {
      value = ctx.url.searchParams.get(meta.name ?? '') ?? undefined;
    } else {
      value = ctx.body;
    }

    for (const pipe of pipes) {
      value = await pipe.transform(value, {
        type: meta.type,
        data: meta.name,
        schema: meta.schema,
      });
    }
    args[index] = value;
  }

  return args;
}

function serialize(ctx: ExecutionContext, result: unknown): void {
  const route = ctx.match!.route;
  const explicit = Reflect.getOwnMetadata(
    HTTP_CODE,
    route.controller.prototype,
    route.handlerName,
  ) as number | undefined;
  const status =
    typeof explicit === 'number'
      ? explicit
      : result === undefined
        ? 204
        : ctx.req.method === 'POST'
          ? 201
          : 200;

  if (status === 204) {
    ctx.res.writeHead(204, requestHeaders());
    ctx.res.end();
    return;
  }
  sendJson(ctx.res, status, result);
}

function readHooks<T>(key: symbol, controller: Constructor, handlerName: string): T[] {
  const fromClass = (Reflect.getOwnMetadata(key, controller) ?? []) as T[];
  const fromMethod = (Reflect.getOwnMetadata(key, controller.prototype, handlerName) ?? []) as T[];
  return [...fromClass, ...fromMethod];
}

function resolveHook<T>(
  ref: T | Constructor<T>,
  container: Container,
  isInstance: (value: unknown) => value is T,
): T {
  if (isInstance(ref)) {
    return ref;
  }
  if (typeof ref === 'function') {
    try {
      return container.resolve(ref as Constructor<T>);
    } catch {
      return new (ref as Constructor<T>)();
    }
  }
  return ref;
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
        reject(new ValidationError([{ field: 'body', constraints: ['Invalid JSON'] }]));
      }
    });
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload ?? null);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...requestHeaders(),
  });
  res.end(body);
}

function requestHeaders(): Record<string, string> {
  const requestId = getRequestId();
  return requestId ? { 'x-request-id': requestId } : {};
}
