export type Constructor<T = unknown> = new (...args: any[]) => T;

export type Token<T = unknown> = Constructor<T> | string | symbol;

export type Scope = 'singleton' | 'transient';

export interface InjectableOptions {
  scope?: Scope;
}
