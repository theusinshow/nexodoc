// O PARECER GRAVADO SEM `arquivos` ABRE O PDF MESMO ASSIM.
//
//   npm run dev                                            (noutro terminal)
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-parecer-sem-arquivos.mjs
//   (== npm run prova:parecer-sem-arquivos)
//
// 17/09/2026, 027_24 em produção: a auditoria terminou com a aba aberta, e o
// parecer entrou na conversa com `report`, `texto` e `auditId` — sem `arquivos`,
// que só a consulta de retomada traz. Aberta num navegador sem o PDF no
// IndexedDB, a aba "No documento" não existia, e a tela dizia "auditado antes de
// o sistema passar a guardá-lo" com o arquivo guardado no banco.
//
// A irmã desta, `prova-milton-abre-o-pdf.mjs`, entra pelo LINK do e-mail — que
// passa pela consulta de retomada e por isso nunca pegou este caminho. Aqui a
// conversa é semeada no SERVIDOR com o parecer como o fluxo o grava, e o
// contexto do navegador é novo: IndexedDB vazio.
//
// SEM IA. Tudo o que é criado é apagado no fim, por id.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { guardarArquivo } = await import("../lib/file-storage.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const EMAIL = process.env.NEXODOC_DEV_AUTH_EMAIL;
const prisma = getPrisma();

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

check("há e-mail do atalho de dev", Boolean(EMAIL), "NEXODOC_DEV_AUTH_EMAIL");
const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: "org-prosul" }, report: { not: null }, status: "COMPLETED" },
  orderBy: { createdAt: "desc" },
  select: { id: true, report: true, projectId: true },
});
check("existe auditoria com parecer", Boolean(audit), "rode npm run seed:dev");
if (!audit || !EMAIL) process.exit(1);

// PDF mínimo e válido: o visor tem de conseguir abri-lo.
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);
const guardado = await guardarArquivo({
  data: pdf,
  organizationId: "org-prosul",
  mimeType: "application/pdf",
});
// O seed não cria `AuditFile` — ver a prova do Milton.
await prisma.auditFile.deleteMany({ where: { auditId: audit.id } });
await prisma.auditFile.create({
  data: {
    auditId: audit.id,
    fileName: "memorial-de-prova.pdf",
    documentType: "md_geral",
    checksumSha256: guardado.checksumSha256,
  },
});

const ID = "00000000-prova-parecer-sem-arquivos";
const TITULO = "PROVA PARECER SEM ARQUIVOS";
const agora = Date.now();
await prisma.nexoConversation.deleteMany({ where: { id: ID } });
await prisma.nexoConversation.create({
  data: {
    id: ID,
    userEmail: EMAIL,
    title: TITULO,
    tipo: "auditoria",
    createdAt: new Date(agora),
    updatedAt: new Date(agora),
    data: {
      id: ID,
      tipo: "auditoria",
      title: TITULO,
      createdAt: agora,
      updatedAt: agora,
      messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
      seloResults: [],
      identidade: {},
      auditorias: [{ auditId: audit.id, artifactId: "auditoria:prova:1" }],
      results: [
        {
          artifactId: "auditoria:prova:1",
          kind: "auditoria",
          summary: "Auditoria da prova",
          files: [],
          generatedAt: agora,
          // EXATAMENTE o que o fluxo grava: sem `arquivos`.
          payload: { report: audit.report, texto: "", auditId: audit.id },
        },
      ],
    },
  },
});

const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  const pg = await ctx.newPage();
  await pularTourGuiado(pg);
  await pg.goto("/nexo", { waitUntil: "domcontentloaded" });
  if (pg.url().includes("/login")) {
    await pg.getByRole("button", { name: /Entrar como dev/i }).click();
    await pg.waitForURL("**/nexo**", { timeout: 60_000 });
  }
  await pg.waitForLoadState("networkidle");

  const blobs = await pg.evaluate(async () => {
    const q = indexedDB.open("nexo");
    const db = await new Promise((r) => {
      q.onsuccess = () => r(q.result);
      q.onerror = () => r(null);
    });
    if (!db || !db.objectStoreNames.contains("result_blobs")) return 0;
    return await new Promise((r) => {
      const g = db.transaction("result_blobs", "readonly").objectStore("result_blobs").count();
      g.onsuccess = () => r(g.result);
      g.onerror = () => r(0);
    });
  });
  check("o navegador começa sem PDF local", blobs === 0, `achei ${blobs}`);

  const linha = pg.getByText(TITULO, { exact: false }).first();
  await linha.waitFor({ state: "visible", timeout: 30_000 });
  await linha.click();
  await pg.getByRole("button", { name: /^Resumo/ }).first().waitFor({ timeout: 30_000 });

  const chip = pg.getByRole("button", { name: /No documento/ }).first();
  await chip.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  check("a aba No documento aparece", (await chip.count()) > 0);

  const caixa = await chip.boundingBox().catch(() => null);
  const janela = pg.viewportSize();
  check(
    "e está DENTRO da janela",
    Boolean(caixa) &&
      caixa.x >= 0 &&
      caixa.y >= 0 &&
      caixa.x + caixa.width <= janela.width &&
      caixa.y + caixa.height <= janela.height,
    JSON.stringify({ caixa, janela }),
  );
  check(
    "e a tela não diz que o documento não foi guardado",
    (await pg.getByText(/auditado antes de o sistema passar a guard/).count()) === 0,
  );

  if ((await chip.count()) > 0) {
    await chip.click();
    await pg.waitForTimeout(2500);
  }
  await pg.screenshot({ path: "docs/provas/prova-parecer-sem-arquivos.png" }).catch(() => {});
} finally {
  await navegador.close();
  await prisma.nexoConversation.deleteMany({ where: { id: ID } });
  await prisma.auditFile.deleteMany({ where: { auditId: audit.id } });
  await prisma.storedFile.deleteMany({ where: { checksumSha256: guardado.checksumSha256 } });
}

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
