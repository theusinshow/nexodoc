-- O batimento da auditoria: último sinal de vida do processo que a roda.
-- Ver lib/batimento-da-auditoria.ts. Nulo é legítimo (linha criada antes desta
-- coluna, ou auditoria cujo primeiro batimento ainda não saiu).
-- AlterTable
ALTER TABLE "Audit" ADD COLUMN     "heartbeatAt" TIMESTAMP(3);
