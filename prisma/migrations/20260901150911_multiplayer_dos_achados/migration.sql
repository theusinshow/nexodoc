-- CreateTable
CREATE TABLE "AuditFindingMessage" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFindingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFindingWatcher" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "addedById" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFindingWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditFindingMessage_feedbackId_createdAt_idx" ON "AuditFindingMessage"("feedbackId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditFindingWatcher_email_notifiedAt_idx" ON "AuditFindingWatcher"("email", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFindingWatcher_feedbackId_email_key" ON "AuditFindingWatcher"("feedbackId", "email");

-- AddForeignKey
ALTER TABLE "AuditFindingMessage" ADD CONSTRAINT "AuditFindingMessage_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "AuditFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFindingWatcher" ADD CONSTRAINT "AuditFindingWatcher_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "AuditFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
