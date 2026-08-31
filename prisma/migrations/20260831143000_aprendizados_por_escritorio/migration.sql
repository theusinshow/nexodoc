-- O aprendizado pertence ao escritorio que o ensinou.
--
-- O acervo anterior nasceu quando existia apenas a PROSUL. A migration
-- `20260814013954_escritorio_passo_1` garante que `org-prosul` existe tanto no
-- replay de um banco novo quanto no banco historico; por isso o backfill e
-- explicito, em vez de escolher arbitrariamente a primeira organizacao.
ALTER TABLE "AuditLearning" ADD COLUMN "organizationId" TEXT;

UPDATE "AuditLearning"
SET "organizationId" = 'org-prosul'
WHERE "organizationId" IS NULL;

ALTER TABLE "AuditLearning"
  ALTER COLUMN "organizationId" SET NOT NULL;

DROP INDEX "AuditLearning_status_scope_updatedAt_idx";
DROP INDEX "AuditLearning_updatedAt_idx";

CREATE INDEX "AuditLearning_organizationId_status_scope_updatedAt_idx"
  ON "AuditLearning"("organizationId", "status", "scope", "updatedAt");

CREATE INDEX "AuditLearning_organizationId_updatedAt_idx"
  ON "AuditLearning"("organizationId", "updatedAt");

ALTER TABLE "AuditLearning"
  ADD CONSTRAINT "AuditLearning_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
