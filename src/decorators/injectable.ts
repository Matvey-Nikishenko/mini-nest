import 'reflect-metadata';
import { INJECTABLE, SCOPE } from '../tokens.js';
import type { InjectableOptions } from '../types.js';

export function Injectable(options: InjectableOptions = {}): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(INJECTABLE, true, target);
    Reflect.defineMetadata(SCOPE, options.scope ?? 'singleton', target);
  };
}
