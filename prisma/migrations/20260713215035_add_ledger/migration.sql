-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('sale', 'refund', 'adjustment');

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" CHAR(26) NOT NULL,
    "organisation_id" CHAR(26) NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'NGN',
    "source_type" VARCHAR(32) NOT NULL,
    "source_id" CHAR(26) NOT NULL,
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_organisation_id_available_at_idx" ON "ledger_entries"("organisation_id", "available_at");

-- CreateIndex
CREATE INDEX "ledger_entries_source_type_source_id_idx" ON "ledger_entries"("source_type", "source_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
