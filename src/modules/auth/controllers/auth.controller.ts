import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { UsersService } from '../../users/services/users.service';
import {
  CurrentTokenId,
  CurrentUser,
  Public,
} from '../decorators/auth.decorators';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
    private readonly serializer: UserSerializer,
  ) {}

  @Public()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post('send-otp')
  @HttpCode(200)
  async sendOtp(@Body() dto: SendOtpDto): Promise<ApiResult<null>> {
    await this.auth.sendOtp(dto.email);

    return new ApiResult(
      null,
      'If that email can receive codes, one is on its way.',
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<ApiResult<unknown>> {
    const session = await this.auth.verifyOtp(dto.email, dto.code);

    return new ApiResult(
      {
        token: session.token,
        user: this.serializer.user(session.user, {
          includeOrganisations: true,
        }),
        is_new_user: session.isNewUser,
      },
      session.isNewUser ? 'Welcome to cheevo!' : 'Welcome back!',
    );
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentTokenId() tokenId: string): Promise<ApiResult<null>> {
    await this.tokens.revoke(tokenId);

    return new ApiResult(null, 'Logged out.');
  }

  @Get('me')
  async me(@CurrentUser() user: User): Promise<ApiResult<unknown>> {
    const loaded = await this.users.findForResource(user.id);

    return new ApiResult(
      this.serializer.user(loaded, { includeOrganisations: true }),
    );
  }
}
