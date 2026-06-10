export class ApiResult<T = unknown> {
  constructor(
    readonly data: T,
    readonly message?: string,
    readonly meta?: Record<string, unknown>,
  ) {}
}
