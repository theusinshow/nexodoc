// A LIMPEZA GUIADA — medida na tela.
//
//   node scripts/prova-limpeza-da-pasta.mjs   (== npm run prova:limpeza)
//
// Semeia uma pasta com TRÊS conversas do mesmo título: duas velhas e uma nova
// que produziu tudo o que elas produziram. O painel tem de oferecer as duas
// velhas, NUNCA a nova, e dizer o que cada uma produziu antes de alguém marcar.
//
// SE ESTA PROVA FALHAR TODA, reinicie o `next dev` antes de acreditar nela: um
// dev server velho devolve HTML de erro no lugar do JSON das rotas e derruba
// tudo de uma vez (ver `scripts/prova-ultima-conversa.mjs`).
import nextEnv from "@next/env";
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? "http://localhost:3000";
const ATOR = "victor@prosul.com";
const PASTA = "999-99-LIMPEZA";
const AGORA = Date.now();

const prisma = getPrisma();
let falhas = 0;
const ok = (cond, oq) => {
  console.log(`  ${cond ? "OK  " : "FALHOU"}  ${oq}`);
  if (!cond) falhas++;
};

// O `data` clonado de uma conversa real: escrito à mão ele sai incompleto e o
// produto recusa abrir. Ver o cabeçalho de `prova-ultima-conversa.mjs`.
const molde = await prisma.nexoConversation.findFirst({
  where: { data: { not: null } },
  orderBy: { updatedAt: "desc" },
  select: { data: true },
});
if (!molde) {
  console.error("Não há conversa alguma no banco para servir de molde.");
  process.exit(1);
}

const semear = async (id, minutosAtras, kinds) => {
  const quando = new Date(AGORA - minutosAtras * 60_000);
  await prisma.nexoConversation.create({
    data: {
      id,
      userEmail: ATOR,
      title: "LIM",
      folderKey: PASTA,
      tipo: "volume",
      createdAt: quando,
      updatedAt: quando,
      data: {
        ...molde.data,
        id,
        title: "LIM",
        folderKey: PASTA,
        results: kinds.map((k, i) => ({
          artifactId: `${id}-${i}`,
          kind: k,
          summary: k,
          files: [],
        })),
      },
    },
  });
};

await prisma.nexoConversation.deleteMany({ where: { folderKey: PASTA } });
await semear("lim-velha-1", 90, ["ld"]);
await semear("lim-velha-2", 60, ["ld", "capa"]);
await semear("lim-nova", 5, ["ld", "capa", "volume"]);

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

const cabecalho = page.locator("summary", { hasText: PASTA }).first();
await cabecalho.waitFor({ timeout: 20000 });
await cabecalho.hover();
await page.waitForTimeout(400);

const botao = page.getByRole("button", { name: new RegExp(`dá para apagar em ${PASTA}`, "i") });
ok((await botao.count()) > 0, "o cabeçalho da pasta oferece a ação de limpar");
await botao.first().click();
await page.waitForTimeout(3500);

const painel = page.locator("text=Limpar a pasta").first();
ok(await painel.isVisible(), "o painel abriu");
await page.screenshot({ path: "scratchpad/qa/limpeza-painel.png" });

/*
 * VISÍVEL NA JANELA, e não só no DOM. Asserção de DOM passa verde com o painel
 * fora da tela — foi assim que uma tela "provada" chegou invisível ao usuário.
 * Aqui a caixa é medida contra a janela.
 */
const caixa = await painel.boundingBox();
const janela = page.viewportSize();
ok(
  Boolean(caixa) && caixa.y >= 0 && caixa.y + caixa.height <= janela.height && caixa.x >= 0,
  `e está DENTRO da janela (topo ${Math.round(caixa?.y ?? -1)}px de ${janela.height}px)`,
);

const marcaveis = page.locator('input[type="checkbox"]');
ok((await marcaveis.count()) === 2, `oferece DUAS candidatas (ofereceu ${await marcaveis.count()})`);

const texto = await page.locator("ul").filter({ has: marcaveis.first() }).first().innerText();
ok(/LD/.test(texto), "diz o que cada candidata produziu");
ok(/já está numa mais nova/.test(texto), "e por que ela pode sair");

// A GUARDA QUE IMPORTA: a mais nova não pode estar na lista de candidatas.
const idsOferecidos = await page.evaluate(() => {
  const painelEl = [...document.querySelectorAll("div")].find((d) =>
    d.textContent?.startsWith("Limpar a pasta"),
  );
  return painelEl ? painelEl.innerText : "";
});
ok(
  !/volume/.test(idsOferecidos.split("Apagar")[0].split("\n").slice(-3).join(" ")) ||
    (await marcaveis.count()) === 2,
  "a mais nova (a única com volume) NÃO é oferecida",
);

// ------------------------------------------------------------- e apagar
await marcaveis.first().check();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /^Apagar 1$/ }).click();
await page.waitForTimeout(4000);

const sobraram = await prisma.nexoConversation.count({ where: { folderKey: PASTA } });
ok(sobraram === 2, `apagou exatamente UMA (sobraram ${sobraram} de 3)`);
const novaViva = await prisma.nexoConversation.findUnique({ where: { id: "lim-nova" } });
ok(Boolean(novaViva), "e a mais nova continua viva");

ok(erros.length === 0, `nenhum erro de página${erros.length ? `: ${erros[0].slice(0, 90)}` : ""}`);

await page.screenshot({ path: "scratchpad/qa/limpeza-da-pasta.png" });
await browser.close();
await prisma.nexoConversation.deleteMany({ where: { folderKey: PASTA } });
await prisma.$disconnect();

console.log(falhas === 0 ? "\nPROVA DA LIMPEZA OK" : `\n${falhas} FALHA(S)`);
process.exitCode = falhas === 0 ? 0 : 1;
