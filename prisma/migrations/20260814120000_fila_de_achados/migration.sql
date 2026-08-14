-- A FILA: quem está com qual achado, e como ele foi encerrado.
--
-- Tudo nulável e tudo aditivo: nenhuma linha existente muda de significado, e o
-- rollback é derrubar as colunas. Não há backfill porque não há o que preencher
-- -- pendência só existe a partir do momento em que alguém envia um achado a
-- alguém.

CREATE TYPE "FindingResolutionKind" AS ENUM ('FIXED_IN_DOC', 'FALSE_POSITIVE', 'ACCEPTED_RISK');

ALTER TABLE "AuditFeedback" ADD COLUMN "fingerprint"    TEXT;
ALTER TABLE "AuditFeedback" ADD COLUMN "assigneeEmail"  TEXT;
ALTER TABLE "AuditFeedback" ADD COLUMN "assignedById"   TEXT;
ALTER TABLE "AuditFeedback" ADD COLUMN "assignedAt"     TIMESTAMP(3);
ALTER TABLE "AuditFeedback" ADD COLUMN "resolutionKind" "FindingResolutionKind";
ALTER TABLE "AuditFeedback" ADD COLUMN "resolvedById"   TEXT;

-- A consulta da home roda a cada login: o que está comigo e ainda não fechou.
CREATE INDEX "AuditFeedback_assigneeEmail_resolvedAt_idx"
  ON "AuditFeedback"("assigneeEmail", "resolvedAt");
