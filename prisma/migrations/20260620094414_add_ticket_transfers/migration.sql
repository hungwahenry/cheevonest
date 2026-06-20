-- CreateTable
CREATE TABLE "ticket_transfers" (
    "id" CHAR(26) NOT NULL,
    "issued_ticket_id" CHAR(26) NOT NULL,
    "event_id" CHAR(26) NOT NULL,
    "from_user_id" CHAR(26) NOT NULL,
    "to_user_id" CHAR(26) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_transfers_issued_ticket_id_idx" ON "ticket_transfers"("issued_ticket_id");

-- CreateIndex
CREATE INDEX "ticket_transfers_from_user_id_idx" ON "ticket_transfers"("from_user_id");

-- CreateIndex
CREATE INDEX "ticket_transfers_to_user_id_idx" ON "ticket_transfers"("to_user_id");
