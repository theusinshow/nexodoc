-- O modelo de capa que o projeto já tinha (16/10/2026).
CREATE TABLE "ModeloDeCapaDoProjeto" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "criadoPor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeloDeCapaDoProjeto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModeloDeCapaDoProjeto_projectId_key" ON "ModeloDeCapaDoProjeto"("projectId");

ALTER TABLE "ModeloDeCapaDoProjeto" ADD CONSTRAINT "ModeloDeCapaDoProjeto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
