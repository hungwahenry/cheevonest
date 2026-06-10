-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('requested', 'approved', 'processing', 'paid', 'rejected', 'failed');

-- CreateTable
CREATE TABLE "payout_accounts" (
    "id" CHAR(26) NOT NULL,
    "organisation_id" CHAR(26) NOT NULL,
    "bank_code" VARCHAR(16) NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" VARCHAR(32) NOT NULL,
    "account_name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'paystack',
    "provider_recipient_code" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" CHAR(26) NOT NULL,
    "organisation_id" CHAR(26) NOT NULL,
    "payout_account_id" CHAR(26),
    "requested_by_user_id" CHAR(26) NOT NULL,
    "reviewed_by_user_id" CHAR(26),
    "bank_code" VARCHAR(16) NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_number" VARCHAR(32) NOT NULL,
    "account_name" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "fees_minor" BIGINT NOT NULL DEFAULT 0,
    "net_minor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "status" "PayoutStatus" NOT NULL DEFAULT 'requested',
    "provider" VARCHAR(32) NOT NULL DEFAULT 'paystack',
    "provider_reference" TEXT,
    "provider_response" JSONB,
    "failed_reason" TEXT,
    "review_notes" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payout_accounts_organisation_id_key" ON "payout_accounts"("organisation_id");

-- CreateIndex
CREATE INDEX "payouts_organisation_id_status_idx" ON "payouts"("organisation_id", "status");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX "payouts_provider_reference_idx" ON "payouts"("provider_reference");

-- AddForeignKey
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payout_account_id_fkey" FOREIGN KEY ("payout_account_id") REFERENCES "payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
