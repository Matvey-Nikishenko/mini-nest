export interface FieldError {
  field: string;
  constraints: string[];
}

export class NotFoundError extends Error {
  constructor(message = 'Not Found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  readonly status = 400;

  constructor(readonly errors: FieldError[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}
