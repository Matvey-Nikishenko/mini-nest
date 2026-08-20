import 'reflect-metadata';
import { INJECT_TOKENS } from '../tokens.js';
import type { Token } from '../types.js';

export function Inject(token: Token): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existing: Record<number, Token> =
      Reflect.getOwnMetadata(INJECT_TOKENS, target) ?? {};
    existing[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_TOKENS, existing, target);
  };
}
