-- As metas do painel de Quality, declaradas a mao.
--
-- Linha unica ("meta-qualidade"). Os defaults sao ZERO, que o codigo le como
-- "meta nao declarada" -- nao como "meta de 0%". A distincao importa: sem meta o
-- painel nao aprova nem reprova, e e isso que impede um numero inventado no
-- momento da migracao de virar o criterio de qualidade do produto.
CREATE TABLE "MetaQualidadeConfig" (
    "id" TEXT NOT NULL DEFAULT 'meta-qualidade',
    "falsoPositivoMax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "coberturaMin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "declaradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaradaPor" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaQualidadeConfig_pkey" PRIMARY KEY ("id")
);
