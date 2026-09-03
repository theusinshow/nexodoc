/**
 * PROVA: o painel administrativo fala o idioma do produto.
 *
 * `app/admin/**` foi excluído do escopo do chanfro por decisão registrada em
 * 11/08/2026, e a dívida ficou datada. Esta prova é o portão de que ela não
 * volta.
 *
 * É UMA VARREDURA, não uma lista de arquivos — pelo mesmo motivo do critério 06
 * da `/nexo`: uma lista escrita à mão esquece. Foi assim que dois links de
 * rodapé passaram verde lá. Aqui ela percorre os CINCO destinos e acusa
 * qualquer elemento visível com raio maior que 4px que não seja círculo nem
 * forma recortada.
 *
 * Mede estilo COMPUTADO, não markup: `clip-path` que não aplicou volta "none",
 * não volta erro.
 *
 * Não gasta token de IA. Exige `NEXODOC_DEV_AUTH=true`, `NEXODOC_ADMIN_TOKEN` e
 * o servidor de pé.
 */
import nextEnv from "@next/env";
import { chromium } from "playwright";

nextEnv.loadEnvConfig(process.cwd());

const BASE = process.env.SHOT_BASE ?? process.env.BASE ?? "http://localhost:3000";
const ADMIN = (process.env.NEXODOC_ADMIN_EMAILS ?? "").split(",")[0].trim().toLowerCase();
const TOKEN = process.env.NEXODOC_ADMIN_TOKEN?.trim() ?? "";

const DESTINOS = [
  ["/admin", "Cockpit"],
  ["/admin/dinheiro", "Dinheiro"],
  ["/admin/motor", "Motor"],
  ["/admin/pessoas", "Pessoas"],
  ["/admin/dados", "Dados"],
];

const falhas = [];
function conferir(nome, condicao, detalhe = "") {
  if (condicao) console.log(`  OK      ${nome}`);
  else {
    falhas.push(nome);
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

if (!ADMIN || !TOKEN) {
  console.error("FALTA  NEXODOC_ADMIN_EMAILS e NEXODOC_ADMIN_TOKEN no .env.local");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

// Entra pelo atalho de dev, dentro do contexto do navegador para o cookie valer.
const { csrfToken } = await (await context.request.get(`${BASE}/api/auth/csrf`)).json();
await context.request.post(`${BASE}/api/auth/callback/nexodoc-dev`, {
  form: { csrfToken, email: ADMIN, json: "true", redirect: "false" },
});

/*
 * O token vai para o `sessionStorage` ANTES de a primeira tela carregar. Sem
 * ele o painel desenha só a casca, e uma varredura na casca não prova nada
 * sobre as tabelas — que são justamente onde o raio se escondia.
 */
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.evaluate((token) => sessionStorage.setItem("nexodoc-admin-token", token), TOKEN);

console.log("chanfro do painel administrativo\n");

const VARREDURA = () => {
  const fora = [];
  const todos = document.querySelectorAll("body *");
  for (const el of todos) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    const r = parseFloat(s.borderTopLeftRadius) || 0;
    if (r <= 4) continue;
    if (s.clipPath && s.clipPath !== "none") continue;
    const caixa = el.getBoundingClientRect();
    // Círculo é exceção declarada (selo, indicador, avatar).
    if (
      s.borderTopLeftRadius.includes("%") ||
      r >= Math.min(caixa.width, caixa.height) / 2 - 0.5
    ) {
      continue;
    }
    if (s.borderTopStyle === "dashed") continue;
    fora.push(
      `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} ${s.borderTopLeftRadius}`,
    );
  }
  return { fora: [...new Set(fora)], total: todos.length };
};

for (const [rota, nome] of DESTINOS) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  // A tela busca depois que o token é restaurado; sem esta espera a varredura
  // roda sobre o esqueleto.
  await page.waitForTimeout(1200);

  const url = page.url();
  conferir(`${nome} abre em ${rota}`, url.includes(rota), url);

  const { fora, total } = await page.evaluate(VARREDURA);
  conferir(
    `${nome}: nenhum dos ${total} elementos guardou raio`,
    fora.length === 0,
    fora.slice(0, 6).join(" | "),
  );
}

/*
 * O TRILHO PERSISTE E MARCA O ATUAL. É o que substitui as sete abas rasas, e a
 * marcação é a única coisa da barra que pode ser teal (a regra do acento único).
 */
await page.goto(`${BASE}/admin/dados`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);

const trilho = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Navegação administrativa"]');
  if (!nav) return null;
  const links = [...nav.querySelectorAll("a[href^='/admin']")];
  const atual = nav.querySelector('a[aria-current="page"]');
  const caixa = nav.getBoundingClientRect();
  return {
    destinos: links.length,
    atual: atual?.getAttribute("href") ?? null,
    // Medir a CAIXA contra a janela: asserção de DOM passa verde com o painel
    // fora da tela.
    visivel: caixa.width > 0 && caixa.left >= 0 && caixa.left < window.innerWidth,
    largura: Math.round(caixa.width),
  };
});

conferir("o trilho existe", trilho !== null);
if (trilho) {
  conferir("com os cinco destinos", trilho.destinos === 5, `achei ${trilho.destinos}`);
  conferir("marcando o atual", trilho.atual === "/admin/dados", String(trilho.atual));
  conferir(
    "e visível dentro da janela",
    trilho.visivel && trilho.largura > 150,
    `largura ${trilho.largura}px`,
  );
}

/* O campo de token existe UMA vez no painel inteiro, e ele mora no trilho. */
const campos = await page.evaluate(
  () => document.querySelectorAll('input[type="password"]').length,
);
conferir("um campo de token no painel inteiro, não um por tela", campos <= 1, `achei ${campos}`);

await browser.close();

if (falhas.length > 0) {
  console.error(`\n${falhas.length} FALHA(S)`);
  process.exit(1);
}

console.log("\no painel administrativo entrou no sistema visual");
