-- AlterTable
ALTER TABLE "AiUsageEvent" ADD COLUMN     "conversationId" TEXT;

-- CreateIndex
CREATE INDEX "AiUsageEvent_conversationId_idx" ON "AiUsageEvent"("conversationId");
