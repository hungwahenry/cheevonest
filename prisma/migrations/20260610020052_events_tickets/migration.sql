-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'published', 'past');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('draft', 'on_sale', 'paused');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('NGN', 'USD', 'GHS', 'KES', 'ZAR');

-- CreateTable
CREATE TABLE "events" (
    "id" CHAR(26) NOT NULL,
    "organisation_id" CHAR(26) NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "venue_name" TEXT,
    "place_id" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "city" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "flyer_path" TEXT,
    "flyer_type" TEXT,
    "video_url" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "presale_until" TIMESTAMPTZ(6),
    "tickets_count" INTEGER NOT NULL DEFAULT 0,
    "tickets_min_price" INTEGER,
    "tickets_max_price" INTEGER,
    "tickets_sold" INTEGER NOT NULL DEFAULT 0,
    "revenue_minor" BIGINT NOT NULL DEFAULT 0,
    "rsvps_count" INTEGER NOT NULL DEFAULT 0,
    "comments_count" INTEGER NOT NULL DEFAULT 0,
    "starting_soon_notified_at" TIMESTAMPTZ(6),
    "first_sale_notified_at" TIMESTAMPTZ(6),
    "digest_last_sent_at" TIMESTAMPTZ(6),
    "suspended_at" TIMESTAMPTZ(6),
    "suspended_reason" TEXT,
    "comments_locked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_tickets" (
    "id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "gross_price" INTEGER NOT NULL,
    "display_price" INTEGER,
    "quantity" INTEGER,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "TicketStatus" NOT NULL DEFAULT 'draft',
    "sales_starts_at" TIMESTAMPTZ(6),
    "sales_ends_at" TIMESTAMPTZ(6),
    "valid_from" TIMESTAMPTZ(6),
    "valid_to" TIMESTAMPTZ(6),
    "max_per_order" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_images" (
    "id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "path" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_features" (
    "id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_path" TEXT,
    "link" TEXT,
    "starts_at" TIMESTAMPTZ(6),
    "ends_at" TIMESTAMPTZ(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_interest" (
    "event_id" CHAR(26) NOT NULL,
    "interest_id" INTEGER NOT NULL,

    CONSTRAINT "event_interest_pkey" PRIMARY KEY ("event_id","interest_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_status_ends_at_idx" ON "events"("status", "ends_at");

-- CreateIndex
CREATE INDEX "events_latitude_longitude_idx" ON "events"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "events_suspended_at_idx" ON "events"("suspended_at");

-- CreateIndex
CREATE INDEX "events_organisation_id_idx" ON "events"("organisation_id");

-- CreateIndex
CREATE INDEX "event_tickets_event_id_sort_order_idx" ON "event_tickets"("event_id", "sort_order");

-- CreateIndex
CREATE INDEX "event_images_event_id_idx" ON "event_images"("event_id");

-- CreateIndex
CREATE INDEX "event_features_event_id_idx" ON "event_features"("event_id");

-- CreateIndex
CREATE INDEX "event_interest_interest_id_event_id_idx" ON "event_interest"("interest_id", "event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_tickets" ADD CONSTRAINT "event_tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_images" ADD CONSTRAINT "event_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_features" ADD CONSTRAINT "event_features_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_interest" ADD CONSTRAINT "event_interest_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_interest" ADD CONSTRAINT "event_interest_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
