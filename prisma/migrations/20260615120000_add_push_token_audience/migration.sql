-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('organizer', 'attendee');

-- AlterTable
ALTER TABLE "expo_push_tokens" ADD COLUMN "audience" "NotificationAudience";
