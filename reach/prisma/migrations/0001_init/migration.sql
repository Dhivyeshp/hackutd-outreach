-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "Verification" AS ENUM ('VALID', 'RISKY', 'INVALID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('PENDING', 'QUEUED', 'SENDING', 'SENT', 'REPLIED', 'BOUNCED', 'ERROR', 'OPTED_OUT', 'DUPLICATE', 'INVALID');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'ORGANIZER',
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "gmailConnected" BOOLEAN NOT NULL DEFAULT false,
    "encryptedRefreshToken" TEXT,
    "dailyCap" INTEGER NOT NULL DEFAULT 1000,
    "rampEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedReason" TEXT,
    "pausedUntil" TIMESTAMP(3),
    "firstSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "uni" TEXT NOT NULL DEFAULT '',
    "verification" "Verification" NOT NULL DEFAULT 'UNKNOWN',
    "assignedToId" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "gmailThreadId" TEXT,
    "gmailMessageId" TEXT,
    "errorNote" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "subject" TEXT NOT NULL DEFAULT 'Partnering with HackUTD',
    "body" TEXT NOT NULL DEFAULT 'Hi {{first_name}},

I''m {{sender_name}} from HackUTD, UT Dallas''s student hackathon. We''d love to have {{uni}} students and faculty involved.

Would you be open to a quick chat?

Thanks,
{{sender_name}}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mailingAddress" TEXT NOT NULL DEFAULT 'HackUTD, The University of Texas at Dallas, 800 W Campbell Rd, Richardson, TX 75080',
    "allowNonValid" BOOLEAN NOT NULL DEFAULT false,
    "maxPerOrganizer" INTEGER NOT NULL DEFAULT 1300,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotaUnits" INTEGER NOT NULL DEFAULT 100,
    "result" TEXT NOT NULL,

    CONSTRAINT "SendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaUsage" (
    "date" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "ProcessedMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_assignedToId_status_idx" ON "Contact"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "Contact_status_sentAt_idx" ON "Contact"("status", "sentAt");

-- CreateIndex
CREATE INDEX "SendLog_userId_sentAt_idx" ON "SendLog"("userId", "sentAt");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

