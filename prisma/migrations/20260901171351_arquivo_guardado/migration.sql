-- AlterTable
ALTER TABLE "AuditFile" ADD COLUMN     "checksumSha256" TEXT;

-- CreateTable
CREATE TABLE "StoredFile" (
    "checksumSha256" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("checksumSha256")
);

-- CreateIndex
CREATE INDEX "StoredFile_organizationId_createdAt_idx" ON "StoredFile"("organizationId", "createdAt");
