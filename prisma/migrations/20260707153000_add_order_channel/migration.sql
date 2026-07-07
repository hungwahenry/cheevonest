-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('app', 'web');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "channel" "OrderChannel" NOT NULL DEFAULT 'app';

-- Backfill: existing web orders are identifiable by their access token.
UPDATE "orders" SET "channel" = 'web' WHERE "access_token" IS NOT NULL;
