/**
 * PROVA: a tela de Configurações abre pelo que exige ação, e a "última falha"
 * tem uma fonte só.
 *
 * Hierarquia não se prova lendo JSX: prova-se medindo a POSIÇÃO de cada seção
 * na página. É o que esta prova faz — compara as coordenadas, não a ordem do
 * arquivo.
 *
 *   node scripts/prova-config-hierarquia.mjs   (== npm run prova:config)
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
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.goto(`${BASE}/admin/config`, { waitUntil: "domcontentloaded" });
}
await page.waitForLoadState("networkidle").catch(() => {});
await page.locator('input[type="password"]').first().fill(TOKEN);
await page.locator("form button[type=submit]").first().click();
await page.waitForTimeout(1200);

const alturaDe = async (texto) => {
  const alvo = page.locator("h2", { hasText: texto }).first();
  const caixa = await alvo.boundingBox();
  return caixa?.y ?? Number.POSITIVE_INFINITY;
};

// --- 1. A faixa de atenção existe e diz o que está quebrado ---
conferir(
  "sem DATABASE_URL, a faixa avisa que nada é gravado",
  await page.getByText(/sem DATABASE_URL — nada do que se declara/i).isVisible(),
  "a faixa não apareceu",
);

const faixa = await page
  .getByText(/sem DATABASE_URL — nada do que se declara/i)
  .first()
  .boundingBox();
const primeiraSecao = Math.min(
  await alturaDe("Painel de provedores IA"),
  await alturaDe("Escritório emissor"),
);
conferir(
  "a faixa vem ANTES de qualquer seção",
  Boolean(faixa) && faixa.y < primeiraSecao,
  `faixa=${faixa?.y} primeira seção=${primeiraSecao}`,
);

// --- 2. A hierarquia: operação antes de declaração antes de referência ---
const provedores = await alturaDe("Painel de provedores IA");
const modelos = await alturaDe("Editor de modelos por fluxo");
const escritorio = await alturaDe("Escritório emissor");
const runtime = await alturaDe("Runtime");

conferir(
  "provedores e modelos vêm antes das declarações",
  Math.max(provedores, modelos) < escritorio,
  `provedores=${provedores} modelos=${modelos} escritório=${escritorio}`,
);
conferir(
  "a referência (Runtime) fica por último",
  runtime > escritorio,
  `runtime=${runtime} escritório=${escritorio}`,
);

// --- 3. A última falha tem UMA fonte ---
conferir(
  "a seção duplicada de incidentes não existe mais",
  (await page.locator("h2", { hasText: "Últimos incidentes de provedor" }).count()) === 0,
  "a segunda lista de incidentes continua na página",
);
conferir(
  "a procedência do status sobreviveu à fusão",
  await page.getByText(/Memória da instância atual/i).first().isVisible(),
  "a linha de onde vem o status sumiu junto com a seção",
);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
