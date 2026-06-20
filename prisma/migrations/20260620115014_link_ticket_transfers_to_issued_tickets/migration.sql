-- AddForeignKey
ALTER TABLE "ticket_transfers" ADD CONSTRAINT "ticket_transfers_issued_ticket_id_fkey" FOREIGN KEY ("issued_ticket_id") REFERENCES "issued_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
