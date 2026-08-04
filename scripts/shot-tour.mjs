// O PASSO A PASSO GUIADO, do primeiro acesso ao fim — sem gastar um token.
//
// O tour roda sobre um projeto de EXEMPLO que ele mesmo fabrica (PDF gerado com
// pdf-lib, parecer escrito à mão). Este portão entra como quem nunca abriu o
// produto, caminha por todos os passos e exige as três coisas que fazem um tour
// existir ou não existir:
//
//   1. cada balão tem um alvo REAL na tela (nada de apontar para o vazio);
//   2. o balão nunca sai da janela;
//   3. no fim, o exemplo SOME — quem chegou para trabalhar não herda a obra
//      fictícia na sidebar.
//
//   node scripts/shot-tour.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }

  // Primeiro acesso de verdade: sem marca no storage e sem conversa nenhuma.
  await page.evaluate(() => localStorage.removeItem("nexo:tour-visto"));
  await page.reload({ waitUntil: "domcontentloaded" });

  const balao = page.locator("[data-tour-balao]");
  await balao.waitFor({ timeout: 30000 });
  check("o tour se oferece sozinho no primeiro acesso", await balao.isVisible());

  const janela = page.viewportSize();
  const passos = [];
  let semAlvo = 0;
  let foraDaJanela = 0;

  // Caminha até o fim, guardando o que cada passo mostrou.
  for (let i = 0; i < 40; i++) {
    const visivel = await balao.count();
    if (visivel === 0) break;

    const titulo = await balao.locator("h2").innerText();
    const anel = page.locator("[data-tour-anel]");
    const temAlvo = (await anel.count()) > 0;
    passos.push({ titulo, temAlvo });

    const caixa = await balao.boundingBox();
    if (caixa) {
      const dentro =
        caixa.x >= 0 &&
        caixa.y >= 0 &&
        caixa.x + caixa.width <= janela.width + 1 &&
        caixa.y + caixa.height <= janela.height + 1;
      if (!dentro) {
        foraDaJanela++;
        console.error(`       balão fora da janela em "${titulo}": ${JSON.stringify(caixa)}`);
      }
    }

    // O anel tem que estar em cima de algo com tamanho: alvo medido a zero é o
    // mesmo que alvo inexistente.
    if (temAlvo) {
      const caixaAnel = await anel.boundingBox();
      if (!caixaAnel || caixaAnel.width < 8 || caixaAnel.height < 8) {
        semAlvo++;
        console.error(`       anel sem alvo real em "${titulo}"`);
      }
    }

    if (i === 3) await page.screenshot({ path: `${OUT}/t1-tour-selo.png` });
    if (titulo.match(/documento/i)) await page.screenshot({ path: `${OUT}/t2-tour-documento.png` });

    await page.locator("[data-tour-proximo]").click();
    await page.waitForTimeout(700);
  }

  console.log(`       ${passos.length} passos percorridos`);
  check("o tour tem os passos do roteiro", passos.length >= 10, `${passos.length}`);
  check("todo balão coube na janela", foraDaJanela === 0, `${foraDaJanela} fora`);
  check("todo passo com anel tinha alvo de verdade", semAlvo === 0, `${semAlvo} sem alvo`);

  // O exemplo é semeado: os passos precisam ter mostrado coisa real.
  const titulos = passos.map((p) => p.titulo).join(" | ");
  check("passou pela montagem do volume", /volume|selo/i.test(titulos), titulos);
  check("passou pela auditoria", /auditoria|veredito|documento/i.test(titulos), titulos);
  check(
    "só a abertura e o fecho falam sem alvo",
    passos.filter((p) => !p.temAlvo).length <= 2,
    `${passos.filter((p) => !p.temAlvo).length} sem alvo`,
  );

  // --- O fim: tela limpa ----------------------------------------------------
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/t3-depois-do-tour.png` });
  check("o balão sumiu ao terminar", (await balao.count()) === 0);

  const corpo = await page.locator("body").innerText();
  check(
    "o projeto de exemplo foi apagado da sidebar",
    !/Exemplo guiado/i.test(corpo),
    corpo.slice(0, 200),
  );

  const sobrouNoBanco = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
    });
    const rec = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const r = tx.objectStore("conversations").get("nexo-exemplo-guiado");
      r.onsuccess = () => res(r.result);
    });
    return Boolean(rec);
  });
  check("e apagado do banco, não só da tela", !sobrouNoBanco);

  // Segunda visita: o tour não pode voltar sozinho.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  check("na segunda visita ele não reaparece", (await balao.count()) === 0);

  // Mas continua acessível por vontade própria.
  const rever = page.getByRole("button", { name: /Como funciona/i });
  check("e pode ser revisto pela sidebar", (await rever.count()) > 0);
  if ((await rever.count()) > 0) {
    await rever.first().click();
    await balao.waitFor({ timeout: 30000 });
    check("rever reabre o passo a passo", await balao.isVisible());
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1200);
    check("e Esc sai a qualquer momento", (await balao.count()) === 0);
  }

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/t-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
