/** Never thrown directly — every domain failure gets a named subclass in its module's exceptions/ folder. */
export abstract class ApiException extends Error {
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
