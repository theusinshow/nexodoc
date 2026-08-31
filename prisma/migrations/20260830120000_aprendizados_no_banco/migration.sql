-- O acervo de aprendizados da auditoria sai do disco e vem para o banco.
--
-- Vivia num JSON em `process.cwd()/data/`, e o container da Render nao declara
-- disco persistente: cada deploy zerava o acervo. Com `autoDeploy` ligado, isso
-- acontecia a cada push -- as telas gravavam, a subida seguinte apagava, e nada
-- no produto acusava a perda.
--
-- A tabela nasce VAZIA de proposito. O que ja existia em disco entra pela
-- importacao unica de `lib/audit-learnings.ts`, que so roda quando a tabela
-- esta vazia -- em producao ela provavelmente esta, porque o arquivo de la ja
-- se perdeu no ultimo deploy.
CREATE TABLE "AuditLearning" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'preference',
    "scope" TEXT NOT NULL DEFAULT 'global',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLearning_pkey" PRIMARY KEY ("id")
);

-- A leitura quente: os ativos de um escopo, do mais recente para o mais antigo.
-- E o que toda auditoria pede antes de montar o prompt.
CREATE INDEX "AuditLearning_status_scope_updatedAt_idx"
    ON "AuditLearning"("status", "scope", "updatedAt");

-- A tela de admin lista tudo, sem filtro, na mesma ordem.
CREATE INDEX "AuditLearning_updatedAt_idx" ON "AuditLearning"("updatedAt");
