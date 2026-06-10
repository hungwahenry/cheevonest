-- CreateEnum
CREATE TYPE "OrganisationRole" AS ENUM ('owner', 'member');

-- CreateTable
CREATE TABLE "organisations" (
    "id" CHAR(26) NOT NULL,
    "category_id" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_path" TEXT,
    "cover_path" TEXT,
    "about" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "website" TEXT,
    "city" TEXT,
    "events_count" INTEGER NOT NULL DEFAULT 0,
    "subscribers_count" INTEGER NOT NULL DEFAULT 0,
    "subscription_fanout_window_started_at" TIMESTAMPTZ(6),
    "subscription_fanout_count" INTEGER NOT NULL DEFAULT 0,
    "suspended_at" TIMESTAMPTZ(6),
    "suspended_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_members" (
    "organisation_id" CHAR(26) NOT NULL,
    "user_id" CHAR(26) NOT NULL,
    "role" "OrganisationRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organisation_members_pkey" PRIMARY KEY ("organisation_id","user_id")
);

-- CreateTable
CREATE TABLE "organisation_categories" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organisation_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_platforms" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "social_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisation_social" (
    "organisation_id" CHAR(26) NOT NULL,
    "social_platform_id" INTEGER NOT NULL,
    "handle" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organisation_social_pkey" PRIMARY KEY ("organisation_id","social_platform_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organisations_slug_key" ON "organisations"("slug");

-- CreateIndex
CREATE INDEX "organisations_suspended_at_idx" ON "organisations"("suspended_at");

-- CreateIndex
CREATE INDEX "organisation_members_user_id_idx" ON "organisation_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organisation_categories_slug_key" ON "organisation_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "social_platforms_slug_key" ON "social_platforms"("slug");

-- AddForeignKey
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "organisation_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_members" ADD CONSTRAINT "organisation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_social" ADD CONSTRAINT "organisation_social_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisation_social" ADD CONSTRAINT "organisation_social_social_platform_id_fkey" FOREIGN KEY ("social_platform_id") REFERENCES "social_platforms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
