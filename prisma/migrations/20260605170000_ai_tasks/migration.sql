-- CreateEnum
CREATE TYPE "AiTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "AiTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateTable
CREATE TABLE "AiTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "flow" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT,
    "model" TEXT,
    "status" "AiTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" "AiTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "inputHash" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "estimatedCostUsd" DOUBLE PRECISION,
    "actualCostUsd" DOUBLE PRECISION,
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AiTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiTask_projectId_createdAt_idx" ON "AiTask"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiTask_userEmail_createdAt_idx" ON "AiTask"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AiTask_flow_status_createdAt_idx" ON "AiTask"("flow", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiTask_agent_status_createdAt_idx" ON "AiTask"("agent", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AiTask_status_priority_createdAt_idx" ON "AiTask"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "AiTask_relatedType_relatedId_idx" ON "AiTask"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "AiTask_inputHash_idx" ON "AiTask"("inputHash");

-- AlterTable
ALTER TABLE "AiUsageEvent" ADD COLUMN "aiTaskId" TEXT;

-- CreateIndex
CREATE INDEX "AiUsageEvent_aiTaskId_createdAt_idx" ON "AiUsageEvent"("aiTaskId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiTask" ADD CONSTRAINT "AiTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTask" ADD CONSTRAINT "AiTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_aiTaskId_fkey" FOREIGN KEY ("aiTaskId") REFERENCES "AiTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
