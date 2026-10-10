/**
 * PROVA DO PRIMEIRO ACESSO (10/10/2026, M1 e M2 do doc 08) — sem token.
 *
 *   node scripts/prova-exemplo-e-ficha.mjs      (build de produção na porta 3000)
 *
 * Duas pessoas:
 * - quem JÁ auditou (o usuário dev, com a lista real): navegador limpo em
 *   `/nexo?intencao=auditar`, nenhum balão, nenhuma dica, e nada de exemplo;
 * - quem NUNCA auditou (a lista do servidor interceptada, vazia): a oferta
 *   aparece na zona, a conversa de exemplo só nasce com o clique, a ficha traz a
 *   dica da obra abaixo da linha "Obra", dá para digitar com ela aberta, o
 *   "Conferi — auditar" abre o parecer de exemplo sem chamar servidor de IA, e
 *   o exemplo some ao sair.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { entrarSemTela } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3000";
const SAIDA = process.env.NEXODOC_PROVA_SAIDA ?? path.join(process.cwd(), "tmp", "prova-exemplo-e-ficha");
const ID_EXEMPLO = "nexo-exemplo-memorial";
fs.mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const confere = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FALHOU"}  ${msg}`);
  if (!ok) falhas++;
};

/** As rotas que gastam modelo (ou leem o memorial no servidor). */
const GASTA = /\/api\/(audit|nexo\/agent|nexo\/classify|nexo\/parecer|nexo\/selo-check|nexo\/check)/;

async function abrir(browser, { novato }) {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await entrarSemTela(contexto, BASE);
  if (novato) {
    // A lista do servidor de quem nunca usou: vazia. Só o GET da lista; o resto passa.
    await contexto.route(/\/api\/nexo\/conversas(\?.*)?$/, async (rota) => {
      const req = rota.request();
      if (req.method() === "GET" && !new URL(req.url()).searchParams.get("id")) {
        await rota.fulfill({ json: { conversas: [], expurgadas: [], sincronizando: true } });
        return;
      }
      await rota.continue();
    });
  }
  const page = await contexto.newPage();
  const erros = [];
  const gastos = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("request", (r) => {
    if (GASTA.test(r.url())) gastos.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return { contexto, page, erros, gastos };
}

const visivel = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight) return false;
    const no = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 12));
    return !!no && (el === no || el.contains(no));
  }, sel);

const exemploNoDisco = (page) =>
  page.evaluate(
    (id) =>
      new Promise((ok) => {
        const req = indexedDB.open("nexo");
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("conversations")) return ok(false);
          const g = db.transaction("conversations").objectStore("conversations").get(id);
          g.onsuccess = () => ok(Boolean(g.result));
          g.onerror = () => ok(false);
        };
        req.onerror = () => ok(false);
      }),
    ID_EXEMPLO,
  );

const browser = await chromium.launch();

/* ---------------------------------------------- 1. quem já auditou ---- */
console.log("\nQuem já auditou (lista real), navegador limpo:");
{
  const { contexto, page, erros } = await abrir(browser, { novato: false });
  await page.goto(`${BASE}/nexo?intencao=auditar`);
  await page.waitForSelector(".nx-zona", { timeout: 30_000 });
  await page.waitForTimeout(4000);
  confere(!(await page.locator("[data-tour-balao]").count()), "nenhum balão de tour abre sozinho");
  confere(!(await page.locator("[data-dica]").count()), "nenhuma dica na entrada");
  confere(!(await page.locator("[data-usar-exemplo]").count()), "sem oferta de exemplo para quem já auditou");
  confere(!(await exemploNoDisco(page)), "nenhuma conversa de exemplo nasceu");
  await page.screenshot({ path: path.join(SAIDA, "1-ja-auditou.png") });
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros[0]}` : ""}`);
  await contexto.close();
}

