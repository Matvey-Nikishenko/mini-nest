export type Constructor<T = unknown> = new (...args: any[]) => T;

export type Token<T = unknown> = Constructor<T> | string | symbol;

export type Scope = 'singleton' | 'transient';

export interface InjectableOptions {
  scope?: Scope;
}

export type HttpMethod = 'GET' | 'POST';

export type ParamSource = 'body' | 'param' | 'query';

export interface RouteParamMeta {
  type: ParamSource;
  name?: string;
  schema?: unknown;
}

export type RouteParamsMap = Record<number, RouteParamMeta>;

export interface RouteMeta {
  method: HttpMethod;
  path: string;
  handlerName: string;
}
