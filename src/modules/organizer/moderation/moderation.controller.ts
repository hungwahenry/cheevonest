import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Paginated } from '../../../common/responses/paginated';
import { toBoolean, toNumber } from '../../../common/validation/transforms';
import type { User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CommentSerializer } from '../../comments/serializers/comment.serializer';
import { CommentListingService } from '../../comments/services/comment-listing.service';
import { CommentsService } from '../../comments/services/comments.service';
import { EventsPolicy } from '../../events/events.policy';
import { EventsService } from '../../events/events.service';

class ModerationListDto {
  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  per_page?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(toBoolean)
  flagged_only?: boolean;
}

class FlagCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

@Controller('organizer/events/:eventId/comments')
export class ModerationController {
  constructor(
    private readonly events: EventsService,
    private readonly policy: EventsPolicy,
    private readonly comments: CommentsService,
    private readonly listing: CommentListingService,
    private readonly serializer: CommentSerializer,
  ) {}

  @Get()
  async list(
    @Param('eventId') eventId: string,
    @Query() dto: ModerationListDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.listing.topLevel(event, user, {
      page,
      perPage,
      search: dto.q?.trim() || null,
      flaggedOnly: dto.flagged_only ?? false,
      includeFlagged: true,
    });

    return new Paginated(
      result.items.map((item) => this.serializer.comment(item)),
      page,
      perPage,
      result.total,
    );
  }

  @Get(':commentId/replies')
  async replies(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @Query() dto: ModerationListDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const parent = await this.comments.findScoped(event.id, commentId);

    if (parent.parentId !== null) {
      throw new NotFoundException();
    }

    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.listing.replies(
      event,
      parent,
      user,
      page,
      perPage,
    );

    return new Paginated(
      result.items.map((item) => this.serializer.comment(item)),
      page,
      perPage,
      result.total,
    );
  }

  @Post(':commentId/flag')
  @HttpCode(200)
  async flag(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @Body() dto: FlagCommentDto,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const comment = await this.comments.findScoped(event.id, commentId);
    await this.comments.flag(user, comment, dto.reason ?? null);

    return {
      is_flagged_by_me: true,
      flags_count: await this.comments.freshFlagsCount(comment.id),
    };
  }

  @Delete(':commentId/flag')
  @HttpCode(200)
  async unflag(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    await this.policy.ensureMember(event, user.id);

    const comment = await this.comments.findScoped(event.id, commentId);
    await this.comments.unflag(user, comment);

    return {
      is_flagged_by_me: false,
      flags_count: await this.comments.freshFlagsCount(comment.id),
    };
  }
}
