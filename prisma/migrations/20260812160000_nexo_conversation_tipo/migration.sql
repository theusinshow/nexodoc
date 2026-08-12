-- A barra lateral separa "Montagem de volumes" de "Auditorias", e o tipo vivia
-- so dentro do JSON `data`. A listagem le apenas as colunas de fora, entao o
-- servidor nao conseguia tipar: num primeiro acesso, noutro navegador ou com o
-- cache limpo, TODA conversa caia em "volume". Mesma razao da coluna
-- `auditoriaPendente`, que ja existe por este motivo.
--
-- Nulavel de proposito: os registros gravados antes desta coluna nao tem tipo, e
-- `tipoDoResumo` aplica o padrao. Eles se corrigem sozinhos na proxima gravacao,
-- porque o cliente rederiva o tipo a cada save.
ALTER TABLE "NexoConversation" ADD COLUMN "tipo" TEXT;

-- Backfill do que da para saber sem abrir o JSON inteiro: conversa com auditoria
-- pendente e, por definicao da regra de derivacao, do tipo auditoria.
UPDATE "NexoConversation" SET "tipo" = 'auditoria' WHERE "auditoriaPendente" = true;
