// A BANCADA AINDA ABRE — e oferece exatamente os estados que existem.
//
// A bancada é a ferramenta de afinação da marca (DESIGN.md §6): é nela que se
// decide, vendo, quanto vale cada parâmetro do orbe. Uma bancada quebrada não
// derruba o produto, então ninguém descobre que ela quebrou até precisar dela —
// que é sempre no meio de uma decisão de marca, o pior momento possível.
//
// A prova é dupla, e a segunda metade é a que importa: além de abrir, o seletor
// de estados tem de listar os MESMOS estados que `AGENT_STATES` declara. A lista
// da bancada já foi uma cópia escrita à mão, e ela divergiu — oferecia `hover` e
// `uploading`, dois estados que a máquina do agente nunca produz. Afinar um
// estado que o produto não alcança é afinar no vazio.
//
//   npm run dev                        (noutro terminal)
//   node scripts/prova-bancada-do-orbe.mjs
//   node scripts/prova-bancada-do-orbe.mjs --png=./scratchpad/bancada.png
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split("=")[1] : padrao;
};

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const PNG = arg("png", null);

/*
 * A lista esperada sai do CÓDIGO-FONTE, não de uma cópia aqui.
 *
 * Copiar os sete nomes para dentro desta prova recriaria exatamente o problema
 * que ela existe para pegar: mais uma lista à mão, divergindo em silêncio. Ler o
 * arquivo e extrair o bloco é feio e é certo.
 */
const fonte = readFileSync(
  new URL("../modules/nexo/components/agent-orb/agent-orb.types.ts", import.meta.url),
  "utf8",
);
const bloco = fonte.match(/AGENT_STATES[^=]*=\s*\[([^\]]*)\]/);
if (!bloco) {
  console.error("FALHOU  não achei AGENT_STATES em agent-orb.types.ts");
  process.exit(1);
}
const esperados = [...bloco[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();

// WebGL sem tela: sem estas flags o Chromium headless RECUSA em vez de renderizar,
// e o canvas viria vazio com cara de sucesso.
const browser = await chromium.launch({
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

let falhou = false;
try {
  const ctx = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 1.5,
  });
  const page = await ctx.newPage();

  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });

  await page.goto(`${BASE}/bancada-do-orbe`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await page.locator("canvas").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2500); // a cena entra amortecida; deixa assentar

  const oferecidos = (
    await page.locator("select").first().locator("option").allTextContents()
  )
    .map((t) => t.trim())
    .sort();

  const faltando = esperados.filter((e) => !oferecidos.includes(e));
  const sobrando = oferecidos.filter((o) => !esperados.includes(o));

  if (faltando.length || sobrando.length) {
    falhou = true;
    console.error("FALHOU  o seletor da bancada não bate com AGENT_STATES");
    if (faltando.length) console.error(`  faltando: ${faltando.join(" ")}`);
    if (sobrando.length) console.error(`  sobrando: ${sobrando.join(" ")}`);
  } else {
    console.log(`  ok  ${oferecidos.length} estados: ${oferecidos.join(" ")}`);
  }

  if (erros.length) {
    falhou = true;
    console.error(`FALHOU  ${erros.length} erro(s) no navegador:`);
    for (const e of erros.slice(0, 5)) console.error(`  ${e}`);
  } else {
    console.log("  ok  nenhum erro no console");
  }

  if (PNG) {
    await page.screenshot({ path: PNG, fullPage: true });
    console.log(`  png  ${PNG}`);
  }
} finally {
  await browser.close();
}

process.exit(falhou ? 1 : 0);
