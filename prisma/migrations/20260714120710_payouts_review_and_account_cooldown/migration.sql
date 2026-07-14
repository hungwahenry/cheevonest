-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'pending_review';

-- AlterTable
ALTER TABLE "payout_accounts" ADD COLUMN     "details_changed_at" TIMESTAMPTZ(6);
