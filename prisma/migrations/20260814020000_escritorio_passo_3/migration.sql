-- O APERTO: o dono do projeto passa a ser o escritorio, e o banco garante.
--
-- Escrito a mao, e nao gerado, por duas razoes. `prisma migrate dev` recusa
-- rodar fora de terminal interativo; e aqui a ORDEM importa mais do que o
-- conteudo -- a rede de seguranca do passo 1 tem que vir antes do NOT NULL, e o
-- unique novo tem que existir antes de o velho sair, senao ha um instante sem
-- nenhuma garantia de unicidade.
--
-- SO RODE DEPOIS de `npm run diag:cc` sair LIVRE e do backfill fechar as
-- contas. Se sobrar projeto sem organizacao, o NOT NULL aqui derruba a
-- migration inteira -- que e o comportamento certo, e nao um acidente.

-- Rede de seguranca: projeto que escapou do backfill vai para a PROSUL em vez
-- de derrubar o deploy. Se isto pegar alguma linha, o backfill nao rodou.
UPDATE "Project" SET "organizationId" = 'org-prosul' WHERE "organizationId" IS NULL;

-- 1. O dono deixa de aceitar nulo.
ALTER TABLE "Project" ALTER COLUMN "organizationId" SET NOT NULL;

-- 2. O centro de custo deixa de ter vazio como padrao. Nao se apaga o vazio de
--    quem ja tem: isso e decisao humana, projeto por projeto (ver diag:cc).
ALTER TABLE "Project" ALTER COLUMN "code" DROP DEFAULT;

-- 3. O unico novo ANTES de o velho sair.
CREATE UNIQUE INDEX "Project_organizationId_code_key" ON "Project"("organizationId", "code");
DROP INDEX "Project_ownerEmail_code_key";

-- 4. O indice por dono nao serve mais a consulta nenhuma: a listagem passou a
--    ser por escritorio.
DROP INDEX "Project_ownerEmail_updatedAt_idx";

-- 5. Apagar a organizacao deixaria projeto orfao, que e o estado que este
--    trabalho eliminou. RESTRICT recusa em vez de zerar.
ALTER TABLE "Project" DROP CONSTRAINT "Project_organizationId_fkey";
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
