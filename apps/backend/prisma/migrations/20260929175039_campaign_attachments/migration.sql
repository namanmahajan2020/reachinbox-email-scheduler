/*
  Warnings:

  - You are about to drop the `EmailAttachment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EmailAttachment" DROP CONSTRAINT "EmailAttachment_emailId_fkey";

-- DropTable
DROP TABLE "EmailAttachment";

-- CreateTable
CREATE TABLE "CampaignAttachment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentBase64" TEXT NOT NULL,

    CONSTRAINT "CampaignAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampaignAttachment_campaignId_idx" ON "CampaignAttachment"("campaignId");

-- AddForeignKey
ALTER TABLE "CampaignAttachment" ADD CONSTRAINT "CampaignAttachment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
