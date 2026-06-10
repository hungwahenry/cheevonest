import { Body, Controller, Patch } from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { UserSerializer } from '../../users/serializers/user.serializer';
import { InterestsService } from '../interests/interests.service';
import { InterestRules } from '../interests/rules/interest.rules';
import { UpdateInterestsDto } from './dto/update-interests.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('attendee')
export class ProfileController {
  constructor(
    private readonly profiles: ProfileService,
    private readonly interests: InterestsService,
    private readonly interestRules: InterestRules,
    private readonly serializer: UserSerializer,
  ) {}

  @Patch('profile')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const loaded = await this.profiles.update(user, dto);

    return new ApiResult(
      this.serializer.user(loaded, { includeOrganisations: true }),
      'Profile updated.',
    );
  }

  @Patch('interests')
  async updateInterests(
    @Body() dto: UpdateInterestsDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    await this.interestRules.ensureActive(dto.interests);
    await this.interests.syncFor(user.id, dto.interests);

    const interests = await this.interests.listFor(user.id);

    return new ApiResult(
      interests.map((interest) => this.serializer.interest(interest)),
      'Interests updated.',
    );
  }
}
