// Prova end-to-end dos auditIds: um escritório não lê nem altera o outro.
// Exige banco, servidor de desenvolvimento e NEXODOC_DEV_AUTH=true.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const ids = {
  orgA: `qa-sec-org-a-${suffix}`,
  orgB: `qa-sec-org-b-${suffix}`,
  slugA: `qa-sec-a-${suffix}`,
  slugB: `qa-sec-b-${suffix}`,
  emailA: `qa-sec-a-${suffix}@example.test`,
  emailB: `qa-sec-b-${suffix}@example.test`,
  auditA: `audit-sec-a-${suffix}`,
  auditB: `audit-sec-b-${suffix}`,
};

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();
let browser;

try {
  const [userA, userB] = await Promise.all([
    prisma.user.create({
      data: { name: "QA Segurança A", email: ids.emailA, passwordHash: "google-oauth" },
    }),
    prisma.user.create({
      data: { name: "QA Segurança B", email: ids.emailB, passwordHash: "google-oauth" },
    }),
  ]);

  await prisma.organization.createMany({
    data: [
      { id: ids.orgA, slug: ids.slugA, name: "QA Segurança A", ownerEmail: ids.emailA },
      { id: ids.orgB, slug: ids.slugB, name: "QA Segurança B", ownerEmail: ids.emailB },
    ],
  });

  await prisma.organizationMember.createMany({
    data: [
      {
        organizationId: ids.orgA,
        userId: userA.id,
        email: ids.emailA,
        name: "QA Segurança A",
        status: "ACTIVE",
      },
      {
        organizationId: ids.orgB,
        userId: userB.id,
        email: ids.emailB,
        name: "QA Segurança B",
        status: "ACTIVE",
      },
    ],
  });

  const [projectA, projectB] = await Promise.all([
    prisma.project.create({
      data: {
        organizationId: ids.orgA,
        code: "SEC-A",
        name: "Projeto isolado A",
        ownerEmail: ids.emailA,
      },
    }),
    prisma.project.create({
      data: {
        organizationId: ids.orgB,
        code: "SEC-B",
        name: "Projeto isolado B",
        ownerEmail: ids.emailB,
      },
    }),
  ]);

  await prisma.audit.createMany({
    data: [
      {
        id: ids.auditA,
        userId: userA.id,
        projectId: projectA.id,
        title: "Auditoria A",
        projectName: "Projeto isolado A",
        auditMode: "memorial",
        status: "PROCESSING",
      },
      {
        id: ids.auditB,
        userId: userB.id,
        projectId: projectB.id,
        title: "Auditoria B",
        projectName: "Projeto isolado B",
        auditMode: "memorial",
        status: "PROCESSING",
      },
    ],
  });

  await prisma.auditFeedback.createMany({
    data: [
      {
        auditId: ids.auditA,
        targetKey: "finding:QA-A",
        findingId: "QA-A",
        verdict: "CONFIRMED",
      },
      {
        auditId: ids.auditB,
        targetKey: "finding:QA-B",
        findingId: "QA-B",
        verdict: "FALSE_POSITIVE",
      },
    ],
  });

  browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL: BASE });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  await entrarComo(page, ids.emailA);

  const recent = await page.request.get("/api/audits/recent?limit=50");
  const recentBody = await recent.json();
  const auditIds = (recentBody.audits ?? []).map((audit) => audit.id);
  check("histórico inclui a auditoria do próprio escritório", auditIds.includes(ids.auditA));
  check("histórico não inclui auditoria estrangeira", !auditIds.includes(ids.auditB));

  const quality = await page.request.get("/api/audits/quality");
  const qualityBody = await quality.json();
  check(
    "métrica conta apenas o feedback do próprio escritório",
    qualityBody.total === 1 && qualityBody.confirmed === 1 && qualityBody.falsePositive === 0,
    JSON.stringify(qualityBody),
  );

  const ownFeedback = await page.request.get(`/api/audits/${ids.auditA}/feedback`);
  check("feedback próprio continua legível", ownFeedback.status() === 200);

  const foreignFeedback = await page.request.get(`/api/audits/${ids.auditB}/feedback`);
  check("feedback estrangeiro responde 404", foreignFeedback.status() === 404);

  const writeForeignFeedback = await page.request.post(`/api/audits/${ids.auditB}/feedback`, {
    data: { findingId: "INJETADO", verdict: "CONFIRMED" },
  });
  check("feedback estrangeiro não pode ser gravado", writeForeignFeedback.status() === 404);

  const cancelForeign = await page.request.patch(`/api/audit/${ids.auditB}/cancel`);
  const cancelForeignBody = await cancelForeign.json();
  check("cancelamento estrangeiro não altera linha", cancelForeignBody.canceled === false);

  const cancelOwn = await page.request.patch(`/api/audit/${ids.auditA}/cancel`);
  const cancelOwnBody = await cancelOwn.json();
  check("cancelamento próprio continua funcionando", cancelOwnBody.canceled === true);

  const deltaForeign = await page.request.post("/api/audit/delta", {
    multipart: {
      auditIdAnterior: ids.auditB,
      file: { name: "nao-deve-ser-lido.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") },
    },
  });
  const deltaBody = await deltaForeign.json();
  check(
    "delta estrangeiro não encontra a auditoria-base",
    deltaBody.comparavel === false && deltaBody.motivo === "sem-auditoria-anterior",
    JSON.stringify(deltaBody),
  );

  const chatForeign = await page.request.post("/api/audit/chat", {
    data: {
      question: "Leia o documento",
      auditId: ids.auditB,
      projectId: projectB.id,
      report: { tipo_auditoria: "memorial", incongruencias: [] },
    },
  });
  check("chat estrangeiro para antes de chamar o modelo", chatForeign.status() === 404);

  const foreignAfter = await prisma.audit.findUnique({
    where: { id: ids.auditB },
    select: { status: true },
  });
  const injected = await prisma.auditFeedback.count({
    where: { auditId: ids.auditB, findingId: "INJETADO" },
  });
  check("auditoria estrangeira permaneceu PROCESSING", foreignAfter?.status === "PROCESSING");
  check("nenhum feedback foi injetado na auditoria estrangeira", injected === 0);
} finally {
  if (browser) await browser.close();
  await prisma.audit.deleteMany({ where: { id: { in: [ids.auditA, ids.auditB] } } });
  await prisma.project.deleteMany({ where: { organizationId: { in: [ids.orgA, ids.orgB] } } });
  await prisma.organizationMember.deleteMany({
    where: { organizationId: { in: [ids.orgA, ids.orgB] } },
  });
  await prisma.organization.deleteMany({ where: { id: { in: [ids.orgA, ids.orgB] } } });
  await prisma.user.deleteMany({ where: { email: { in: [ids.emailA, ids.emailB] } } });
}

console.log(falhas === 0 ? "\nOK  isolamento de auditorias" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
