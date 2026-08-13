-- A cotacao do dolar declarada a mao, com data e autor.
--
-- Linha unica ("cambio"). Sem default de valor util e sem backfill: uma cotacao
-- inventada seria pior que nenhuma, porque o painel passaria a exibir reais com
-- cara de precisao e sem procedencia. Sem a linha, o consumo continua em dolar.
CREATE TABLE "CambioConfig" (
    "id" TEXT NOT NULL DEFAULT 'cambio',
    "valor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "declaradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "declaradaPor" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CambioConfig_pkey" PRIMARY KEY ("id")
);
