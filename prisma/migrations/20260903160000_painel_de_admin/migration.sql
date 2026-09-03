-- A fundação do painel repaginado. Três tabelas, três razões distintas —
-- ver os comentários dos modelos em prisma/schema.prisma.
--
-- ConversaExpurgada é a LÁPIDE: a ordem explícita de apagar uma conversa,
-- que existe porque os bytes dos volumes montados vivem no IndexedDB da
-- máquina que montou, e `fundirListas` (com razão) nunca trata ausência
-- como ordem.
--
-- AcaoAdministrativa é a trilha: até aqui, nada registrava quem promoveu
-- quem ou quem apagou o quê.
--
-- ConfiguracaoDaPlataforma é a escada banco → ambiente → constante para os
-- números que hoje só existem em variável de ambiente.

-- CreateTable
CREATE TABLE "ConversaExpurgada" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "expurgadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expurgadaPor" TEXT NOT NULL,

    CONSTRAINT "ConversaExpurgada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoAdministrativa" (
    "id" TEXT NOT NULL,
    "quando" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quem" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alcance" TEXT NOT NULL DEFAULT '',
    "resumo" JSONB NOT NULL,

    CONSTRAINT "AcaoAdministrativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracaoDaPlataforma" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "declaradaPor" TEXT NOT NULL DEFAULT '',
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracaoDaPlataforma_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "ConversaExpurgada_userEmail_expurgadaEm_idx" ON "ConversaExpurgada"("userEmail", "expurgadaEm");

-- CreateIndex
CREATE INDEX "AcaoAdministrativa_quando_idx" ON "AcaoAdministrativa"("quando");
