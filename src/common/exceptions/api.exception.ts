export class ApiException extends Error {
  constructor(
    message = 'Something went wrong.',
    readonly status: number = 400,
    readonly errors: Record<string, unknown> = {},
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationFailedException extends ApiException {
  constructor(errors: Record<string, string[]>) {
    super('The given data was invalid.', 422, errors, 'validation_failed');
  }
}
