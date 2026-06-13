import { Controller, Get, Param, Query } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { PublicProfileService } from '../../users/services/public-profile.service';
import { CommentSerializer } from '../serializers/comment.serializer';
import { CommentListingService } from '../services/comment-listing.service';

class UserCommentsPageDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;
}

@Controller('users/:userId/comments')
export class UserCommentsController {
  constructor(
    private readonly profiles: PublicProfileService,
    private readonly listing: CommentListingService,
    private readonly serializer: CommentSerializer,
  ) {}

  @Get()
  async list(
    @Param('userId') userId: string,
    @Query() dto: UserCommentsPageDto,
    @CurrentUser() viewer: User,
  ): Promise<Paginated<unknown>> {
    await this.profiles.findVisibleOrFail(userId, viewer.id);

    const page = dto.page ?? 1;
    const perPage = 20;

    const result = await this.listing.userCommentsPage(userId, page, perPage);

    return new Paginated(
      result.items.map((comment) => this.serializer.userComment(comment)),
      page,
      perPage,
      result.total,
    );
  }
}