/* ---------------------------------------------- 2. quem nunca auditou ---- */
console.log("\nQuem nunca auditou (lista do servidor vazia):");
{
  const { contexto, page, erros, gastos } = await abrir(browser, { novato: true });
  await page.goto(`${BASE}/nexo?intencao=auditar`);
  await page.waitForSelector(".nx-zona", { timeout: 30_000 });
  await page.waitForTimeout(3000);
  confere(!(await page.locator("[data-tour-balao]").count()), "nenhum balão de tour abre sozinho");
  confere(await visivel(page, "[data-usar-exemplo]"), "a oferta do exemplo aparece na zona de soltar");
  confere(!(await exemploNoDisco(page)), "o exemplo NÃO existe antes do clique");
  await page.screenshot({ path: path.join(SAIDA, "2-oferta.png") });

  await page.locator("[data-usar-exemplo]").click();
  await page.waitForSelector(".nx-ficha", { timeout: 20_000 });
  await page.waitForTimeout(1200);
  confere(await exemploNoDisco(page), "o clique cria a conversa de exemplo");
  confere(await visivel(page, '[data-dica="ficha-da-obra"]'), "a dica da obra aparece na ficha");
  const posicao = await page.evaluate(() => {
    const obra = document.querySelector('.nx-ficha-linha[data-campo="obra"]').getBoundingClientRect();
    const dica = document.querySelector('[data-dica="ficha-da-obra"]').getBoundingClientRect();
    const seguinte = document.querySelector('.nx-ficha-linha[data-campo="orgao"]').getBoundingClientRect();
    return { abaixoDaObra: dica.top >= obra.bottom - 1, antesDoResto: dica.bottom <= seguinte.top + 1 };
  });
  confere(posicao.abaixoDaObra && posicao.antesDoResto, "a dica fica entre a linha Obra e a seguinte");
  confere(await visivel(page, '.nx-ficha-linha[data-campo="obra"] dd'), "a linha Obra está à vista junto da dica (a conversa abre no topo da ficha)");
  const botao = page.getByRole("button", { name: "Conferi — auditar" });
  confere(await botao.isEnabled().catch(() => false), "o botão Conferi — auditar está ligado");
  await page.screenshot({ path: path.join(SAIDA, "3-ficha-com-dica.png") });

  // Critério 4: a dica não bloqueia digitação.
  const campo = page.locator("textarea").first();
  await campo.click();
  await campo.pressSequentially("teste com a dica aberta");
  confere((await campo.inputValue()).includes("teste com a dica aberta"), "dá para digitar com a dica aberta");
  await campo.fill("");

  await botao.click();
  await page.waitForSelector("[data-parecer-de-exemplo]", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  confere(!(await page.locator('[data-dica="ficha-da-obra"]').count()), "a dica da obra some no Conferi — auditar");
  confere(await page.locator("[data-parecer-de-exemplo]").isVisible(), "o parecer se diz exemplo");
  confere(!(await page.getByRole("button", { name: "Resumir para o cliente" }).count()), "sem as perguntas que iriam ao modelo");
  confere(await page.locator("[data-selo-exemplo]").isVisible(), "o palco traz o selo Exemplo");
  confere(
    await page.evaluate(() => Boolean(document.querySelector(".hs-exemplos")?.textContent?.includes("042-26"))),
    "na barra, o exemplo fica no grupo dos exemplos, não como obra de verdade",
  );
  await page.screenshot({ path: path.join(SAIDA, "4-parecer-de-exemplo.png") });
  // O passo a passo do resultado abre sozinho na primeira vez que se vê um parecer; fecha para a foto do palco.
  if (await page.locator("[data-tour-balao]").count()) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SAIDA, "5-palco-sem-tour.png") });
  }
  confere(gastos.length === 0, `nenhuma chamada de IA ou leitura no servidor${gastos.length ? `: ${gastos.join(", ")}` : ""}`);

  // Sair: abrir o Nexo de novo é sair do exemplo.
  await page.goto(`${BASE}/nexo`);
  await page.waitForSelector(".nx-zona", { timeout: 30_000 });
  await page.waitForTimeout(2500);
  confere(!(await exemploNoDisco(page)), "o exemplo some ao sair");
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros[0]}` : ""}`);
  await contexto.close();
}

await browser.close();
console.log(falhas ? `\n${falhas} falha(s). Fotos em ${SAIDA}` : `\nTudo certo. Fotos em ${SAIDA}`);
process.exit(falhas ? 1 : 0);
