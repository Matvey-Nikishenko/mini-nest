import 'reflect-metadata';
import { INJECT_TOKENS, INJECTABLE, SCOPE } from './tokens.js';
import type { Constructor, Scope, Token } from './types.js';

export class Container {
  private readonly singletons = new Map<Token, unknown>();
  private readonly providers = new Map<Token, unknown>();

  register<T>(token: Token<T>, value: T): this {
    this.providers.set(token, value);
    return this;
  }

  resolve<T>(target: Token<T>, path: string[] = []): T {
    const name = tokenName(target);

    if (this.singletons.has(target)) {
      return this.singletons.get(target) as T;
    }

    if (path.includes(name)) {
      throw new Error(`цикл залежностей: ${[...path, name].join(' -> ')}`);
    }

    if (this.providers.has(target)) {
      return this.providers.get(target) as T;
    }

    if (typeof target !== 'function') {
      throw new Error(`No provider for token ${name}`);
    }

    if (!Reflect.getMetadata(INJECTABLE, target)) {
      throw new Error(`${name} не позначений @Injectable()`);
    }

    const deps = (Reflect.getMetadata('design:paramtypes', target) ?? []) as Token[];
    const injected = (Reflect.getMetadata(INJECT_TOKENS, target) ?? {}) as Record<
      number,
      Token
    >;
    const args = deps.map((dep, index) =>
      this.resolve(injected[index] ?? dep, [...path, name]),
    );

    const instance = new (target as Constructor<T>)(...args);
    const scope = (Reflect.getMetadata(SCOPE, target) as Scope | undefined) ?? 'singleton';

    if (scope === 'singleton') {
      this.singletons.set(target, instance);
    }

    return instance;
  }
}

function tokenName(token: Token): string {
  return typeof token === 'function' ? token.name : String(token);
}
