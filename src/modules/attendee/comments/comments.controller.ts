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
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiResult } from '../../../common/responses/api-result';
import { Paginated } from '../../../common/responses/paginated';
import { toNumber } from '../../../common/validation/transforms';
import type { Event, User } from '../../../generated/prisma/client';
import { CurrentUser } from '../../auth/decorators/auth.decorators';
import { CommentsPolicy } from '../../comments/comments.policy';
import { CommentSerializer } from '../../comments/serializers/comment.serializer';
import { CommentListingService } from '../../comments/services/comment-listing.service';
import { CommentsService } from '../../comments/services/comments.service';
import { EventsService } from '../../events/events.service';
import { CreateCommentDto } from './dto/create-comment.dto';

class CommentsPageDto {
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
}

@Controller('attendee/events/:eventId/comments')
export class AttendeeCommentsController {
  constructor(
    private readonly events: EventsService,
    private readonly comments: CommentsService,
    private readonly policy: CommentsPolicy,
    private readonly listing: CommentListingService,
    private readonly serializer: CommentSerializer,
  ) {}

  @Get()
  async list(
    @Param('eventId') eventId: string,
    @Query() dto: CommentsPageDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.findVisibleEvent(eventId);
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 20, 50);

    const result = await this.listing.topLevel(event, user, { page, perPage });

    return new Paginated(
      result.items.map((item) => this.serializer.comment(item)),
      page,
      perPage,
      result.total,
    );
  }

  @Post()
  @HttpCode(200)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ): Promise<ApiResult<unknown>> {
    const event = await this.events.findOrFail(eventId);
    const comment = await this.comments.create(user, event, dto);
    const decorated = await this.listing.decorateOne(comment, event, user);

    return new ApiResult(this.serializer.comment(decorated));
  }

  @Get(':commentId/replies')
  async replies(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @Query() dto: CommentsPageDto,
    @CurrentUser() user: User,
  ): Promise<Paginated<unknown>> {
    const event = await this.findVisibleEvent(eventId);
    const parent = await this.comments.findVisibleTopLevel(event.id, commentId);

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

  @Delete(':commentId')
  @HttpCode(200)
  async remove(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ): Promise<{ deleted: boolean }> {
    const event = await this.events.findOrFail(eventId);
    const comment = await this.comments.findScoped(event.id, commentId);

    this.policy.ensureAuthor(comment, user.id);

    await this.comments.delete(comment);

    return { deleted: true };
  }

  @Post(':commentId/like')
  @HttpCode(200)
  async like(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    const comment = await this.comments.findScoped(event.id, commentId);

    await this.comments.like(user, comment);

    return {
      is_liked: true,
      likes_count: await this.comments.freshLikesCount(comment.id),
    };
  }

  @Delete(':commentId/like')
  @HttpCode(200)
  async unlike(
    @Param('eventId') eventId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ): Promise<unknown> {
    const event = await this.events.findOrFail(eventId);
    const comment = await this.comments.findScoped(event.id, commentId);

    await this.comments.unlike(user, comment);

    return {
      is_liked: false,
      likes_count: await this.comments.freshLikesCount(comment.id),
    };
  }

  private async findVisibleEvent(eventId: string): Promise<Event> {
    const event = await this.events.findOrFail(eventId);

    if (event.status !== 'published' && event.status !== 'past') {
      throw new NotFoundException();
    }

    return event;
  }
}
