// VOLTAR PARA ONDE PAROU — a prova de que o F5 deixou de criar conversa nova.
//
//   node scripts/prova-ultima-conversa.mjs   (== npm run prova:ultima)
//
// O DEFEITO (31/08/2026): `conversationId` nascia de um `newId()` a cada
// montagem e nada reabria a anterior — só o clique no histórico chamava
// `selectConversation`. Cada recarga começava do zero, e o trabalho seguinte
// virava OUTRA linha na barra. Numa pasta real (`088-25-CRICIUMA`) isso rendeu
// quatro conversas "MET" do mesmo volume, distinguíveis só pelo horário.
//
// DUAS ARMADILHAS que custaram três corridas desta prova, e por isso estão
// escritas aqui:
//
//   1. O EXEMPLO GUIADO abre sozinho na primeira visita e vira "onde eu parei".
//      É comportamento certo do produto e mascara a medição — daí o
//      `nexo:tour-visto` antes de tudo.
//   2. O DEV SERVER VELHO devolvia 500 em `/api/nexo/conversas/[id]` (pool de
//      workers do Turbopack morrendo em laço), então NENHUMA conversa abria e a
//      prova acusava o conserto. Se esta prova falhar toda, reinicie o
//      `next dev` ANTES de acreditar nela.
import nextEnv from "@next/env";
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? "http://localhost:3000";
const ATOR = "victor@prosul.com";
const ID = "qa-ultima-conversa";
const TITULO = "PROVA ONDE EU PAREI";
const CHAVE = "nexo:ultima-conversa";

const prisma = getPrisma();
let falhas = 0;
const ok = (cond, oq) => {
  console.log(`  ${cond ? "OK  " : "FALHOU"}  ${oq}`);
  if (!cond) falhas++;
};

/*
 * O `data` é CLONADO de uma conversa real, e não escrito à mão: escrito à mão
 * ele saiu incompleto e o `selectConversation` recusava abrir — a prova
 * media a própria semente. `StoredConversation` é schemaless de propósito,
 * então a forma certa é a que o produto grava.
 */
const molde = await prisma.nexoConversation.findFirst({
  where: { data: { not: null } },
  orderBy: { updatedAt: "desc" },
  select: { data: true },
});
if (!molde) {
  console.error("Não há conversa alguma no banco para servir de molde.");
  process.exit(1);
}
await prisma.nexoConversation.deleteMany({ where: { id: ID } });
await prisma.nexoConversation.create({
  data: {
    id: ID,
    userEmail: ATOR,
    title: TITULO,
    folderKey: "999-99-PROVA",
    tipo: "volume",
    createdAt: new Date(),
    updatedAt: new Date(),
    data: { ...molde.data, id: ID, title: TITULO, folderKey: "999-99-PROVA" },
  },
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

await entrarComo(page, ATOR);
await page.goto("/nexo");
await page.evaluate(() => localStorage.setItem("nexo:tour-visto", "1"));
await page.goto("/nexo");
await page.waitForTimeout(5000);

const item = page.getByRole("button", { name: new RegExp(TITULO, "i") }).first();
await item.waitFor({ timeout: 20000 });
await item.click();
await page.waitForTimeout(5000);

ok(
  (await page.locator('[aria-current="true"]').count()) > 0,
  "abrir do histórico marca a conversa como ativa",
);
const lembrada = await page.evaluate((k) => localStorage.getItem(k), CHAVE);
ok(lembrada === ID, `e guarda onde parei (guardou "${lembrada}")`);

const antes = await page.locator("aside li").count();

// -------------------------------------------------------------------- O F5
await page.reload();
await page.waitForTimeout(6000);

const ativa = page.locator('[aria-current="true"]');
ok((await ativa.count()) > 0, "depois do F5 ainda há uma conversa ATIVA");
const nome = (await ativa.count()) > 0 ? ((await ativa.first().textContent()) ?? "") : "";
ok(nome.includes("PAREI"), `e é a MESMA de antes ("${nome.trim().slice(0, 40)}")`);

const depois = await page.locator("aside li").count();
ok(depois === antes, `o F5 NÃO criou conversa nova (${antes} antes, ${depois} depois)`);

// ------------------------------------------- o link continua mandando mais
//
// Quem abre `/nexo?auditoria=<id>` pediu um parecer específico. Restaurar por
// cima jogaria fora o link que a pessoa acabou de clicar — o mesmo defeito que
// o `?auditoria=` já teve uma vez.
await page.goto("/nexo?auditoria=nao-existe-de-proposito");
await page.waitForTimeout(5000);
ok(
  (await page.locator('[aria-current="true"]').count()) === 0,
  "com `?auditoria=` na URL, a restauração NÃO atropela o link",
);

ok(erros.length === 0, `nenhum erro de página${erros.length ? `: ${erros[0].slice(0, 90)}` : ""}`);

await page.screenshot({ path: "scratchpad/qa/ultima-conversa.png" });
await browser.close();
await prisma.nexoConversation.deleteMany({ where: { id: ID } });
await prisma.$disconnect();

console.log(falhas === 0 ? "\nPROVA DA ÚLTIMA CONVERSA OK" : `\n${falhas} FALHA(S)`);
process.exitCode = falhas === 0 ? 0 : 1;
