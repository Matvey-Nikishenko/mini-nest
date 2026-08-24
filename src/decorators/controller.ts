import 'reflect-metadata';
import { CONTROLLER_PREFIX, INJECTABLE, SCOPE } from '../tokens.js';

export function Controller(prefix = ''): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(INJECTABLE, true, target);
    Reflect.defineMetadata(SCOPE, 'singleton', target);
    Reflect.defineMetadata(CONTROLLER_PREFIX, prefix, target);
  };
}
