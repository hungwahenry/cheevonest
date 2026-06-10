import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommentsPolicy } from './comments.policy';
import { CommentRules } from './rules/comment.rules';
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
    CommentRules,
  ],
  exports: [
    CommentsService,
    CommentListingService,
    CommentSerializer,
    CommentsPolicy,
  ],
})
export class CommentsModule {}
