/**
 * PROVA: entrar no software e cair numa tela SEM ESTILO.
 *
 * O sintoma relatado e visual ("a barra lateral ocupa a largura inteira"), e o
 * jeito de provar isso sem opinar sobre pixel e MEDIR: com o CSS aplicado a
 * lateral e uma faixa estreita; sem CSS ela vira o documento inteiro.
 *
 * O roteiro repete o caminho de verdade -- login pelo atalho dev, redirecionamento
 * para /nexo -- varias vezes, porque a falha e intermitente. Em cada rodada anota:
 *   - requisicoes de .css que nao voltaram 200;
 *   - se a folha de estilo chegou a valer (fundo do body + largura da lateral);
 *   - erros de console e o overlay de erro do Next.
 *
 * Nao gasta token: nao dispara nenhuma chamada de IA.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RODADAS = Number(process.env.RODADAS ?? 5);

function ok(v) {
  return v ? "OK " : "FALHA";
}

const browser = await chromium.launch();
let falhas = 0;

for (let i = 1; i <= RODADAS; i += 1) {
  // Contexto novo a cada rodada = cache do navegador vazio, sessao vazia.
  // E o estado de quem abre o software e faz login.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const cssRuins = [];
  const erros = [];

  page.on("response", (res) => {
    const u = res.url();
    if (u.includes(".css") && res.status() !== 200) {
      cssRuins.push(`${res.status()} ${u.replace(BASE, "")}`);
    }
  });
  page.on("requestfailed", (req) => {
    erros.push(`requisicao falhou: ${req.url().replace(BASE, "")}`);
  });
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(`console: ${m.text().slice(0, 160)}`);
  });

  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });

  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
  }

  await page.waitForURL(/\/nexo/, { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});

  const medida = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    // Qualquer elemento que so e estreito porque o CSS mandou. Sem folha de
    // estilo, um <aside>/<nav> vira bloco de largura total.
    const lateral = document.querySelector("aside, nav");
    const larguraLateral = lateral ? lateral.getBoundingClientRect().width : null;
    const folhas = [...document.styleSheets].length;
    let regras = 0;
    for (const s of document.styleSheets) {
      try {
        regras += s.cssRules.length;
      } catch {
        /* folha de outra origem */
      }
    }
    return {
      fundoDoBody: body.backgroundColor,
      larguraLateral,
      larguraDaJanela: window.innerWidth,
      folhas,
      regras,
      overlayDeErro: Boolean(document.querySelector("nextjs-portal")),
    };
  });

  // O veredito. As duas condicoes sao independentes de proposito: uma pega
  // "nenhuma folha carregou", a outra pega "carregou mas nao valeu".
  const temEstilo = medida.regras > 100;
  const lateralEstreita =
    medida.larguraLateral !== null &&
    medida.larguraLateral < medida.larguraDaJanela * 0.6;
  const passou = temEstilo && lateralEstreita && cssRuins.length === 0;

  if (!passou) {
    falhas += 1;
    await page.screenshot({ path: `prova-css-rodada-${i}.png`, fullPage: false });
  }

  console.log(
    [
      `rodada ${i}: ${ok(passou)}`,
      `folhas=${medida.folhas} regras=${medida.regras}`,
      `lateral=${medida.larguraLateral === null ? "ausente" : Math.round(medida.larguraLateral)}px de ${medida.larguraDaJanela}px`,
      `fundo=${medida.fundoDoBody}`,
      medida.overlayDeErro ? "OVERLAY DE ERRO DO NEXT" : "",
      cssRuins.length ? `css ruim: ${cssRuins.join(", ")}` : "",
      erros.length ? `| ${erros.slice(0, 3).join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join("  "),
  );

  await context.close();
}

await browser.close();
console.log(`\n=== ${RODADAS - falhas}/${RODADAS} rodadas com estilo aplicado ===`);
process.exit(falhas > 0 ? 1 : 0);
