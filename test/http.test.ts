import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Controller } from '../src/decorators/controller.js';
import { Get, HttpCode, Post } from '../src/decorators/methods.js';
import { Param } from '../src/decorators/params.js';
import { CreateUserDto } from '../src/dto/create-user.dto.js';
import { createApp, type MiniNestApp } from '../src/dispatcher.js';
import { collectRoutes } from '../src/router.js';
import { UsersController } from '../src/users/users.controller.js';
import { UsersService } from '../src/users/users.service.js';

describe('HTTP dispatcher', () => {
  let app: MiniNestApp;
  let baseUrl: string;

  before(async () => {
    app = createApp([UsersController]);
    baseUrl = await app.listen();
  });

  after(async () => {
    await app.close();
  });

  it('joins @Controller prefix with @Get(":id") and answers GET /users/42', async () => {
    const response = await fetch(`${baseUrl}/users/42`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.id, '42');
  });

  it('injects @Param("id") as a handler argument', async () => {
    const response = await fetch(`${baseUrl}/users/42`);
    const body = await response.json();

    assert.match(JSON.stringify(body), /42/);
    assert.equal(body.id, '42');
  });

  it('injects @Query("limit") as a separate handler argument', async () => {
    const response = await fetch(`${baseUrl}/users?limit=5`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.limit, '5');
  });

  it('injects parsed JSON into @Body()', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.name, 'Ada');
    assert.equal(body.email, 'ada@example.com');
  });

  it('rejects an invalid DTO with 400 listing the email field', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    const payload = await response.text();

    assert.equal(response.status, 400);
    assert.match(payload, /email/);
  });

  it('passes a CreateUserDto instance into the handler for a valid body', async () => {
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Grace', email: 'grace@example.com' }),
    });

    assert.equal(response.status, 201);
    const service = app.container.resolve(UsersService);
    assert.ok(service.lastCreated instanceof CreateUserDto);
  });

  it('resolves the controller service as the container singleton', async () => {
    const controller = app.container.resolve(UsersController);
    const service = app.container.resolve(UsersService);

    assert.equal(controller.users, service);
  });

  it('returns 404 for an unknown path', async () => {
    const response = await fetch(`${baseUrl}/nope-zzz`);
    assert.equal(response.status, 404);
  });
});

describe('route metadata isolation', () => {
  it('does not append child routes onto the parent controller', () => {
    @Controller('base')
    class Base {
      @Get('a')
      a() {
        return { via: 'a' };
      }
    }

    @Controller('base')
    class Child extends Base {
      @Get('b')
      b() {
        return { via: 'b' };
      }
    }

    const parent = collectRoutes([Base]).map((route) => route.path);
    const child = collectRoutes([Child]).map((route) => route.path);

    assert.deepEqual(parent, ['/base/a']);
    assert.deepEqual(child, ['/base/b']);
  });
});

describe('static routes win over params', () => {
  let app: MiniNestApp;
  let baseUrl: string;

  before(async () => {
    @Controller('shadow')
    class ShadowController {
      @Get(':id')
      byId(@Param('id') id: string) {
        return { via: 'param', id };
      }

      @Get('me')
      me() {
        return { via: 'static' };
      }
    }

    app = createApp([ShadowController]);
    baseUrl = await app.listen();
  });

  after(async () => {
    await app.close();
  });

  it('matches /shadow/me with the static route even if :id was registered first', async () => {
    const response = await fetch(`${baseUrl}/shadow/me`);
    assert.deepEqual(await response.json(), { via: 'static' });
  });

  it('still binds parametric /shadow/:id', async () => {
    const response = await fetch(`${baseUrl}/shadow/77`);
    assert.deepEqual(await response.json(), { via: 'param', id: '77' });
  });
});

describe('handler status', () => {
  let app: MiniNestApp;
  let baseUrl: string;

  before(async () => {
    @Controller('empty')
    class EmptyController {
      @Post()
      @HttpCode(204)
      noop() {}
    }

    app = createApp([EmptyController]);
    baseUrl = await app.listen();
  });

  after(async () => {
    await app.close();
  });

  it('lets the handler return 204 instead of POST 201', async () => {
    const response = await fetch(`${baseUrl}/empty`, { method: 'POST' });
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
  });
});
