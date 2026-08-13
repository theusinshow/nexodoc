-- Os dados do escritorio emissor: nome, endereco impresso nas pranchas, CREA.
--
-- Linha unica ("escritorio"). Nao ha backfill possivel e nao ha default: o
-- endereco de um escritorio nao se adivinha, e adivinha-lo seria pior que nao
-- ter, porque ele passa a SUBTRAIR texto do casamento cidade->template. Sem a
-- linha, nada muda em relacao ao comportamento anterior.
CREATE TABLE "EscritorioConfig" (
    "id" TEXT NOT NULL DEFAULT 'escritorio',
    "nome" TEXT NOT NULL DEFAULT '',
    "enderecoImpresso" TEXT NOT NULL DEFAULT '',
    "municipio" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "responsavelTecnico" TEXT NOT NULL DEFAULT '',
    "crea" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscritorioConfig_pkey" PRIMARY KEY ("id")
);
