-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('queued', 'sending', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('ticket_holders', 'rsvpers', 'both');

-- CreateEnum
CREATE TYPE "SuppressionReason" AS ENUM ('unsubscribed', 'bounced', 'complained');

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" CHAR(26) NOT NULL,
    "organisation_id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "created_by_user_id" CHAR(26) NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "subject" VARCHAR(120) NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'queued',
    "failure_reason" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_suppressions" (
    "id" CHAR(26) NOT NULL,
    "email" TEXT NOT NULL,
    "organisation_id" CHAR(26),
    "reason" "SuppressionReason" NOT NULL,
    "user_id" CHAR(26),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "broadcast_suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_organisation_id_created_at_idx" ON "broadcasts"("organisation_id", "created_at");

-- CreateIndex
CREATE INDEX "broadcasts_event_id_created_at_idx" ON "broadcasts"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "broadcast_suppressions_email_idx" ON "broadcast_suppressions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "broadcast_suppressions_email_organisation_id_key" ON "broadcast_suppressions"("email", "organisation_id");

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_suppressions" ADD CONSTRAINT "broadcast_suppressions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcast_suppressions" ADD CONSTRAINT "broadcast_suppressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
