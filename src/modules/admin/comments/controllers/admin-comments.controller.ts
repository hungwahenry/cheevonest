import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiResult } from '../../../../common/responses/api-result';
import { Paginated } from '../../../../common/responses/paginated';
import { Roles } from '../../../auth/decorators/auth.decorators';
import { CommentsService } from '../../../comments/services/comments.service';
import { AuditAction } from '../../audit/audit-action.decorator';
import { AuditSink } from '../../audit/set-audit-target.decorator';
import type { AuditSinkFn } from '../../audit/set-audit-target.decorator';
import { DeleteCommentDto, ListCommentsDto } from '../dto/admin-comments.dto';
import { AdminCommentSerializer } from '../serializers/admin-comment.serializer';
import { AdminCommentsService } from '../services/admin-comments.service';

@Roles('admin')
@Controller('admin/comments')
export class AdminCommentsController {
  constructor(
    private readonly comments: AdminCommentsService,
    private readonly commentsKernel: CommentsService,
    private readonly serializer: AdminCommentSerializer,
  ) {}

  @Get()
  async list(@Query() dto: ListCommentsDto): Promise<Paginated<unknown>> {
    const page = dto.page ?? 1;
    const perPage = Math.min(dto.per_page ?? 25, 100);

    const result = await this.comments.page({
      page,
      perPage,
      flaggedOnly: dto.flagged_only,
      eventId: dto.event_id,
    });

    return new Paginated(
      result.items.map((comment) => this.serializer.comment(comment)),
      page,
      perPage,
      result.total,
    );
  }

  @Delete(':id')
  @HttpCode(200)
  @AuditAction('comments.delete')
  async remove(
    @Param('id') id: string,
    @Body() dto: DeleteCommentDto,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<{ deleted: boolean }>> {
    const comment = await this.comments.findOrFail(id);

    audit({
      targetType: 'event_comment',
      targetId: comment.id,
      payload: {
        event_id: comment.eventId,
        user_id: comment.userId,
        body: comment.body,
      },
      reason: dto.reason,
    });

    await this.commentsKernel.delete(comment);

    return new ApiResult({ deleted: true });
  }

  @Post(':id/dismiss-flags')
  @HttpCode(200)
  @AuditAction('comments.dismiss_flags')
  async dismissFlags(
    @Param('id') id: string,
    @AuditSink() audit: AuditSinkFn,
  ): Promise<ApiResult<{ cleared: number }>> {
    const comment = await this.comments.findOrFail(id);
    const cleared = await this.commentsKernel.dismissAllFlags(comment);

    audit({
      targetType: 'event_comment',
      targetId: comment.id,
      payload: { cleared },
    });

    return new ApiResult({ cleared });
  }
}
