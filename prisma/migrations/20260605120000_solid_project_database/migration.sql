-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AuditFeedbackVerdict" AS ENUM ('CONFIRMED', 'FALSE_POSITIVE', 'WRONG_SEVERITY', 'MISSING_FINDING');

-- CreateEnum
CREATE TYPE "LdDraftStatus" AS ENUM ('DRAFT', 'GENERATED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ProjectDocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentArtifactKind" AS ENUM ('COVER_ODT', 'COVER_PDF', 'COVER_ZIP', 'LD_ODT', 'LD_PDF', 'LD_REPORT', 'LD_ZIP', 'AUDIT_MARKDOWN', 'AUDIT_PDF', 'VOLUME_REPORT', 'VOLUME_PDF', 'VOLUME_ZIP', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentArtifactStatus" AS ENUM ('AVAILABLE', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "ProjectEventType" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'STATUS_CHANGED', 'PROJECT_ARCHIVED', 'PROJECT_DELETED', 'DOCUMENT_ADDED', 'DOCUMENT_ARCHIVED', 'INPUT_UPLOADED', 'AUDIT_CREATED', 'AUDIT_COMPLETED', 'LD_DRAFT_CREATED', 'LD_GENERATED', 'COVER_GENERATED', 'VOLUME_GENERATED', 'ARTIFACT_CREATED', 'NOTE_ADDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "ownerId" TEXT,
    "ownerEmail" TEXT NOT NULL,
    "ownerName" TEXT,
    "code" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/pdf',
    "sizeBytes" INTEGER,
    "pageCount" INTEGER,
    "checksumSha256" TEXT,
    "status" "ProjectDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpload" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "pageCount" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'none',
    "storageKey" TEXT,
    "checksumSha256" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "auditMode" TEXT NOT NULL,
    "analysisLevel" TEXT NOT NULL DEFAULT 'standard',
    "status" "AuditStatus" NOT NULL DEFAULT 'PROCESSING',
    "result" TEXT,
    "report" JSONB,
    "error" TEXT,
    "elapsedMs" INTEGER,
    "totalFindings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFeedback" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "findingId" TEXT,
    "findingLabel" TEXT,
    "page" TEXT,
    "verdict" "AuditFeedbackVerdict" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFile" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "pageCount" INTEGER,
    "extractedCharCount" INTEGER,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LdDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "userEmail" TEXT NOT NULL,
    "userName" TEXT,
    "title" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "workName" TEXT NOT NULL,
    "status" "LdDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "activeStep" INTEGER NOT NULL DEFAULT 0,
    "ldData" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "tomos" JSONB NOT NULL,
    "referenceTotal" INTEGER,
    "manualTotal" TEXT NOT NULL DEFAULT '',
    "uploadedFileNames" JSONB NOT NULL,
    "uploadedFileCount" INTEGER NOT NULL DEFAULT 0,
    "generatedFileNames" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3),

    CONSTRAINT "LdDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LdDraftEvent" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LdDraftEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentArtifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "auditId" TEXT,
    "ldDraftId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kind" "DocumentArtifactKind" NOT NULL,
    "status" "DocumentArtifactStatus" NOT NULL DEFAULT 'AVAILABLE',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "storageProvider" TEXT NOT NULL DEFAULT 'none',
    "storageKey" TEXT,
    "downloadUrl" TEXT,
    "checksumSha256" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "DocumentArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT,
    "type" "ProjectEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "taskId" TEXT,
    "taskLabel" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "error" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerEmail_createdAt_idx" ON "Organization"("ownerEmail", "createdAt");

-- CreateIndex
CREATE INDEX "Organization_archivedAt_idx" ON "Organization"("archivedAt");

