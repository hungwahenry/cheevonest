-- CreateEnum
CREATE TYPE "SystemConfigType" AS ENUM ('bool', 'int', 'decimal', 'string', 'json');

-- CreateTable
CREATE TABLE "system_configs" (
    "id" CHAR(26) NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "group" VARCHAR(40) NOT NULL,
    "type" "SystemConfigType" NOT NULL,
    "value" JSONB NOT NULL,
    "default_value" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" CHAR(26) NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" SMALLINT NOT NULL DEFAULT 100,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" CHAR(26) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body_html" TEXT NOT NULL,
    "meta_description" VARCHAR(300),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "welcome_contents" (
    "id" SERIAL NOT NULL,
    "background_path" TEXT,
    "headline" VARCHAR(160) NOT NULL,
    "subheadline" VARCHAR(280) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "welcome_contents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_group_idx" ON "system_configs"("group");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_is_published_idx" ON "pages"("is_published");
