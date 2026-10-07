CREATE TYPE "ContactKind" AS ENUM ('FACULTY', 'SPONSOR');

ALTER TABLE "Contact"
  ADD COLUMN "kind" "ContactKind" NOT NULL DEFAULT 'FACULTY',
  ADD COLUMN "company" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "website" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "industry" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "location" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Contact_kind_status_idx" ON "Contact"("kind", "status");
