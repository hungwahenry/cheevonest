import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiException } from '../exceptions/api.exception';

interface ErrorBody {
  status: 'error';
  message: string;
  code?: string;
  errors?: Record<string, unknown>;
  request_id?: string;
}

interface RenderedError {
  status: number;
  body: ErrorBody;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly debug: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, body } = this.render(exception);

    if (request.id) {
      body.request_id = String(request.id);
    }

    void reply.status(status).send(body);
  }

  private render(exception: unknown): RenderedError {
    if (exception instanceof ApiException) {
      return {
        status: exception.status,
        body: this.body(
          exception.message,
          exception.code ?? undefined,
          exception.errors,
        ),
      };
    }

    if (exception instanceof HttpException) {
      return this.renderHttpException(exception);
    }

    return this.renderServerError(exception);
  }

  private renderHttpException(exception: HttpException): RenderedError {
    const status = exception.getStatus();

    switch (status) {
      case 401:
        return {
          status,
          body: this.body('Unauthenticated.', 'unauthenticated'),
        };
      case 403: {
        const message = this.messageOf(exception);
        return {
          status,
          body: this.body(
            message === 'Forbidden' ? 'This action is unauthorized.' : message,
            'forbidden',
          ),
        };
      }
      case 404:
        return { status, body: this.body('Resource not found.', 'not_found') };
      case 405:
        return {
          status,
          body: this.body('Method not allowed.', 'method_not_allowed'),
        };
      case 429:
        return {
          status,
          body: this.body(
            'Too many requests. Please slow down.',
            'rate_limited',
          ),
        };
      default:
        return {
          status,
          body: this.body(
            this.messageOf(exception) || 'Request failed.',
            'http_error',
          ),
        };
    }
  }

  private renderServerError(exception: unknown): RenderedError {
    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );

    const errors =
      this.debug && exception instanceof Error
        ? {
            exception: exception.name,
            message: exception.message,
            at: exception.stack?.split('\n')[1]?.trim(),
          }
        : undefined;

    return {
      status: 500,
      body: this.body(
        'Server error. Please try again.',
        'server_error',
        errors,
      ),
    };
  }

  private body(
    message: string,
    code?: string,
    errors?: Record<string, unknown>,
  ): ErrorBody {
    return {
      status: 'error',
      message,
      ...(code ? { code } : {}),
      ...(errors && Object.keys(errors).length > 0 ? { errors } : {}),
    };
  }

  private messageOf(exception: HttpException): string {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message)) {
        return message.join(' ');
      }
    }

    return exception.message;
  }
}
