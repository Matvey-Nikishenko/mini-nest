import 'reflect-metadata';
import { CONTROLLER_PREFIX, ROUTE_PARAMS, ROUTES } from './tokens.js';
import type { Constructor, HttpMethod, RouteMeta, RouteParamsMap } from './types.js';

export interface CompiledRoute {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  controller: Constructor;
  handlerName: string;
  params: RouteParamsMap;
}

export function joinPath(prefix: string, path: string): string {
  const parts = [prefix, path]
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

export function pathToPattern(fullPath: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const source = fullPath.replace(/:([A-Za-z_][\w]*)/g, (_match, name: string) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${source}$`), paramNames };
}

export function collectRoutes(controllers: Constructor[]): CompiledRoute[] {
  const compiled: CompiledRoute[] = [];

  for (const controller of controllers) {
    const prefix = (Reflect.getMetadata(CONTROLLER_PREFIX, controller) ?? '') as string;
    const routes = (Reflect.getMetadata(ROUTES, controller) ?? []) as RouteMeta[];

    for (const route of routes) {
      const fullPath = joinPath(prefix, route.path);
      const { pattern, paramNames } = pathToPattern(fullPath);
      const params = (Reflect.getMetadata(
        ROUTE_PARAMS,
        controller.prototype,
        route.handlerName,
      ) ?? {}) as RouteParamsMap;

      compiled.push({
        method: route.method,
        path: fullPath,
        pattern,
        paramNames,
        controller,
        handlerName: route.handlerName,
        params,
      });
    }
  }

  return compiled;
}

export function matchRoute(
  routes: CompiledRoute[],
  method: string,
  pathname: string,
): { route: CompiledRoute; pathParams: Record<string, string> } | undefined {
  for (const route of routes) {
    if (route.method !== method.toUpperCase()) {
      continue;
    }
    const matched = pathname.match(route.pattern);
    if (!matched) {
      continue;
    }
    const pathParams: Record<string, string> = {};
    route.paramNames.forEach((name, index) => {
      pathParams[name] = decodeURIComponent(matched[index + 1] ?? '');
    });
    return { route, pathParams };
  }
}
