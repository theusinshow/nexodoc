-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "createdById" TEXT;

-- A PROSUL.
--
-- Semeada aqui, e nao por tela, por duas razoes. A primeira: o passo 2 (o
-- backfill) precisa dela existindo, e migracao que depende de alguem ter
-- clicado em algo nao e migracao. A segunda: cadastrar escritorio e ato de
-- admin (decisao B.2 do spec), e um ato de admin que so acontece uma vez na
-- vida do sistema e melhor escrito do que clicado.
--
-- O id e fixo de proposito: o backfill, as provas e o seed de desenvolvimento
-- se referem a ele por nome. Um cuid gerado obrigaria todos a descobrirem qual
-- e, e a descoberta erraria no dia em que houvesse duas organizacoes.
--
-- `ownerEmail` e o mantenedor da plataforma, nao um endereco inventado: e quem
-- responde por esta organizacao no sistema hoje. Quando a PROSUL designar o
-- proprio responsavel, isto vira um UPDATE de uma linha.
INSERT INTO "Organization" ("id", "name", "slug", "ownerEmail", "createdAt", "updatedAt")
VALUES ('org-prosul', 'PROSUL', 'prosul', 'matheusmendes077@gmail.com', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
