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

  resolve<T>(target: Token<T>, path: Set<Token> = new Set()): T {
    if (this.singletons.has(target)) {
      return this.singletons.get(target) as T;
    }

    if (path.has(target)) {
      throw new Error(`цикл залежностей: ${formatPath(path, target)}`);
    }

    if (this.providers.has(target)) {
      return this.providers.get(target) as T;
    }

    if (typeof target !== 'function') {
      throw new Error(`No provider for token ${tokenName(target)}: ${formatPath(path, target)}`);
    }

    if (!Reflect.getOwnMetadata(INJECTABLE, target)) {
      throw new Error(`${tokenName(target)} не позначений @Injectable()`);
    }

    const nextPath = new Set(path);
    nextPath.add(target);

    const deps = (Reflect.getOwnMetadata('design:paramtypes', target) ?? []) as Token[];
    const injected = (Reflect.getOwnMetadata(INJECT_TOKENS, target) ?? {}) as Record<
      number,
      Token
    >;
    const args = deps.map((dep, index) =>
      this.resolve(injected[index] ?? dep, nextPath),
    );

    const instance = new (target as Constructor<T>)(...args);
    const scope = (Reflect.getOwnMetadata(SCOPE, target) as Scope | undefined) ?? 'singleton';

    if (scope === 'singleton') {
      this.singletons.set(target, instance);
    }

    return instance;
  }
}

function tokenName(token: Token): string {
  return typeof token === 'function' ? token.name : String(token);
}

function formatPath(path: Set<Token>, current: Token): string {
  return [...path, current].map(tokenName).join(' -> ');
}
