// O FAVICON QUE SABE QUE HÁ TRABALHO — sem token.
//
//   node scripts/prova-favicon-vivo.mjs   (== npm run prova:favicon)
//
// Semeia uma conversa com o bilhete `auditoriaPendente` — o mesmo que sobra
// quando alguem da F5 no meio de uma auditoria — e confere que o icone da aba
// troca por causa dele, e volta ao sair da conversa. Nenhuma auditoria de
// verdade e disparada: o que se mede aqui e a TROCA DA REFERENCIA, nao o motor.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE =
  process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1400, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

const icones = () =>
  page.$$eval('link[rel="icon"], link[rel="shortcut icon"]', (ls) =>
    ls.map((l) => l.href),
  );

await entrarComo(page, "victor@prosul.com");
await page.goto("/nexo");
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(600);

const parado = await icones();
check(
  "a pagina declara o icone da marca",
  parado.length > 0,
  JSON.stringify(parado),
);
check(
  "e em repouso ele e o orbe normal",
  parado.every((h) => !h.includes("orbe-trabalhando")),
  JSON.stringify(parado),
);

/*
 * A AUDITORIA PRECISA ESTAR RODANDO NO SERVIDOR, e não só no bilhete.
 *
 * A primeira versão semeava só o bilhete no IndexedDB — e a reconexão perguntava
 * ao servidor, ouvia "não existe" e APAGAVA o bilhete antes de a prova olhar. O
 * ícone voltava ao normal por comportamento CORRETO do produto, e a prova
 * acusava um defeito que não havia.
 */
const AUDIT_ID = "qa-favicon-audit";
const prisma = getPrisma();
const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul" },
  select: { id: true, code: true },
});
await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.audit.create({
  data: {
    id: AUDIT_ID,
    projectId: projeto?.id ?? null,
    title: "Favicon vivo — prova",
    projectName: projeto?.code ?? "",
    auditMode: "memorial",
    // `PROCESSING` e o "rodando" do schema — `RUNNING` nao existe no enum.
    status: "PROCESSING",
    totalFindings: 0,
  },
});

// O bilhete que sobra de uma auditoria interrompida por F5.
const CONV = "qa-favicon-vivo";
await page.evaluate(
  async ({ convId, auditId }) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA FAVICON VIVO",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditando." }],
        seloResults: [],
        results: [],
        auditoriaPendente: {
          auditId,
          artifactId: "auditoria:qa",
          nivel: "standard",
          arquivo: "memorial.pdf",
          inicioMs: agora,
        },
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  { convId: CONV, auditId: AUDIT_ID },
);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
const pular2 = page.getByRole("button", { name: /pular/i });
if (await pular2.count()) await pular2.first().click();
await page.getByText("QA FAVICON VIVO").first().click();
await page.waitForTimeout(2000);

const trabalhando = await icones();
check(
  "com auditoria pendente, o icone ganha o ponto",
  trabalhando.some((h) => h.includes("orbe-trabalhando")),
  JSON.stringify(trabalhando),
);
/*
 * UM ICONE SO enquanto trabalha. A pagina tem SEIS `<link rel="icon">` (o Next
 * declara 32 e 16, e o roteador os reinsere): com varios, qual deles o
 * navegador usa nao e decisao nossa, e o ponto aparecia ou nao conforme o
 * tamanho pedido. A primeira versao desta prova mediu isso e reprovou.
 */
check(
  "e fica UM icone so, para o navegador nao ter o que escolher",
  trabalhando.length === 1 && trabalhando[0].includes("orbe-trabalhando"),
  JSON.stringify(trabalhando),
);

// O arquivo existe de verdade: um href apontando para 404 deixaria a aba sem
// icone nenhum, que e pior que nao trocar.
const resposta = await page.request.get("/marca/orbe-trabalhando-32.png");
check(
  "e o arquivo do ponto existe mesmo",
  resposta.status() === 200,
  `status ${resposta.status()}`,
);

// Sair da conversa devolve o icone: um ponto que fica para sempre vira
// decoracao, e decoracao que parece estado e pior que estado nenhum.
await page
  .getByRole("button", { name: /nova conversa/i })
  .first()
  .click();
await page.waitForTimeout(1500);
const devolvido = await icones();
check(
  "e ao sair da auditoria o icone volta ao normal",
  devolvido.every((h) => !h.includes("orbe-trabalhando")),
  JSON.stringify(devolvido),
);

check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));

await browser.close();
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.$disconnect();
console.log(falhas === 0 ? "\nPROVA DO FAVICON OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
