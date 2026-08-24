import 'reflect-metadata';
import { ROUTES } from '../tokens.js';
import type { HttpMethod, RouteMeta } from '../types.js';

function Route(method: HttpMethod, path = ''): MethodDecorator {
  return (target, propertyKey) => {
    const ctor = (target as object).constructor;
    const routes: RouteMeta[] = Reflect.getMetadata(ROUTES, ctor) ?? [];
    routes.push({ method, path, handlerName: String(propertyKey) });
    Reflect.defineMetadata(ROUTES, routes, ctor);
  };
}

export const Get = (path = ''): MethodDecorator => Route('GET', path);
export const Post = (path = ''): MethodDecorator => Route('POST', path);
