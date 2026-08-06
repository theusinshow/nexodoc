-- CreateTable
CREATE TABLE "NexoConversation" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "folderKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "auditoriaPendente" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NexoConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NexoConversation_userEmail_updatedAt_idx" ON "NexoConversation"("userEmail", "updatedAt");
