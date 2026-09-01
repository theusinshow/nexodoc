// O MILTON ABRE O PDF QUE NUNCA ESTEVE NA MÁQUINA DELE.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-milton-abre-o-pdf.mjs
//   (== npm run prova:milton)
//
// É a prova que resume o sub-projeto. Antes dela, `podeVerNoDocumento` dependia
// do IndexedDB da própria máquina: quem recebia um achado por e-mail não tinha
// botão nenhum, e o achado era uma afirmação sem como conferir.
//
// O contexto do Milton é NOVO — IndexedDB vazio, como o de quem clica no link
// pela primeira vez. É essa a condição que a prova precisa manter, e ela é
// verificada antes de seguir: sem isso a prova poderia passar por cache.
//
// SEM IA: o parecer é o que o seed deixou; o PDF é semeado direto no StoredFile.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { guardarArquivo } = await import("../lib/file-storage.ts");
const { linkDoAchado } = await import("../lib/link-do-achado.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const prisma = getPrisma();

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const audit = await prisma.audit.findFirst({
  where: {
    project: { organizationId: "org-prosul" },
    report: { not: null },
    status: "COMPLETED",
  },
  orderBy: { createdAt: "desc" },
  select: { id: true, report: true },
});
check("existe auditoria com parecer", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const findingId = audit.report.incongruencias[0].id;

/*
 * UM PDF DE VERDADE, mínimo mas válido: o visor tem que conseguir abri-lo, e um
 * arquivo de texto passaria na rota e falharia na tela — que é o pior lugar para
 * descobrir.
 */
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

/*
 * A LINHA DE `AuditFile` É CRIADA AQUI. O seed não a cria — descobri isso
 * depurando: uma prova anterior falhou porque `updateMany` atualizou zero
 * linhas, e a cadeia estava certa o tempo todo.
 */
await prisma.auditFile.deleteMany({ where: { auditId: audit.id } });
await prisma.auditFile.create({
  data: {
    auditId: audit.id,
    fileName: "memorial-de-prova.pdf",
    documentType: "md_geral",
    checksumSha256: guardado.checksumSha256,
  },
});

const navegador = await chromium.launch();

/*
 * CONTEXTO NOVO = IndexedDB VAZIO. É a condição da prova: o Milton nunca rodou
 * esta auditoria, e o memorial nunca esteve nesta máquina.
 */
const ctx = await navegador.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 1000 },
});
const pg = await ctx.newPage();
await entrarComo(pg, "milton@prosul.com");

const local = await pg.evaluate(async () => {
  const q = indexedDB.open("nexo");
  const db = await new Promise((r) => {
    q.onsuccess = () => r(q.result);
    q.onerror = () => r(null);
  });
  if (!db || !db.objectStoreNames.contains("conversations")) return 0;
  const tx = db.transaction("conversations", "readonly");
  return await new Promise((r) => {
    const g = tx.objectStore("conversations").getAll();
    g.onsuccess = () => r(g.result.length);
    g.onerror = () => r(0);
  });
});
check("o Milton começa sem conversa nenhuma nesta máquina", local === 0, `achei ${local}`);

const destino = linkDoAchado({ base: BASE, auditId: audit.id, findingId });
check("o link tem o achado", destino.includes(`achado=${findingId}`), destino);

await pg.goto(destino, { waitUntil: "networkidle" });
await pg.waitForTimeout(5000);

// A rota devolve os bytes para ele?
const baixou = await pg.evaluate(async (checksum) => {
  const r = await fetch(`/api/arquivos/${checksum}`);
  return {
    status: r.status,
    tipo: r.headers.get("content-type"),
    bytes: (await r.arrayBuffer()).byteLength,
  };
}, guardado.checksumSha256);
check("o Milton baixa o documento", baixou.status === 200, `HTTP ${baixou.status}`);
check(
  "e ele é um PDF com os bytes certos",
  baixou.tipo === "application/pdf" && baixou.bytes === pdf.byteLength,
  JSON.stringify(baixou),
);

// O link levou à aba Achados, no achado pedido?
const aba = pg.getByRole("button", { name: /^Achados/ }).first();
check("o link abriu a aba Achados", (await aba.getAttribute("aria-pressed")) === "true");
check(
  "e o achado pedido está na página",
  (await pg.locator(`[data-achado="${findingId}"]`).count()) > 0,
  findingId,
);

// A vista "No documento" existe — o que só acontece com o PDF vindo do servidor.
check(
  "a aba No documento existe, vinda do SERVIDOR",
  (await pg.getByRole("button", { name: /No documento/ }).count()) > 0,
);

// E o botão de conferir está lá, dentro da janela.
const botao = pg.getByRole("button", { name: /^Ver no documento$/ }).first();
await botao.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
check("a tela oferece VER NO DOCUMENTO", (await botao.count()) > 0);

/*
 * A CAIXA CONTRA A JANELA, e não só a presença no DOM: asserção de DOM passa
 * verde com o painel inteiro fora da tela, e este projeto já pagou por isso.
 * Rola até ele primeiro — o botão vive abaixo da dobra do cartão.
 */
await botao.scrollIntoViewIfNeeded().catch(() => {});
await pg.waitForTimeout(600);
const caixa = await botao.boundingBox();
const janela = pg.viewportSize();
check(
  "e o botão está DENTRO da janela",
  Boolean(caixa) &&
    caixa.x >= 0 &&
    caixa.y >= 0 &&
    caixa.x + caixa.width <= janela.width &&
    caixa.y + caixa.height <= janela.height,
  JSON.stringify({ caixa, janela }),
);

await pg.screenshot({ path: "prova-milton-abre-o-pdf.png" });
console.log("\nprova-milton-abre-o-pdf.png");

await navegador.close();
await prisma.auditFile.deleteMany({ where: { auditId: audit.id } });
await prisma.storedFile.deleteMany({ where: { checksumSha256: guardado.checksumSha256 } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
