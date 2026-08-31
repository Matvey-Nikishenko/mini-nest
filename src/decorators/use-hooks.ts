import 'reflect-metadata';
import { USE_FILTERS, USE_GUARDS, USE_INTERCEPTORS, USE_PIPES } from '../tokens.js';

function storeHooks(key: symbol, hooks: unknown[]): ClassDecorator & MethodDecorator {
  return ((target: object, propertyKey?: string | symbol) => {
    if (propertyKey) {
      Reflect.defineMetadata(key, hooks, target, propertyKey);
      return;
    }
    Reflect.defineMetadata(key, hooks, target);
  }) as ClassDecorator & MethodDecorator;
}

export const UseGuards = (...guards: unknown[]): ClassDecorator & MethodDecorator =>
  storeHooks(USE_GUARDS, guards);

export const UseInterceptors = (...interceptors: unknown[]): ClassDecorator & MethodDecorator =>
  storeHooks(USE_INTERCEPTORS, interceptors);

export const UsePipes = (...pipes: unknown[]): ClassDecorator & MethodDecorator =>
  storeHooks(USE_PIPES, pipes);

export const UseFilters = (...filters: unknown[]): ClassDecorator & MethodDecorator =>
  storeHooks(USE_FILTERS, filters);
