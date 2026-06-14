-- CreateEnum
CREATE TYPE "AdminBroadcastKind" AS ENUM ('system', 'marketing');

-- CreateEnum
CREATE TYPE "AdminBroadcastStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'cancelled', 'failed');

-- CreateTable
CREATE TABLE "admin_broadcasts" (
    "id" CHAR(26) NOT NULL,
    "kind" "AdminBroadcastKind" NOT NULL,
    "status" "AdminBroadcastStatus" NOT NULL DEFAULT 'draft',
    "title" VARCHAR(150) NOT NULL,
    "body" TEXT NOT NULL,
    "channels" TEXT[],
    "audience" JSONB NOT NULL,
    "scheduled_at" TIMESTAMPTZ(6),
    "created_by_user_id" CHAR(26) NOT NULL,
    "recipients_count" INTEGER NOT NULL DEFAULT 0,
    "email_count" INTEGER NOT NULL DEFAULT 0,
    "push_count" INTEGER NOT NULL DEFAULT 0,
    "inapp_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_broadcast_links" (
    "id" CHAR(26) NOT NULL,
    "broadcast_id" CHAR(26) NOT NULL,
    "url" TEXT NOT NULL,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_broadcast_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_broadcasts_status_scheduled_at_idx" ON "admin_broadcasts"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "admin_broadcasts_kind_created_at_idx" ON "admin_broadcasts"("kind", "created_at");

-- CreateIndex
CREATE INDEX "admin_broadcast_links_broadcast_id_idx" ON "admin_broadcast_links"("broadcast_id");

-- AddForeignKey
ALTER TABLE "admin_broadcasts" ADD CONSTRAINT "admin_broadcasts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_broadcast_links" ADD CONSTRAINT "admin_broadcast_links_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "admin_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
