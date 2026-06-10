import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommentsPolicy } from './comments.policy';
import { UserCommentsController } from './controllers/user-comments.controller';
import { CommentSerializer } from './serializers/comment.serializer';
import { CommentListingService } from './services/comment-listing.service';
import { CommentsService } from './services/comments.service';

@Module({
  imports: [UsersModule],
  controllers: [UserCommentsController],
  providers: [
    CommentsService,
    CommentListingService,
    CommentSerializer,
    CommentsPolicy,
  ],
  exports: [
    CommentsService,
    CommentListingService,
    CommentSerializer,
    CommentsPolicy,
  ],
})
export class CommentsModule {}
