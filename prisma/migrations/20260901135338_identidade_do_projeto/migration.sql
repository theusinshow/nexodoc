-- AlterTable
ALTER TABLE "NexoConversation" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientKey" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "NexoConversation_projectId_updatedAt_idx" ON "NexoConversation"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_organizationId_clientKey_idx" ON "Project"("organizationId", "clientKey");

-- AddForeignKey
ALTER TABLE "NexoConversation" ADD CONSTRAINT "NexoConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
