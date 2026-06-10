export const COMMENT_REPLIED = 'comment.replied';

export class CommentRepliedEvent {
  constructor(readonly replyId: string) {}
}
