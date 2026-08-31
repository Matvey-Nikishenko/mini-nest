import { z } from 'zod';
import { ValidationError } from '../errors.js';
import type { PipeTransform } from '../http/interfaces.js';

type ZodSchema = Pick<z.ZodType, 'safeParse'>;

export class ZodValidationPipe implements PipeTransform {
  transform(
    value: unknown,
    metadata: { type: string; data?: string; schema?: unknown },
  ): unknown {
    const schema = metadata.schema as ZodSchema | undefined;
    if (!schema || typeof schema.safeParse !== 'function') {
      return value;
    }

    const parsed = schema.safeParse(value ?? {});
    if (parsed.success) {
      return parsed.data;
    }

    throw new ValidationError(
      parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.') || metadata.data || metadata.type,
        constraints: [issue.message],
      })),
    );
  }
}
