import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { UsersService } from '../../users/services/users.service';
import { CheckUsernameDto } from './dto/check-username.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly users: UsersService,
    private readonly serializer: UserSerializer,
  ) {}

  @Get('username-available')
  async usernameAvailable(
    @Query() dto: CheckUsernameDto,
    @CurrentUser() user: User,
  ): Promise<{ username: string; available: boolean }> {
    return {
      username: dto.username,
      available: await this.users.isUsernameAvailable(dto.username, user.id),
    };
  }

  @Post('profile')
  @HttpCode(200)
  async completeProfile(
    @Body() dto: CompleteProfileDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const loaded = await this.onboarding.complete(user, dto);

    return new ApiResult(
      this.serializer.user(loaded),
      'Profile complete. Welcome to cheevo!',
    );
  }
}
