import 'reflect-metadata';
import { ROUTE_PARAMS } from '../tokens.js';
import type { ParamSource, RouteParamsMap } from '../types.js';

function createParamDecorator(
  type: ParamSource,
  name?: string,
  schema?: unknown,
): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const existing: RouteParamsMap = {
      ...(Reflect.getOwnMetadata(ROUTE_PARAMS, target, propertyKey as string | symbol) ?? {}),
    };
    existing[parameterIndex] = { type, name, schema };
    Reflect.defineMetadata(ROUTE_PARAMS, existing, target, propertyKey as string | symbol);
  };
}

export const Body = (schema?: unknown): ParameterDecorator =>
  createParamDecorator('body', undefined, schema);
export const Param = (name: string): ParameterDecorator => createParamDecorator('param', name);
export const Query = (name: string): ParameterDecorator => createParamDecorator('query', name);
