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

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;
    const plainToken = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;

    if (isPublic) {
      if (plainToken) {
        await this.attachUserIfValid(request, plainToken);
      }

      return true;
    }

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

  /** Public routes still resolve the user when a valid token is sent. */
  private async attachUserIfValid(
    request: FastifyRequest,
    plainToken: string,
  ): Promise<void> {
    const token = await this.tokens.resolve(plainToken);

    if (!token) {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: token.userId },
    });

    // Suspended accounts are treated as logged-out everywhere, including public routes.
    if (user && user.suspendedAt === null) {
      const authenticated = request as AuthenticatedRequest;
      authenticated.user = user;
      authenticated.accessTokenId = token.id;
    }
  }
}
