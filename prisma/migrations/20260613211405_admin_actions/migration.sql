-- CreateTable
CREATE TABLE "admin_actions" (
    "id" CHAR(26) NOT NULL,
    "admin_user_id" CHAR(26) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(64),
    "target_id" TEXT,
    "payload" JSONB,
    "reason" TEXT,
    "ip" VARCHAR(45),
    "user_agent" TEXT,
    "request_id" VARCHAR(26),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_actions_admin_user_id_created_at_idx" ON "admin_actions"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_actions_target_type_target_id_idx" ON "admin_actions"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "admin_actions_action_idx" ON "admin_actions"("action");

-- CreateIndex
CREATE INDEX "admin_actions_created_at_idx" ON "admin_actions"("created_at");

-- AddForeignKey
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
