/** Prova os helpers P2 contra um Postgres migrado, idealmente descartável. */
import assert from "node:assert/strict";

import nextEnv from "@next/env";

if (!process.env.DATABASE_URL?.trim()) {
  nextEnv.loadEnvConfig(process.cwd());
}

const { createAuditLearning, deleteAuditLearning, listAuditLearnings, updateAuditLearning } =
  await import("../lib/audit-learnings.ts");
const { getPrisma } = await import("../lib/db.ts");
const { createDocumentArtifact, InvalidArtifactRelation } =
  await import("../lib/project-store.ts");

const prisma = getPrisma();
const expectedSchema = process.env.NEXODOC_SECURITY_TEST_SCHEMA?.trim();
if (expectedSchema) {
  const [connection] = await prisma.$queryRaw<Array<{ currentSchema: string | null }>>`
    SELECT current_schema() AS "currentSchema"
  `;
  if (connection?.currentSchema !== expectedSchema) {
    await prisma.$disconnect();
    throw new Error(
      `Prova P2 recusada fora do schema descartavel: esperado ${expectedSchema}, ` +
        `recebido ${connection?.currentSchema ?? "nenhum"}.`,
    );
  }
  console.log(`Conexão da prova isolada no schema: ${expectedSchema}`);
}
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const ids = {
  orgA: `qa-p2-org-a-${suffix}`,
  orgB: `qa-p2-org-b-${suffix}`,
  emailA: `qa-p2-a-${suffix}@example.test`,
  emailB: `qa-p2-b-${suffix}@example.test`,
  auditA: `qa-p2-audit-a-${suffix}`,
  auditB: `qa-p2-audit-b-${suffix}`,
  draftA: `qa-p2-draft-a-${suffix}`,
  draftB: `qa-p2-draft-b-${suffix}`,
};

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FALHOU  ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

let projectA: { id: string } | null = null;
let projectB: { id: string } | null = null;

