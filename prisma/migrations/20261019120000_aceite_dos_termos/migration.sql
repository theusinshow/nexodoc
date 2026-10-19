-- O aceite do termo de uso por pessoa (19/10/2026): quando e qual versão.
-- Nulo = nunca aceitou; a próxima auditoria pede o aceite antes de começar.
ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN "termsVersion" TEXT;
