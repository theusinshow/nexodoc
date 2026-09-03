/**
 * PROVA: a disposição da home, medida na tela cheia.
 *
 *   node scripts/semear-home.mjs && node scripts/prova-home.mjs
 *   (== npm run prova:home-cheia)
 *
 * O defeito que este trabalho fechou não é de lógica: era **heterogeneidade**.
 * Três tratamentos visuais na mesma coluna — caixa âmbar, caixa teal e texto
 * solto — e o texto solto lia como desabilitado ao lado das caixas. Nenhuma
 * asserção de DOM pega isso: os quatro rótulos existiam, com o texto certo.
 *
 * Por isso aqui se mede ESTILO COMPUTADO: quantos chips têm borda, quantos têm
 * a forma recortada, e se algum ficou para trás.
 *
 * Não gasta token. Exige a cena de `semear-home.mjs` e o servidor de pé.
 */
import nextEnv from "@next/env";
import { chromium } from "playwright";

nextEnv.loadEnvConfig(process.cwd());

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const EU = (process.env.NEXODOC_ADMIN_EMAILS ?? "").split(",")[0].trim().toLowerCase();

const falhas = [];
function conferir(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas.push(nome);
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const { csrfToken } = await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json();
await ctx.request.post(`${BASE}/api/auth/callback/nexodoc-dev`, {
  form: { csrfToken, email: EU, json: "true", redirect: "false" },
});

console.log("disposição da home\n");

/* ─────────────────── a fusão, antes da tela ─────────────────── */

const painel = await (await ctx.request.get(`${BASE}/api/painel`)).json();
const codigos = painel.projetos.map((p) => p.codigo);

conferir(
  "a obra que SÓ teve volume montado está na lista principal",
  codigos.includes("SIM099-26"),
  codigos.join(", "),
);
conferir(
  "e nenhum projeto aparece duas vezes",
  new Set(codigos).size === codigos.length,
  codigos.join(", "),
);
conferir(
  "a coluna da direita não existe mais no contrato",
  painel.trabalho.projetos === undefined,
  JSON.stringify(Object.keys(painel.trabalho)),
);
conferir(
  "e a retomada continua sabendo a pasta dela",
  painel.trabalho.ondeParou === null || painel.trabalho.retomada !== undefined,
);

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2400);

/* ─────────────────── uma forma, cinco cores ─────────────────── */

const chips = await page.evaluate(() => {
  const alvos = [];
  for (const el of document.querySelectorAll("span")) {
    const t = (el.textContent || "").trim();
    // Os textos que a coluna de estado produz — ver `resumoDoProjeto`.
    if (!/^(\d+ achados?( · parado há \d+ dias)?|\d+ com .+|sem pendência|volume montado|auditoria em curso)$/.test(t)) {
      continue;
    }
    const s = getComputedStyle(el);
    alvos.push({
      texto: t,
      borda: parseFloat(s.borderTopWidth) || 0,
      recortado: s.clipPath !== "none",
      cor: s.color,
    });
  }
  return alvos;
});

conferir("a coluna de estado tem chip em toda linha", chips.length >= 5, `achei ${chips.length}`);

const semBorda = chips.filter((c) => c.borda < 1);
conferir(
  `os ${chips.length} chips têm contorno — nenhum virou texto solto`,
  semBorda.length === 0,
  semBorda.map((c) => `"${c.texto}"`).join(", "),
);

const semForma = chips.filter((c) => !c.recortado);
conferir(
  "e todos têm a mesma forma recortada",
  semForma.length === 0,
  semForma.map((c) => `"${c.texto}"`).join(", "),
);

conferir(
  "as cores DIFERENCIAM os estados — a hierarquia é a cor, não a forma",
  new Set(chips.map((c) => c.cor)).size >= 3,
  [...new Set(chips.map((c) => c.cor))].join(" | "),
);

/* ─────────────────── a cidade, que decodifica a marca ─────────────────── */

const cidades = await page.evaluate(() =>
  [...document.querySelectorAll("span")]
    .map((el) => (el.textContent || "").trim())
    .filter((t) => /^· (CRICIÚMA|CHAPECÓ|IÇARA|TUBARÃO|sem cidade)$/.test(t)),
);
conferir(
  "a cidade está escrita ao lado de cada obra — o contrato da marca",
  cidades.length >= 5,
  `achei ${cidades.length}`,
);
conferir(
  "e a obra sem município diz 'sem cidade', não um '·' pendurado",
  cidades.some((t) => t.includes("sem cidade")),
);

/* ─────────────────── uma lista, e ela cabe ─────────────────── */

const forma = await page.evaluate(() => {
  const asides = [...document.querySelectorAll("main aside")];
  return {
    asides: asides.length,
    pagina: document.documentElement.scrollHeight,
    janela: window.innerHeight,
  };
});
conferir("não há segunda coluna na home", forma.asides === 0, `achei ${forma.asides}`);
conferir(
  "e as 6 obras cabem em pouco mais de uma dobra",
  forma.pagina / forma.janela < 1.4,
  `${(forma.pagina / forma.janela).toFixed(2)} dobras`,
);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} FALHA(S)`);
  process.exit(1);
}

console.log("\na home fala um vocabulário só");
