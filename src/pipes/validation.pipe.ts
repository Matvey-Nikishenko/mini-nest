import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Constructor } from '../types.js';

export interface FieldError {
  field: string;
  constraints: string[];
}

export class ValidationError extends Error {
  readonly status = 400;

  constructor(readonly errors: FieldError[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

const nativeTypes = new Set<unknown>([Object, String, Number, Boolean, Array]);

export function isDtoClass(metatype: unknown): metatype is Constructor {
  return typeof metatype === 'function' && !nativeTypes.has(metatype);
}

export class ValidationPipe {
  async transform(value: unknown, metatype?: Constructor): Promise<unknown> {
    if (!metatype || !isDtoClass(metatype)) {
      return value;
    }

    const instance = plainToInstance(metatype, value ?? {});
    const errors = await validate(instance as object, {
      whitelist: true,
    });

    if (errors.length > 0) {
      throw new ValidationError(
        errors.map((error) => ({
          field: error.property,
          constraints: Object.values(error.constraints ?? {}),
        })),
      );
    }

    return instance;
  }
}
