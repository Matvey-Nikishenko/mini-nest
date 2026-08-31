import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Controller } from '../src/decorators/controller.js';
import { Get } from '../src/decorators/methods.js';
import { Param } from '../src/decorators/params.js';
import { UseFilters, UseGuards, UseInterceptors, UsePipes } from '../src/decorators/use-hooks.js';
import { Injectable } from '../src/decorators/injectable.js';
import { createApp, type MiniNestApp } from '../src/dispatcher.js';
import { NotFoundError } from '../src/errors.js';
import { AuthGuard } from '../src/guards/auth.guard.js';
import type { ExecutionContext } from '../src/http/execution-context.js';
import type { CanActivate, ExceptionFilter, Interceptor, PipeTransform } from '../src/http/interfaces.js';
import { UsersController } from '../src/users/users.controller.js';
import { UsersService } from '../src/users/users.service.js';

export const lifecycleLog: string[] = [];

function log(line: string): void {
  lifecycleLog.push(line);
}

function resetLog(): void {
  lifecycleLog.length = 0;
}

async function waitForLog(length: number): Promise<void> {
  for (let i = 0; i < 50 && lifecycleLog.length < length; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function orderMiddleware(ctx: ExecutionContext): void {
  log('1 → middleware (вхід: сирі req/res, контролер ще невідомий)');
  ctx.res.on('finish', () => log('1 ← middleware (finish: відповідь уже пішла клієнту)'));
}

@Injectable()
class OrderGuard implements CanActivate {
  canActivate(): boolean {
    log('2 → guard (canActivate: пускати?)');
    log('2 ← guard (true — пускаємо)');
    return true;
  }
}

@Injectable()
class OrderInterceptor implements Interceptor {
  async intercept(_ctx: ExecutionContext, next: () => Promise<unknown>): Promise<unknown> {
    log('3 → interceptor (до handler)');
    const result = await next();
    log('3 ← interceptor (після handler: бачу відповідь)');
    return result;
  }
}

@Injectable()
class OrderPipe implements PipeTransform {
  transform(value: unknown): number {
    log(`4 → pipe ("${String(value)}" → number)`);
    const id = Number(value);
    log(`4 ← pipe (віддаю ${id})`);
    return id;
  }
}

@Injectable()
class OrderFilter implements ExceptionFilter {
  catch(error: unknown, ctx: ExecutionContext): void {
    const message = error instanceof Error ? error.message : 'error';
    log(`6 → filter (спіймав "${message}" → 500)`);
    const body = JSON.stringify({ statusCode: 500, message: 'Internal server error' });
    ctx.res.writeHead(500, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(body),
    });
    ctx.res.end(body);
  }
}

@Controller()
@UseFilters(OrderFilter)
class OrderController {
  @Get('order/:id')
  @UseGuards(OrderGuard)
  @UseInterceptors(OrderInterceptor)
  @UsePipes(OrderPipe)
  getOrder(@Param('id') id: number): { id: number; ok: boolean } {
    log(`5 → handler (id=${id}, typeof ${typeof id})`);
    if (id === 0) {
      throw new Error('handler впав');
    }
    log('5 ← handler (return обʼєкт)');
    return { id, ok: true };
  }
}

describe('Lifecycle (лекція 8, крок 1)', () => {
  let app: MiniNestApp;
  let baseUrl: string;

  before(async () => {
    app = createApp({
      controllers: [OrderController],
      middleware: [orderMiddleware],
      interceptors: [],
      pipes: [],
    });
    baseUrl = await app.listen();
  });

  after(async () => {
    await app.close();
  });

  beforeEach(() => resetLog());

  it('happy path: middleware → guard → interceptor → pipe → handler → interceptor ← middleware', async () => {
    const response = await fetch(`${baseUrl}/order/42`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { id: 42, ok: true });

    await waitForLog(10);
    assert.deepEqual(lifecycleLog, [
      '1 → middleware (вхід: сирі req/res, контролер ще невідомий)',
      '2 → guard (canActivate: пускати?)',
      '2 ← guard (true — пускаємо)',
      '3 → interceptor (до handler)',
      '4 → pipe ("42" → number)',
      '4 ← pipe (віддаю 42)',
      '5 → handler (id=42, typeof number)',
      '5 ← handler (return обʼєкт)',
      '3 ← interceptor (після handler: бачу відповідь)',
      '1 ← middleware (finish: відповідь уже пішла клієнту)',
    ]);
  });

  it('handler кидає: «після»-гілки interceptor-а НЕМАЄ, замість неї — filter', async () => {
    const response = await fetch(`${baseUrl}/order/0`);
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(body, { statusCode: 500, message: 'Internal server error' });

    await waitForLog(9);
    assert.deepEqual(lifecycleLog, [
      '1 → middleware (вхід: сирі req/res, контролер ще невідомий)',
      '2 → guard (canActivate: пускати?)',
      '2 ← guard (true — пускаємо)',
      '3 → interceptor (до handler)',
      '4 → pipe ("0" → number)',
      '4 ← pipe (віддаю 0)',
      '5 → handler (id=0, typeof number)',
      '6 → filter (спіймав "handler впав" → 500)',
      '1 ← middleware (finish: відповідь уже пішла клієнту)',
    ]);
    assert.equal(lifecycleLog.includes('5 ← handler (return обʼєкт)'), false);
    assert.equal(lifecycleLog.includes('3 ← interceptor (після handler: бачу відповідь)'), false);
  });
});

describe('lifecycle behaviors', () => {
  let app: MiniNestApp;
  let baseUrl: string;

  @Controller('boom')
  class BoomController {
    @Get()
    explode() {
      throw new Error('boom');
    }
  }

  @Controller('items')
  class ItemsController {
    @Get(':id')
    one() {
      throw new NotFoundError('Item missing');
    }
  }

  @Controller('secure')
  class SecureController {
    calls = 0;

    @Get()
    @UseGuards(AuthGuard)
    secret() {
      this.calls += 1;
      return { ok: true };
    }
  }

  before(async () => {
    app = createApp([UsersController, BoomController, ItemsController, SecureController]);
    baseUrl = await app.listen();
  });

  after(async () => {
    await app.close();
  });

  it('blocks at the guard before the handler when Authorization is missing', async () => {
    const controller = app.container.resolve(SecureController);
    controller.calls = 0;
    const response = await fetch(`${baseUrl}/secure`);
    assert.equal(response.status, 403);
    assert.equal(controller.calls, 0);
  });

  it('lets the handler run when Authorization is present', async () => {
    const response = await fetch(`${baseUrl}/secure`, {
      headers: { authorization: 'Bearer test' },
    });
    assert.equal(response.status, 200);
  });

  it('logs interceptor duration with method, path and milliseconds', async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
    try {
      await fetch(`${baseUrl}/users/1`);
    } finally {
      console.log = original;
    }
    assert.match(lines.join('\n'), /[0-9]+(\.[0-9]+)? ?ms/);
    assert.match(lines.join('\n'), /GET \/users\/1/);
  });

  it('maps unexpected errors to 500 without leaking the message or stack', async () => {
    const response = await fetch(`${baseUrl}/boom`);
    const payload = await response.text();
    assert.equal(response.status, 500);
    assert.doesNotMatch(payload, /boom|at .*\.ts:/);
  });

  it('maps NotFoundError to 404 with a meaningful message', async () => {
    const response = await fetch(`${baseUrl}/items/missing`);
    const payload = await response.text();
    assert.equal(response.status, 404);
    assert.match(payload, /Item missing/);
  });

  it('echoes X-Request-Id from the client and exposes it two levels below the handler', async () => {
    const response = await fetch(`${baseUrl}/users/1`, {
      headers: { 'x-request-id': 'req-fixed-1' },
    });
    const body = await response.json();
    assert.equal(response.headers.get('x-request-id'), 'req-fixed-1');
    assert.equal(body.requestId, 'req-fixed-1');
  });

  it('does not mix request ids across 10 concurrent requests', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `req-${index}`);
    const responses = await Promise.all(
      ids.map((id) =>
        fetch(`${baseUrl}/users/1`, { headers: { 'x-request-id': id } }).then(async (response) => ({
          header: response.headers.get('x-request-id'),
          body: await response.json(),
        })),
      ),
    );

    for (const [index, result] of responses.entries()) {
      assert.equal(result.header, ids[index]);
      assert.equal(result.body.requestId, ids[index]);
    }
  });

  it('does not call UsersService.create when AuthGuard rejects POST /users', async () => {
    const service = app.container.resolve(UsersService);
    const before = service.createCalls;
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    });
    assert.equal(response.status, 403);
    assert.equal(service.createCalls, before);
  });
});
