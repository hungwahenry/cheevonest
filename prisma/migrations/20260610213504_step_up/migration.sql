-- CreateTable
CREATE TABLE "step_up_challenges" (
    "id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "step_up_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_up_factors" (
    "id" CHAR(26) NOT NULL,
    "challenge_id" CHAR(26) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "target" TEXT NOT NULL,
    "code_hash" TEXT,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "sort_order" SMALLINT NOT NULL,
    "sent_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "step_up_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "step_up_challenges_user_id_action_idx" ON "step_up_challenges"("user_id", "action");

-- CreateIndex
CREATE INDEX "step_up_challenges_expires_at_idx" ON "step_up_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "step_up_factors_challenge_id_sort_order_key" ON "step_up_factors"("challenge_id", "sort_order");

-- AddForeignKey
ALTER TABLE "step_up_challenges" ADD CONSTRAINT "step_up_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_up_factors" ADD CONSTRAINT "step_up_factors_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "step_up_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
