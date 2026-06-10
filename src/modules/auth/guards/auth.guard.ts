import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../../database/prisma.service';
import {
  AuthenticatedRequest,
  IS_PUBLIC_KEY,
} from '../decorators/auth.decorators';
import { TokenService } from '../services/token.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;
    const plainToken = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;

    if (!plainToken) {
      throw new UnauthorizedException();
    }

    const token = await this.tokens.resolve(plainToken);

    if (!token) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: token.userId },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.suspendedAt !== null) {
      throw new ForbiddenException('Your account has been suspended.');
    }

    await this.tokens.touch(token.id);

    const authenticated = request as AuthenticatedRequest;
    authenticated.user = user;
    authenticated.accessTokenId = token.id;

    return true;
  }
}
