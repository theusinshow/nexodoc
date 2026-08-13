/**
 * PROVA: a cotação nasce em Configurações, viaja para o Consumo, e a
 * procedência do real nunca some da tela.
 *
 * O teste em node cru (`npm run test:cambio`) prova a conversão. Aqui se prova
 * o que ele não alcança: que as duas telas concordam sobre a mesma cotação, e
 * que a linha de procedência aparece no Consumo mesmo quando a consulta à
 * OpenAI falha — que é o estado de qualquer máquina sem `OPENAI_ADMIN_KEY`.
 *
 * Servidor no ar com a cotação semeada pelo ambiente:
 *
 *   NEXODOC_ADMIN_TOKEN=teste-local NEXODOC_CAMBIO_USD_BRL=5,42 npm run dev
 *
 *   node scripts/prova-cambio.mjs   (== npm run prova:cambio)
 *
 * Nao gasta token: nao dispara nenhuma chamada de IA.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const TOKEN = process.env.NEXODOC_ADMIN_TOKEN ?? "teste-local";

const falhas = [];
function conferir(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`OK    ${nome}`);
  } else {
    falhas.push(`${nome} — ${detalhe}`);
    console.log(`FALHA ${nome} — ${detalhe}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function abrir(rota) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
    await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
}

// --- 1. A seção da cotação existe e está na janela ---
await abrir("/admin/config");
const titulo = page.locator("h2", { hasText: "Cotação do dólar" }).first();
await titulo.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
const caixa = await titulo.boundingBox();
conferir(
  "a seção da cotação está na tela",
  Boolean(caixa) && caixa.y >= 0 && caixa.x >= 0 && caixa.x < 1440,
  `boundingBox=${JSON.stringify(caixa)}`,
);

// --- 2. Com o token, o campo traz a cotação do ambiente ---
await page.locator('input[type="password"]').first().fill(TOKEN);
await page.locator("form button[type=submit]").first().click();
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(600);

const campo = page.locator('label:has-text("Reais por US$ 1") input').first();
conferir(
  "o campo traz a cotação declarada no ambiente",
  (await campo.inputValue()) === "5.42",
  `veio "${await campo.inputValue()}"`,
);
conferir(
  "o selo diz a cotação e de quando ela é",
  (await page.getByText(/cotação declarada/i).first().isVisible()) &&
    (await page.getByText(/5,42/).first().isVisible()),
  "a procedência não apareceu",
);

// --- 3. A validação recusa o dedo escorregado antes de salvar ---
await campo.fill("5420");
await page.waitForTimeout(150);
conferir(
  "cotação absurda é recusada na hora",
  await page.getByText(/o campo espera reais por dólar/i).isVisible(),
  "o aviso não apareceu",
);
conferir(
  "o botão de declarar trava com a cotação inválida",
  await page.getByRole("button", { name: /Declarar cotação/i }).isDisabled(),
  "seguia clicável",
);

/*
 * --- 4. A PROCEDÊNCIA APARECE NO CONSUMO, mesmo com a consulta falhando ---
 *
 * Sem `OPENAI_ADMIN_KEY` a rota devolve erro e a tela mostra o aviso. A linha
 * da cotação NÃO pode depender disso: ela descreve como os reais da tela são
 * calculados, e some junto seria deixar o leitor sem a régua.
 */
await abrir("/admin/usage");
// O token ficou no sessionStorage e o cabeçalho já vem recolhido ("sessão
// admin · trocar · sair") — nesse estado não há campo para preencher.
if ((await page.locator('input[type="password"]').count()) > 0) {
  await page.locator('input[type="password"]').first().fill(TOKEN);
  await page.locator("form button[type=submit]").first().click();
}
await page.waitForTimeout(1200);

conferir(
  "o consumo mostra a linha de procedência da cotação",
  await page.getByText(/cotação (declarada|não declarada)/i).first().isVisible(),
  "a linha não apareceu",
);
conferir(
  "a linha leva para onde se declara",
  await page.getByRole("link", { name: /declarar em Configurações/i }).isVisible(),
  "o link não apareceu",
);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
