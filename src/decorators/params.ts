import 'reflect-metadata';
import { ROUTE_PARAMS } from '../tokens.js';
import type { ParamSource, RouteParamsMap } from '../types.js';

function createParamDecorator(type: ParamSource, name?: string): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const existing: RouteParamsMap =
      Reflect.getMetadata(ROUTE_PARAMS, target, propertyKey as string | symbol) ?? {};
    existing[parameterIndex] = { type, name };
    Reflect.defineMetadata(ROUTE_PARAMS, existing, target, propertyKey as string | symbol);
  };
}

export const Body = (): ParameterDecorator => createParamDecorator('body');
export const Param = (name: string): ParameterDecorator => createParamDecorator('param', name);
export const Query = (name: string): ParameterDecorator => createParamDecorator('query', name);
