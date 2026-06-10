-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'under_review', 'actioned', 'dismissed');

-- CreateTable
CREATE TABLE "event_comments" (
    "id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "parent_id" CHAR(26),
    "body" TEXT,
    "gif" JSONB,
    "mentions" JSONB,
    "likes_count" INTEGER NOT NULL DEFAULT 0,
    "replies_count" INTEGER NOT NULL DEFAULT 0,
    "flags_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_comment_likes" (
    "comment_id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_comment_likes_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateTable
CREATE TABLE "event_comment_flags" (
    "comment_id" CHAR(26) NOT NULL,
    "flagged_by_user_id" CHAR(26) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_comment_flags_pkey" PRIMARY KEY ("comment_id","flagged_by_user_id")
);

-- CreateTable
CREATE TABLE "report_reasons" (
    "id" CHAR(26) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "scope_types" JSONB NOT NULL DEFAULT '[]',
    "display_order" SMALLINT NOT NULL DEFAULT 0,
    "requires_details" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" CHAR(26) NOT NULL,
    "target_type" VARCHAR(64) NOT NULL,
    "target_id" CHAR(26) NOT NULL,
    "reporter_user_id" CHAR(26) NOT NULL,
    "report_reason_id" CHAR(26) NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "reviewed_by_user_id" CHAR(26),
    "reviewed_at" TIMESTAMPTZ(6),
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_comments_event_id_parent_id_created_at_idx" ON "event_comments"("event_id", "parent_id", "created_at");

-- CreateIndex
CREATE INDEX "event_comments_parent_id_created_at_idx" ON "event_comments"("parent_id", "created_at");

-- CreateIndex
CREATE INDEX "event_comment_likes_user_id_idx" ON "event_comment_likes"("user_id");

-- CreateIndex
CREATE INDEX "event_comment_flags_flagged_by_user_id_idx" ON "event_comment_flags"("flagged_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_reasons_slug_key" ON "report_reasons"("slug");

-- CreateIndex
CREATE INDEX "report_reasons_is_active_display_order_idx" ON "report_reasons"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_idx" ON "reports"("reporter_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporter_user_id_target_type_target_id_key" ON "reports"("reporter_user_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comment_likes" ADD CONSTRAINT "event_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comment_likes" ADD CONSTRAINT "event_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comment_flags" ADD CONSTRAINT "event_comment_flags_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "event_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_comment_flags" ADD CONSTRAINT "event_comment_flags_flagged_by_user_id_fkey" FOREIGN KEY ("flagged_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_report_reason_id_fkey" FOREIGN KEY ("report_reason_id") REFERENCES "report_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE event_comments ADD CONSTRAINT event_comments_body_or_gif_check CHECK (body IS NOT NULL OR gif IS NOT NULL);
