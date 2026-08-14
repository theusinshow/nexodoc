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

import { temBanco, tokenDoAdmin } from "./token-do-admin.mjs";

/*
 * DUAS GRAFIAS, e as duas valem.
 *
 * O resto das provas le `SHOT_BASE`; estas tres liam so `BASE`. Quem rodasse a
 * suite com `SHOT_BASE` apontando para outra porta via estas tres baterem
 * silenciosamente no servidor da 3000 -- que numa maquina com mais de um
 * worktree e OUTRO aplicativo, com outro banco e outro token. O sintoma era uma
 * falha de tela ("a faixa nao apareceu") que nao falava de porta nenhuma, e
 * custou horas de investigacao contra o aplicativo errado.
 */
const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
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

await page.goto(`${BASE}/admin/config`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
  await page.goto(`${BASE}/admin/config`, { waitUntil: "domcontentloaded" });
}
await page.waitForLoadState("networkidle").catch(() => {});

/*
 * --- 0. O PORTÃO: o campo de token tem de sobreviver a quem o usa ---
 *
 * Duas regressões reais moram aqui, as duas encontradas à mão em 13/08:
 * o campo sumia na PRIMEIRA TECLA (não havia como entrar no admin), e o token
 * RECUSADO também recolhia o formulário — "Acesso admin negado" sem campo para
 * corrigir. As duas passavam por `tsc` e `eslint` sem um ruído.
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

await page.locator('input[type="password"]').first().fill("token-errado");
await page.locator("form button[type=submit]").first().click();
await page.waitForTimeout(1200);
conferir(
  "token recusado mantém o campo aberto para corrigir",
  (await page.locator('input[type="password"]').count()) === 1,
  "o formulário recolheu mesmo com o acesso negado",
);
conferir(
  "e o motivo da recusa aparece na tela",
  await page.getByText(/Acesso admin negado/i).first().isVisible(),
  "a mensagem de recusa não apareceu",
);

await page.locator('input[type="password"]').first().fill(TOKEN);
await page.locator("form button[type=submit]").first().click();
await page.waitForTimeout(1200);

const alturaDe = async (texto) => {
  const alvo = page.locator("h2", { hasText: texto }).first();
  const caixa = await alvo.boundingBox();
  return caixa?.y ?? Number.POSITIVE_INFINITY;
};

/*
 * --- 1. A faixa de atenção existe e diz o estado REAL da instância ---
 *
 * Com banco, a faixa fala de chave e de incidente; sem banco, fala da falta do
 * banco; e numa instância sadia ela diz que não há nada a fazer. Os três são
 * comportamento correto — o que não pode é a faixa não existir.
 */
const linhaDaFaixa = temBanco()
  ? /nada exigindo ação|fluxo\(s\) sem chave|incidente\(s\) de provedor|modelo de espaço reservado/i
  : /sem DATABASE_URL — nada do que se declara/i;

conferir(
  temBanco()
    ? "a faixa resume o estado da instância"
    : "sem DATABASE_URL, a faixa avisa que nada é gravado",
  await page.getByText(linhaDaFaixa).first().isVisible(),
  "a faixa não apareceu",
);

const faixa = await page.getByText(linhaDaFaixa).first().boundingBox();
const primeiraSecao = Math.min(
  await alturaDe("Painel de provedores IA"),
  await alturaDe("Metas de qualidade"),
);
conferir(
  "a faixa vem ANTES de qualquer seção",
  Boolean(faixa) && faixa.y < primeiraSecao,
  `faixa=${faixa?.y} primeira seção=${primeiraSecao}`,
);

// --- 2. A hierarquia: operação antes de declaração antes de referência ---
const provedores = await alturaDe("Painel de provedores IA");
const modelos = await alturaDe("Editor de modelos por fluxo");
const primeiraDeclaracao = await alturaDe("Metas de qualidade");
const runtime = await alturaDe("Runtime");

conferir(
  "provedores e modelos vêm antes das declarações",
  Math.max(provedores, modelos) < primeiraDeclaracao,
  `provedores=${provedores} modelos=${modelos} declaração=${primeiraDeclaracao}`,
);
conferir(
  "a referência (Runtime) fica por último",
  runtime > primeiraDeclaracao,
  `runtime=${runtime} declaração=${primeiraDeclaracao}`,
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
