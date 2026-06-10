-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" CHAR(26) NOT NULL,
    "organisation_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id","organisation_id")
);

-- CreateTable
CREATE TABLE "event_rsvps" (
    "user_id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("user_id","event_id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "blocker_user_id" CHAR(26) NOT NULL,
    "blockable_type" VARCHAR(32) NOT NULL,
    "blockable_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("blocker_user_id","blockable_type","blockable_id")
);

-- CreateTable
CREATE TABLE "search_index" (
    "searchable_type" VARCHAR(64) NOT NULL,
    "searchable_id" CHAR(26) NOT NULL,
    "fts" tsvector,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_index_pkey" PRIMARY KEY ("searchable_type","searchable_id")
);

-- CreateIndex
CREATE INDEX "subscriptions_organisation_id_idx" ON "subscriptions"("organisation_id");

-- CreateIndex
CREATE INDEX "event_rsvps_event_id_idx" ON "event_rsvps"("event_id");

-- CreateIndex
CREATE INDEX "blocks_blockable_type_blockable_id_idx" ON "blocks"("blockable_type", "blockable_id");

-- CreateIndex
CREATE INDEX "search_index_fts_idx" ON "search_index" USING GIN ("fts");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
