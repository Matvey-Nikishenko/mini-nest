import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Container } from '../src/container.js';
import { Inject } from '../src/decorators/inject.js';
import { Injectable } from '../src/decorators/injectable.js';
import { CONFIG } from '../src/tokens.js';

describe('Container', () => {
  it('resolves a recursive graph A → B → C', () => {
    @Injectable()
    class C {
      readonly id = 'C';
    }

    @Injectable()
    class B {
      constructor(readonly c: C) {}
    }

    @Injectable()
    class A {
      constructor(readonly b: B) {}
    }

    const a = new Container().resolve(A);

    assert.ok(a instanceof A);
    assert.ok(a.b instanceof B);
    assert.equal(a.b.c.id, 'C');
  });

  it('returns the same instance for singleton (default scope)', () => {
    @Injectable()
    class X {}

    const container = new Container();
    assert.equal(container.resolve(X), container.resolve(X));
  });

  it('returns a new instance for @Injectable({ scope: "transient" })', () => {
    @Injectable({ scope: 'transient' })
    class X {}

    const container = new Container();
    assert.notEqual(container.resolve(X), container.resolve(X));
  });

  it('resolves @Inject(token) by token, not by TypeScript type', () => {
    const config = { host: 'localhost', port: 3000 };

    @Injectable()
    class AppService {
      constructor(@Inject(CONFIG) readonly config: { host: string; port: number }) {}
    }

    const container = new Container();
    container.register(CONFIG, config);

    const service = container.resolve(AppService);
    assert.equal(service.config, config);
    assert.equal(container.resolve(CONFIG), config);
  });

  it('throws a readable chain on A → B → A, not RangeError', () => {
    @Injectable()
    class A {
      constructor(_b: unknown) {}
    }

    @Injectable()
    class B {
      constructor(readonly a: A) {}
    }

    Reflect.defineMetadata('design:paramtypes', [B], A);

    assert.throws(
      () => new Container().resolve(A),
      (error: unknown) => {
        assert.ok(!(error instanceof RangeError));
        assert.ok(error instanceof Error);
        assert.match(error.message, /A -> B -> A/);
        return true;
      },
    );
  });
});
