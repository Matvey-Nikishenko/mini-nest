import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { CreateUserDto } from '../src/dto/create-user.dto.js';
import { createApp, type MiniNestApp } from '../src/dispatcher.js';
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
});
