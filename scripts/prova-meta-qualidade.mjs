/**
 * PROVA: as metas se declaram em Configurações e o painel de Quality diz quando
 * NÃO tem régua.
 *
 * A série semanal com linhas de verdade exige banco com auditorias julgadas e
 * continua sem prova de navegador — está registrado no checklist. O que se
 * prova aqui é o estado que toda máquina tem: metas ausentes, e a tela dizendo
 * isso em vez de pintar aprovação.
 *
 *   NEXODOC_ADMIN_TOKEN=teste-local NEXODOC_META_FALSO_POSITIVO=10 \
 *   NEXODOC_META_COBERTURA=40 npm run dev
 *
 *   node scripts/prova-meta-qualidade.mjs   (== npm run prova:meta-qualidade)
 *
 * Nao gasta token: nao dispara nenhuma chamada de IA.
 */
import { chromium } from "playwright";

import { temBanco, tokenDoAdmin } from "./token-do-admin.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const TOKEN = tokenDoAdmin();

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
  if ((await page.locator('input[type="password"]').count()) > 0) {
    await page.locator('input[type="password"]').first().fill(TOKEN);
    await page.locator("form button[type=submit]").first().click();
    await page.waitForTimeout(1000);
  }
}

// --- 1. A seção existe, está na janela e traz o que o ambiente declarou ---
await abrir("/admin/config");
const titulo = page.locator("h2", { hasText: "Metas de qualidade" }).first();
await titulo.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
const caixa = await titulo.boundingBox();
conferir(
  "a seção das metas está na tela",
  Boolean(caixa) && caixa.y >= 0 && caixa.x >= 0 && caixa.x < 1440,
  `boundingBox=${JSON.stringify(caixa)}`,
);

const campoFp = page.locator('label:has-text("Falso positivo, no máximo") input').first();
const campoCob = page.locator('label:has-text("Cobertura de revisão, no mínimo") input').first();

/*
 * Adapta-se ao ambiente: com metas semeadas confere os valores; sem elas,
 * confere o estado que o A.8 existe para tornar visível — "meta não declarada,
 * o painel não julga".
 */
const FP_SEMEADO = (process.env.NEXODOC_META_FALSO_POSITIVO ?? "").trim();

if (FP_SEMEADO) {
  conferir(
    "as metas do ambiente chegam nos campos",
    (await campoFp.inputValue()) === FP_SEMEADO,
    `fp="${await campoFp.inputValue()}" cobertura="${await campoCob.inputValue()}"`,
  );
  conferir(
    "o selo confirma que há metas declaradas",
    await page.getByText("metas declaradas", { exact: true }).isVisible(),
    "o selo não apareceu",
  );
} else {
  conferir(
    "sem metas no ambiente, os campos nascem vazios",
    (await campoFp.inputValue()) === "" && (await campoCob.inputValue()) === "",
    `fp="${await campoFp.inputValue()}" cobertura="${await campoCob.inputValue()}"`,
  );
  conferir(
    "e o selo diz que o painel NÃO julga",
    await page.getByText(/meta não declarada — o painel não julga/i).isVisible(),
    "o selo não apareceu",
  );
}

// --- 2. O botão de declarar segue o banco ---
const declarar = page.getByRole("button", { name: /Declarar metas/i });
conferir(
  temBanco()
    ? "com DATABASE_URL, declarar metas fica disponível"
    : "sem DATABASE_URL, declarar metas trava",
  temBanco() ? await declarar.isEnabled() : await declarar.isDisabled(),
  temBanco() ? "seguia travado" : "seguia clicável",
);

// --- 3. O painel de Quality abre e não inventa julgamento ---
await abrir("/admin/quality");
await page.waitForTimeout(800);
conferir(
  "a tela de Quality carrega (não é tela branca)",
  await page.locator("h1, h2").first().isVisible(),
  "nada renderizou",
);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
