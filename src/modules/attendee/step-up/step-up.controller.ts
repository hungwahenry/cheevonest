import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { ApiResult } from '../../../common/responses/api-result';
import type { User } from '../../../generated/prisma/client';
import {
  CurrentTokenId,
  CurrentUser,
} from '../../auth/decorators/auth.decorators';
import {
  CreateStepUpDto,
  ResendStepUpDto,
  VerifyStepUpDto,
} from './dto/step-up.dto';
import { StepUpSerializer } from './step-up.serializer';
import { StepUpService } from './services/step-up.service';

@Controller('attendee/step-up')
export class StepUpController {
  constructor(
    private readonly stepUp: StepUpService,
    private readonly serializer: StepUpSerializer,
  ) {}

  @Post()
  @HttpCode(200)
  async create(
    @Body() dto: CreateStepUpDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const challenge = await this.stepUp.create(
      user,
      dto.action,
      dto.payload ?? {},
    );

    return this.serializer.challenge(challenge);
  }

  @Post(':challengeId/verify')
  @HttpCode(200)
  async verify(
    @Param('challengeId') challengeId: string,
    @Body() dto: VerifyStepUpDto,
    @CurrentUser() user: User,
    @CurrentTokenId() tokenId: string,
  ): Promise<unknown> {
    const challenge = await this.stepUp.findOwnedOrFail(challengeId, user.id);

    const verified = await this.stepUp.verify(
      challenge,
      user,
      dto.factor_id,
      dto.code,
      { currentTokenId: tokenId },
    );

    return this.serializer.challenge(verified.challenge, verified.result);
  }

  @Post(':challengeId/resend')
  @HttpCode(200)
  async resend(
    @Param('challengeId') challengeId: string,
    @Body() dto: ResendStepUpDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<null>> {
    const challenge = await this.stepUp.findOwnedOrFail(challengeId, user.id);

    await this.stepUp.resend(challenge, dto.factor_id);

    return new ApiResult(null, 'Code resent.');
  }
}
