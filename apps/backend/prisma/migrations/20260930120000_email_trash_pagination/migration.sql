ALTER TABLE "Email" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Email_deletedAt_scheduledAt_idx" ON "Email"("deletedAt", "scheduledAt");
CREATE INDEX "Email_isArchived_isStarred_scheduledAt_idx" ON "Email"("isArchived", "isStarred", "scheduledAt");
