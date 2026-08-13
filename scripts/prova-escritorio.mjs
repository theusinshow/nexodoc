/**
 * PROVA: a seção do escritório emissor aparece, lê o ambiente e trava o salvar
 * sem banco.
 *
 * O teste em node cru (`npm run test:escritorio`) prova a REGRA. Esta prova
 * existe para o que ele não alcança e que já mordeu este projeto: uma asserção
 * de DOM passa verde com o painel fora da tela, e `tsc`/`eslint` passam com o
 * servidor caindo no boot. Por isso a caixa é medida contra a janela.
 *
 * Precisa do servidor no ar com o escritório semeado pelo ambiente:
 *
 *   NEXODOC_ADMIN_TOKEN=teste-local \
 *   NEXODOC_ESCRITORIO_NOME="Engeplan Engenharia Ltda" \
 *   NEXODOC_ESCRITORIO_ENDERECO="Rua Saldanha Marinho, 89, Centro - Florianópolis - SC" \
 *   NEXODOC_ESCRITORIO_MUNICIPIO="Florianópolis" NEXODOC_ESCRITORIO_UF=SC npm run dev
 *
 *   node scripts/prova-escritorio.mjs   (== npm run prova:escritorio)
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

await page.goto(`${BASE}/admin/config`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  // Sem esperar a sessão assentar, o goto seguinte corre contra o POST do
  // sign-in e cai numa tela de não-admin — que foi o que travou esta prova.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.goto(`${BASE}/admin/config`, { waitUntil: "domcontentloaded" });
}
await page.waitForLoadState("networkidle").catch(() => {});

// --- 1. A seção existe E está dentro da janela ---
const titulo = page.locator("h2", { hasText: "Escritório emissor" }).first();
await titulo.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
const caixa = await titulo.boundingBox();
conferir(
  "a seção do escritório está na tela",
  Boolean(caixa) && caixa.y >= 0 && caixa.y < 900 && caixa.x >= 0 && caixa.x < 1440,
  `boundingBox=${JSON.stringify(caixa)}`,
);

// --- 2. Antes do token, a tela diz o que fazer em vez de mostrar campo vazio ---
conferir(
  "sem token, a seção pede o token",
  await page.getByText("Informe o token admin para editar.", { exact: true }).isVisible(),
  "a dica não apareceu",
);

/*
 * --- 3. O CAMPO DE TOKEN SOBREVIVE À PRIMEIRA TECLA ---
 *
 * Regressão real, encontrada por esta prova: o recolhimento do token (`token &&
 * !editando`) fechava no primeiro caractere digitado, e não havia como entrar
 * no admin à mão em nenhuma das 7 telas. `tsc` e `eslint` passavam limpos.
 */
const campoDoToken = page.locator('input[type="password"]').first();
await campoDoToken.click();
await page.keyboard.type("t");
await page.waitForTimeout(200);
conferir(
  "o campo do token não some ao digitar",
  (await page.locator('input[type="password"]').count()) === 1,
  "o formulário recolheu no primeiro caractere",
);

// --- 4. Com o token, o ambiente aparece nos campos ---
await page.locator('input[type="password"]').first().fill(TOKEN);
await page.locator("form button[type=submit]").first().click();
await page.waitForLoadState("networkidle").catch(() => {});
await page.getByText("vindo do ambiente").waitFor({ timeout: 15000 }).catch(() => {});

const valor = async (rotulo) =>
  page.locator(`label:has-text("${rotulo}") input`).first().inputValue();

conferir(
  "o selo diz que o dado veio do ambiente",
  await page.getByText("vindo do ambiente").isVisible(),
  "selo de origem não apareceu",
);
conferir(
  "o nome do escritório chegou do ambiente",
  (await valor("Nome do escritório")) === "Engeplan Engenharia Ltda",
  `veio "${await valor("Nome do escritório")}"`,
);
conferir(
  "o endereço impresso chegou do ambiente",
  (await valor("Endereço impresso nas pranchas")).includes("Saldanha Marinho"),
  `veio "${await valor("Endereço impresso nas pranchas")}"`,
);
conferir("a UF chega em maiúscula", (await valor("UF")) === "SC", `veio "${await valor("UF")}"`);

// --- 5. Sem banco, o salvar trava E diz por quê (não some em silêncio) ---
const salvar = page.getByRole("button", { name: /Salvar dados do escritório/i });
conferir("o salvar está desabilitado sem DATABASE_URL", await salvar.isDisabled(), "estava clicável");
conferir(
  "o motivo do bloqueio está escrito ao lado",
  await page.getByText("sem DATABASE_URL").first().isVisible(),
  "o motivo não apareceu",
);

// --- 6. A validação fala antes de tentar salvar ---
await page.locator('label:has-text("UF") input').first().fill("SCC");
await page.waitForTimeout(150);
conferir(
  "UF com três letras é recusada na hora",
  await page.getByText("UF deve ter duas letras").isVisible(),
  "o aviso não apareceu",
);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
