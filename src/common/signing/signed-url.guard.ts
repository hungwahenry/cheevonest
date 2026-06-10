import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { UrlSignerService } from './url-signer.service';

@Injectable()
export class SignedUrlGuard implements CanActivate {
  constructor(private readonly signer: UrlSignerService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const path = request.url.split('?')[0];
    const query = request.query as Record<string, string | undefined>;

    if (!this.signer.verify(path, query.expires, query.signature)) {
      throw new ForbiddenException('Invalid signature.');
    }

    return true;
  }
}
