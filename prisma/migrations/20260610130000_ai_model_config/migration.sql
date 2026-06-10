CREATE TABLE "AiModelConfig" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiModelConfig_flowId_key" ON "AiModelConfig"("flowId");
CREATE INDEX "AiModelConfig_isActive_updatedAt_idx" ON "AiModelConfig"("isActive", "updatedAt");
CREATE INDEX "AiModelConfig_model_idx" ON "AiModelConfig"("model");
