import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { SKIP_ENVELOPE_KEY } from '../decorators/api-response.decorators';
import { ApiResult } from '../responses/api-result';
import { Paginated } from '../responses/paginated';

function serializePaginated(value: Paginated<unknown>): Record<string, unknown> {
  return {
    items: value.items,
    page: value.page,
    last_page: value.lastPage,
    per_page: value.perPage,
    total: value.total,
  };
}

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, targets)) {
      return next.handle();
    }

    const fallbackMessage = 'OK';

    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof Paginated) {
          return {
            status: 'success',
            message: fallbackMessage,
            data: serializePaginated(value),
          };
        }

        if (value instanceof ApiResult) {
          const result = value as ApiResult<unknown>;
          const data =
            result.data instanceof Paginated
              ? serializePaginated(result.data)
              : (result.data ?? null);

          return {
            status: 'success',
            message: result.message ?? fallbackMessage,
            data,
            ...(result.meta && Object.keys(result.meta).length > 0
              ? { meta: result.meta }
              : {}),
          };
        }

        return {
          status: 'success',
          message: fallbackMessage,
          data: value ?? null,
        };
      }),
    );
  }
}
