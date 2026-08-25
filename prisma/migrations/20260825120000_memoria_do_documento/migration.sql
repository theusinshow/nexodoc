-- O texto do documento auditado, guardado para o chat pos-parecer poder RELER
-- o memorial. Ate agora a auditoria extraia e descartava: sobrava so o
-- extractedCharCount em AuditFile, e o chat nunca tinha visto o documento.
CREATE TABLE "AuditText" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "capitulos" JSONB NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditText_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditText_auditId_idx" ON "AuditText"("auditId");

-- Cascade: apagar a auditoria apaga o texto dela. Texto orfao nao serve a
-- ninguem e so ocupa espaco.
ALTER TABLE "AuditText" ADD CONSTRAINT "AuditText_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
