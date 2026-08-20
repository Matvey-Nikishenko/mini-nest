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

  it('does not treat two classes with the same name as a cycle', () => {
    const DupA = (() => {
      @Injectable()
      class Dup {}
      return Dup;
    })();
    const DupB = (() => {
      @Injectable()
      class Dup {}
      return Dup;
    })();

    @Injectable()
    class Holder {
      constructor(readonly first: object, readonly second: object) {}
    }
    Reflect.defineMetadata('design:paramtypes', [DupA, DupB], Holder);

    const holder = new Container().resolve(Holder);
    assert.ok(holder.first instanceof DupA);
    assert.ok(holder.second instanceof DupB);
  });

  it('does not inherit parent metadata on an undecorated subclass', () => {
    @Injectable()
    class Dep {
      readonly id = 'dep';
    }

    @Injectable()
    class Base {
      constructor(readonly dep: Dep) {}
    }

    class Child extends Base {}

    assert.throws(
      () => new Container().resolve(Child),
      /не позначений @Injectable/,
    );
  });

  it('names the resolve chain when a token has no provider', () => {
    @Injectable()
    class AppService {
      constructor(@Inject(CONFIG) readonly config: object) {}
    }

    assert.throws(
      () => new Container().resolve(AppService),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /No provider for token/);
        assert.match(error.message, /AppService/);
        return true;
      },
    );
  });
});
