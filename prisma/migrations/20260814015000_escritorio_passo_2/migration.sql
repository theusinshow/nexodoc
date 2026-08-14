-- OS DONOS DE PROJETO VIRAM MEMBROS DA PROSUL.
--
-- POR QUE ISTO É MIGRATION, E NÃO SCRIPT
--
-- Era `scripts/backfill-escritorio.ts`, rodado à mão. O Dockerfile encadeia
-- `prisma migrate deploy && npm run start`: não existe momento entre a migração
-- e o início do aplicativo em que alguém possa rodar um script. E o portão
-- (`requireActor`) exige vínculo ATIVO com escritório — sem estas linhas, o
-- aplicativo subiria recusando todo mundo com 403, inclusive o mantenedor.
--
-- Como migration, o banco fica consistente ANTES de o processo web existir.
-- Não há janela.
--
-- É determinístico: um membro por `ownerEmail` distinto de projeto vivo. Rodar
-- duas vezes não duplica (o `ON CONFLICT` cuida), e nada aqui apaga.

INSERT INTO "OrganizationMember" ("id", "organizationId", "email", "name", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'org-prosul',
  donos."ownerEmail",
  donos."ownerName",
  u."id",
  /*
   * O DONO DO PROJETO MAIS ANTIGO vira OWNER; o resto, MEMBER.
   *
   * É um chute, e assumido: não há no banco nada que diga quem coordena a
   * PROSUL. É seguro porque se corrige por tela em dois cliques — já promover
   * todo mundo a OWNER não seria, porque OWNER pode remover os outros.
   *
   * `ORDER BY` pelo projeto mais antigo, e não pelo e-mail: quem cadastrou o
   * primeiro projeto é a aposta mais razoável para quem montou o escritório.
   */
  CASE WHEN donos."ordem" = 1 THEN 'OWNER'::"OrganizationRole" ELSE 'MEMBER'::"OrganizationRole" END,
  'ACTIVE'::"OrganizationMemberStatus",
  NOW(),
  NOW()
FROM (
  SELECT
    p."ownerEmail",
    MIN(p."ownerName") AS "ownerName",
    ROW_NUMBER() OVER (ORDER BY MIN(p."createdAt") ASC) AS "ordem"
  FROM "Project" p
  WHERE p."deletedAt" IS NULL
  GROUP BY p."ownerEmail"
) AS donos
LEFT JOIN "User" u ON LOWER(u."email") = LOWER(donos."ownerEmail")
ON CONFLICT ("organizationId", "email") DO NOTHING;

/*
 * E O MANTENEDOR DA PLATAFORMA, mesmo sem projeto nenhum.
 *
 * `NEXODOC_ADMIN_EMAILS` abre o `/admin`, e não o escritório — são dois eixos
 * distintos de propósito. Numa instância onde o mantenedor nunca criou projeto,
 * ele ficaria de fora do backfill acima e sem acesso a nada além do painel:
 * trancado para fora do sistema que administra, sem ninguém para o liberar.
 *
 * Entra como ADMIN, e não OWNER: quem responde pela PROSUL é a PROSUL.
 */
INSERT INTO "OrganizationMember" ("id", "organizationId", "email", "name", "userId", "role", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'org-prosul',
  LOWER(u."email"),
  u."name",
  u."id",
  'ADMIN'::"OrganizationRole",
  'ACTIVE'::"OrganizationMemberStatus",
  NOW(),
  NOW()
FROM "User" u
WHERE u."role" = 'ADMIN' AND u."isActive" = TRUE
ON CONFLICT ("organizationId", "email") DO NOTHING;
