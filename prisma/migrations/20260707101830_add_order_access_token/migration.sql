-- AlterTable
ALTER TABLE "orders" ADD COLUMN "access_token" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "orders_access_token_key" ON "orders"("access_token");