-- CreateIndex
CREATE INDEX "OrganizationMember_email_status_idx" ON "OrganizationMember"("email", "status");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_email_key" ON "OrganizationMember"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Project_organizationId_updatedAt_idx" ON "Project"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_ownerEmail_updatedAt_idx" ON "Project"("ownerEmail", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_idx" ON "Project"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_ownerEmail_code_key" ON "Project"("ownerEmail", "code");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_createdAt_idx" ON "ProjectDocument"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_userEmail_createdAt_idx" ON "ProjectDocument"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_module_createdAt_idx" ON "ProjectDocument"("module", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_documentType_createdAt_idx" ON "ProjectDocument"("documentType", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectDocument_checksumSha256_idx" ON "ProjectDocument"("checksumSha256");

-- CreateIndex
CREATE INDEX "ProjectUpload_projectId_createdAt_idx" ON "ProjectUpload"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpload_userEmail_createdAt_idx" ON "ProjectUpload"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpload_module_createdAt_idx" ON "ProjectUpload"("module", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectUpload_checksumSha256_idx" ON "ProjectUpload"("checksumSha256");

-- CreateIndex
CREATE INDEX "ProjectUpload_storageProvider_storageKey_idx" ON "ProjectUpload"("storageProvider", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Audit_projectId_createdAt_idx" ON "Audit"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Audit_userId_createdAt_idx" ON "Audit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Audit_status_createdAt_idx" ON "Audit"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditFeedback_auditId_createdAt_idx" ON "AuditFeedback"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditFeedback_verdict_createdAt_idx" ON "AuditFeedback"("verdict", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditFeedback_auditId_targetKey_key" ON "AuditFeedback"("auditId", "targetKey");

-- CreateIndex
CREATE INDEX "AuditFile_auditId_idx" ON "AuditFile"("auditId");

-- CreateIndex
CREATE INDEX "LdDraft_projectId_updatedAt_idx" ON "LdDraft"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "LdDraft_userEmail_updatedAt_idx" ON "LdDraft"("userEmail", "updatedAt");

-- CreateIndex
CREATE INDEX "LdDraft_status_updatedAt_idx" ON "LdDraft"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "LdDraftEvent_draftId_createdAt_idx" ON "LdDraftEvent"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "LdDraftEvent_actorEmail_createdAt_idx" ON "LdDraftEvent"("actorEmail", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_projectId_createdAt_idx" ON "DocumentArtifact"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_auditId_createdAt_idx" ON "DocumentArtifact"("auditId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_ldDraftId_createdAt_idx" ON "DocumentArtifact"("ldDraftId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_userEmail_createdAt_idx" ON "DocumentArtifact"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_module_createdAt_idx" ON "DocumentArtifact"("module", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_kind_createdAt_idx" ON "DocumentArtifact"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_status_createdAt_idx" ON "DocumentArtifact"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentArtifact_storageProvider_storageKey_idx" ON "DocumentArtifact"("storageProvider", "storageKey");

-- CreateIndex
CREATE INDEX "DocumentArtifact_checksumSha256_idx" ON "DocumentArtifact"("checksumSha256");

-- CreateIndex
CREATE INDEX "ProjectEvent_projectId_createdAt_idx" ON "ProjectEvent"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectEvent_actorEmail_createdAt_idx" ON "ProjectEvent"("actorEmail", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectEvent_type_createdAt_idx" ON "ProjectEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_createdAt_idx" ON "AiUsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_flow_createdAt_idx" ON "AiUsageEvent"("flow", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_taskId_createdAt_idx" ON "AiUsageEvent"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_userEmail_createdAt_idx" ON "AiUsageEvent"("userEmail", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_model_createdAt_idx" ON "AiUsageEvent"("model", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpload" ADD CONSTRAINT "ProjectUpload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpload" ADD CONSTRAINT "ProjectUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFeedback" ADD CONSTRAINT "AuditFeedback_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFile" ADD CONSTRAINT "AuditFile_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LdDraft" ADD CONSTRAINT "LdDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LdDraftEvent" ADD CONSTRAINT "LdDraftEvent_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "LdDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_ldDraftId_fkey" FOREIGN KEY ("ldDraftId") REFERENCES "LdDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectEvent" ADD CONSTRAINT "ProjectEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
