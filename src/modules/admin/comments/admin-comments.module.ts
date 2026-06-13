import { Module } from '@nestjs/common';
import { CommentsModule } from '../../comments/comments.module';
import { AdminCommentsController } from './controllers/admin-comments.controller';
import { AdminCommentSerializer } from './serializers/admin-comment.serializer';
import { AdminCommentsService } from './services/admin-comments.service';

@Module({
  imports: [CommentsModule],
  controllers: [AdminCommentsController],
  providers: [AdminCommentsService, AdminCommentSerializer],
})
export class AdminCommentsModule {}
