-- "Corrigido" passa a sobreviver a trocar de maquina.
--
-- Ate aqui, procedente/falso positivo iam para AuditFeedback (banco) e o
-- "corrigido" vivia so no JSON da conversa, no IndexedDB do navegador. Quem
-- revisasse metade do parecer no escritorio e abrisse em casa recomecava a
-- marcar do zero.
--
-- DUAS COLUNAS, E NAO UM QUARTO VEREDITO. As perguntas sao independentes: o
-- achado procede? e ja foi corrigido? Um achado procedente e corrigido e o caso
-- normal. Emendar "RESOLVED" no enum obrigaria a escolher entre registrar o
-- julgamento -- que alimenta o benchmark -- e registrar o progresso.
ALTER TABLE "AuditFeedback" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- E por isso o veredito deixa de ser obrigatorio: marcar corrigido sem julgar e
-- legitimo, e era o unico caminho que a coluna NOT NULL bloqueava. As linhas
-- existentes ja tem veredito; nenhuma perde nada.
ALTER TABLE "AuditFeedback" ALTER COLUMN "verdict" DROP NOT NULL;