try {
  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: { name: "QA P2 A", email: ids.emailA, passwordHash: "google-oauth" },
    }),
    prisma.user.create({
      data: { name: "QA P2 B", email: ids.emailB, passwordHash: "google-oauth" },
    }),
  ]);

  await prisma.organization.createMany({
    data: [
      { id: ids.orgA, slug: ids.orgA, name: "QA P2 A", ownerEmail: ids.emailA },
      { id: ids.orgB, slug: ids.orgB, name: "QA P2 B", ownerEmail: ids.emailB },
    ],
  });
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: ids.orgA, userId: userA.id, email: ids.emailA, status: "ACTIVE" },
      { organizationId: ids.orgB, userId: userB.id, email: ids.emailB, status: "ACTIVE" },
    ],
  });

  [projectA, projectB] = await Promise.all([
    prisma.project.create({
      data: { organizationId: ids.orgA, code: "P2-A", name: "Projeto P2 A", ownerEmail: ids.emailA },
      select: { id: true },
    }),
    prisma.project.create({
      data: { organizationId: ids.orgB, code: "P2-B", name: "Projeto P2 B", ownerEmail: ids.emailB },
      select: { id: true },
    }),
  ]);

  await prisma.audit.createMany({
    data: [
      { id: ids.auditA, userId: userA.id, projectId: projectA.id, title: "A", projectName: "A", auditMode: "memorial" },
      { id: ids.auditB, userId: userB.id, projectId: projectB.id, title: "B", projectName: "B", auditMode: "memorial" },
    ],
  });
  await prisma.ldDraft.createMany({
    data: [
      {
        id: ids.draftA,
        projectId: projectA.id,
        userEmail: ids.emailA,
        title: "A",
        projectCode: "P2-A",
        workName: "A",
        ldData: {},
        rows: [],
        tomos: [],
        uploadedFileNames: [],
        generatedFileNames: [],
      },
      {
        id: ids.draftB,
        projectId: projectB.id,
        userEmail: ids.emailB,
        title: "B",
        projectCode: "P2-B",
        workName: "B",
        ldData: {},
        rows: [],
        tomos: [],
        uploadedFileNames: [],
        generatedFileNames: [],
      },
    ],
  });

  let learningA = "";
  let learningB = "";
  await test("cada organização lista somente seus aprendizados", async () => {
    learningA = (await createAuditLearning(ids.orgA, { title: "Regra A", content: "Somente A" })).id;
    learningB = (await createAuditLearning(ids.orgB, { title: "Regra B", content: "Somente B" })).id;
    const listaA = await listAuditLearnings({ organizationId: ids.orgA });
    const listaB = await listAuditLearnings({ organizationId: ids.orgB });
    assert.deepEqual(listaA.map((item) => item.id), [learningA]);
    assert.deepEqual(listaB.map((item) => item.id), [learningB]);
  });

  await test("organização B não altera nem apaga aprendizado de A", async () => {
    assert.equal(await updateAuditLearning(ids.orgB, learningA, { status: "paused" }), null);
    assert.equal(await deleteAuditLearning(ids.orgB, learningA), false);
    const original = await prisma.auditLearning.findUnique({ where: { id: learningA } });
    assert.equal(original?.organizationId, ids.orgA);
    assert.equal(original?.status, "active");
  });

  const actorA = { id: userA.id, email: ids.emailA, name: "QA P2 A" };
  await test("auditId de outro projeto é recusado sem criar artefato", async () => {
    await assert.rejects(
      prisma.$transaction((tx) =>
        createDocumentArtifact(tx, {
          projectId: projectA!.id,
          auditId: ids.auditB,
          actor: actorA,
          module: "qa",
          kind: "AUDIT_PDF",
          fileName: "cruzado.pdf",
          mimeType: "application/pdf",
        }),
      ),
      InvalidArtifactRelation,
    );
  });

  await test("ldDraftId de outro projeto é recusado sem criar artefato", async () => {
    await assert.rejects(
      prisma.$transaction((tx) =>
        createDocumentArtifact(tx, {
          projectId: projectA!.id,
          ldDraftId: ids.draftB,
          actor: actorA,
          module: "qa",
          kind: "LD_PDF",
          fileName: "cruzado-ld.pdf",
          mimeType: "application/pdf",
        }),
      ),
      InvalidArtifactRelation,
    );
  });

  await test("relações do mesmo projeto continuam aceitas", async () => {
    await prisma.$transaction(async (tx) => {
      await createDocumentArtifact(tx, {
        projectId: projectA!.id,
        auditId: ids.auditA,
        actor: actorA,
        module: "qa",
        kind: "AUDIT_PDF",
        fileName: "proprio.pdf",
        mimeType: "application/pdf",
      });
      await createDocumentArtifact(tx, {
        projectId: projectA!.id,
        ldDraftId: ids.draftA,
        actor: actorA,
        module: "qa",
        kind: "LD_PDF",
        fileName: "proprio-ld.pdf",
        mimeType: "application/pdf",
      });
    });
    assert.equal(await prisma.documentArtifact.count({ where: { projectId: projectA!.id } }), 2);
  });
} finally {
  await prisma.documentArtifact.deleteMany({
    where: { projectId: { in: [projectA?.id ?? "", projectB?.id ?? ""] } },
  });
  await prisma.auditLearning.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB] } } });
  await prisma.audit.deleteMany({ where: { id: { in: [ids.auditA, ids.auditB] } } });
  await prisma.ldDraft.deleteMany({ where: { id: { in: [ids.draftA, ids.draftB] } } });
  await prisma.projectEvent.deleteMany({
    where: { projectId: { in: [projectA?.id ?? "", projectB?.id ?? ""] } },
  });
  await prisma.project.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB] } } });
  await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [ids.orgA, ids.orgB] } } });
  await prisma.user.deleteMany({ where: { email: { in: [ids.emailA, ids.emailB] } } });
  await prisma.$disconnect();
}

console.log(`\n${passed} prova(s) P2 passaram.`);
process.exit(process.exitCode ?? 0);
