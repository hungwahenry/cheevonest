import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import {
  RESPONSE_MESSAGE_KEY,
  SKIP_ENVELOPE_KEY,
} from '../decorators/api-response.decorators';
import { ApiResult } from '../responses/api-result';
import { Paginated } from '../responses/paginated';

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const targets = [context.getHandler(), context.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE_KEY, targets)) {
      return next.handle();
    }

    const fallbackMessage =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, targets) ??
      'OK';

    return next.handle().pipe(
      map((value: unknown) => {
        if (value instanceof Paginated) {
          return {
            status: 'success',
            message: fallbackMessage,
            data: {
              items: value.items,
              page: value.page,
              last_page: value.lastPage,
              per_page: value.perPage,
              total: value.total,
            },
          };
        }

        if (value instanceof ApiResult) {
          const result = value as ApiResult<unknown>;

          return {
            status: 'success',
            message: result.message ?? fallbackMessage,
            data: result.data ?? null,
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
