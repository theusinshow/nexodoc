// Verificação do fluxo do Nexo no NAVEGADOR, via Playwright.
//
// Existe porque `tsc`, `eslint`, os testes puros e o `build` não alcançam a
// classe de defeito que mais apareceu no uso real: nó do canvas remontando,
// card duplicado, contador sem fim, artefato que nunca é gerado. Todos passam
// limpos por toda a verificação automática e só aparecem clicando.
//
// Faz CHECAGENS, não só fotos: cada passo imprime OK/FALHOU e o script sai com
// código != 0 se algo quebrou, para servir de porta de qualidade.
//
//   npm run dev            (noutro terminal)
//   node scripts/shot-nexo.mjs
//
// CUSTA IA: ler os selos das pranchas é chamada de OpenAI (uma por folha).
// Por isso o padrão é 3 pranchas — o suficiente para a interface, troco em
// token. Ajuste com NEXO_SHOT_PRANCHAS.
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad";
const QUANTAS = Number(process.env.NEXO_SHOT_PRANCHAS ?? 3);

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his",
);
const PRANCHAS = Array.from({ length: QUANTAS }, (_, i) =>
  path.join(PASTA, `040_26_his_${String(i + 1).padStart(3, "0")}_a.pdf`),
);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) {
    console.log(`  OK      ${nome}`);
  } else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
// Erro de runtime no console é defeito: sem isto um crash de componente passa
// despercebido porque a tela só fica vazia.
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

try {
  // --- login ---------------------------------------------------------------
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  check("abriu /nexo autenticado", page.url().includes("/nexo"));

  // --- anexar pranchas -----------------------------------------------------
  // Pelo CLIPE, como o engenheiro faz. A tela tem três `input[type=file]`
  // (arquivos, pasta, anexo) e só o do clipe dispara a leitura dos selos —
  // pegar "o primeiro" acertava o input errado e nada acontecia.
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);

  // O contador tem de ter um TOTAL FIXO. O defeito era mostrar "1 de 1",
  // "2 de 2" — sempre iguais, sem dizer quando acabaria.
  const statusLendo = page.getByText(/folhas analisadas|Contando as folhas/i);
  await statusLendo.first().waitFor({ timeout: 30000 }).catch(() => {});
  const textoProgresso = (await statusLendo.first().textContent()) ?? "";
  const m = /(\d+)\s+de\s+(\d+)/.exec(textoProgresso);
  check(
    "progresso mostra total fixo (N de M, com M = nº de pranchas)",
    !m || Number(m[2]) === QUANTAS,
    `leu "${textoProgresso.trim()}" — esperava M=${QUANTAS}`,
  );

  // fim da leitura
  await page
    .getByText(/folha\(s\) de selo lidas/i)
    .first()
    .waitFor({ timeout: 180000 });
  await page.screenshot({ path: `${OUT}/nexo-1-leitura.png`, fullPage: true });
  check("terminou de ler os selos", true);

  // --- pedir os documentos em 2 tomos --------------------------------------
  const composer = page.locator("textarea").first();
  await composer.fill(
    "Crie LD, Capa e Separatriz, separados em 2 tomos, para prefeitura de Criciuma, o titulo e PROJETO TESTE AUTOMATICO",
  );
  await composer.press("Enter");

  // O card do plano tem de aparecer UMA vez. O risco era ele conviver com os
  // cards antigos, dobrando a tela.
  const cardPlano = page.getByText(/Vou gerar · \d+ documentos?/i);
  await cardPlano.first().waitFor({ timeout: 120000 });
  check("card do plano apareceu", (await cardPlano.count()) >= 1);
  check(
    "card do plano NÃO está duplicado",
    (await cardPlano.count()) === 1,
    `${await cardPlano.count()} cards`,
  );
  check(
    "cards antigos de capa/LD não aparecem junto",
    (await page.getByText(/Proposta · (Capa|LD|Separatriz)/i).count()) === 0,
  );
  await page.screenshot({ path: `${OUT}/nexo-2-plano.png`, fullPage: true });

  // --- gerar ---------------------------------------------------------------
  const botaoGerar = page.getByRole("button", { name: /Gerar os \d+/i }).first();
  await botaoGerar.click();
  await page
    .getByText(/Prontos no canvas/i)
    .first()
    .waitFor({ timeout: 180000 });
  await page.screenshot({ path: `${OUT}/nexo-3-gerado.png`, fullPage: true });
  check("gerou todos os documentos do plano", true);

  // --- canvas: separatriz existe e as fileiras são por tomo ----------------
  check(
    "separatriz aparece no canvas",
    (await page.getByText(/^Separatriz$/).count()) > 0,
  );
  // Escopado aos NÓS: a barra de navegação também escreve "Tomo 01"/"Tomo 02",
  // e contar a tela inteira daria 4 — falso negativo por causa do próprio teste.
  const rotulosDeFileira = page.locator(".react-flow__node").getByText(/^Tomo 0\d$/);
  check(
    "canvas tem uma fileira por tomo",
    (await rotulosDeFileira.count()) === 2,
    `${await rotulosDeFileira.count()} rótulos`,
  );

  // --- folhas como nós -----------------------------------------------------
  // Sub-projeto 3: a pilha única virou UM NÓ POR FOLHA. A contagem exata também
  // pega o defeito inverso: com a folha caindo em duas fileiras, o React Flow
  // veria id repetido e o número viria dobrado.
  const nosDeFolha = page.locator('.react-flow__node[data-id^="folha:"]');
  check(
    "cada folha vira um nó do canvas",
    (await nosDeFolha.count()) === QUANTAS,
    `${await nosDeFolha.count()} nós de folha para ${QUANTAS} pranchas`,
  );

  // --- janela de seleção (4A) ----------------------------------------------
  // Arrastar no VAZIO tem de selecionar as folhas cobertas, e não panorar. O
  // defeito silencioso aqui seria a janela existir mas não marcar nada.
  const caixaDoCanvas = await page.locator(".react-flow__pane").boundingBox();
  await page.mouse.move(caixaDoCanvas.x + 8, caixaDoCanvas.y + 8);
  await page.mouse.down();
  await page.mouse.move(
    caixaDoCanvas.x + caixaDoCanvas.width - 8,
    caixaDoCanvas.y + caixaDoCanvas.height - 8,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  const selecionadas = await page
    .locator('.react-flow__node[data-id^="folha:"].selected')
    .count();
  check(
    "janela de seleção marca as folhas cobertas",
    selecionadas > 0,
    `${selecionadas} folhas selecionadas`,
  );
  // Limpa a seleção para as checagens seguintes não herdarem 3 nós marcados.
  await page.locator(".react-flow__pane").click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(200);

  // --- selecionar um nó: as ferramentas têm de FICAR -----------------------
  // Este é o defeito que os nós remontando causavam: o botão piscava e sumia.
  // Clica no NÓ (wrapper do React Flow), não num texto qualquer: "Capa · TOMO
  // 01" também aparece no card do plano, e acertar o texto errado daria um
  // falso negativo difícil de ler.
  const noDoCanvas = page.locator(".react-flow__node").first();
  await noDoCanvas.click();
  await page.waitForTimeout(300);
  check(
    "clicar no nó o deixa SELECIONADO",
    (await page.locator(".react-flow__node.selected").count()) > 0,
  );

  const editar = page.getByRole("button", { name: /Editar aqui/i });
  await editar.first().waitFor({ timeout: 5000 }).catch(() => {});
  const apareceu = (await editar.count()) > 0;
  await page.waitForTimeout(1500);
  const continuou = (await editar.count()) > 0;
  check("‘Editar aqui’ aparece ao selecionar o nó", apareceu);
  check("‘Editar aqui’ CONTINUA na tela (nó não remonta)", apareceu && continuou);

  if (apareceu) {
    await editar.first().click();
    const campoTitulo = page.getByRole("dialog").locator("textarea").first();
    await campoTitulo.waitFor({ timeout: 5000 }).catch(() => {});
    check("editor do nó abriu", (await campoTitulo.count()) > 0);
    await page.waitForTimeout(1200);
    check(
      "editor do nó CONTINUA aberto (não fecha sozinho)",
      (await campoTitulo.count()) > 0,
    );
  }
  await page.screenshot({ path: `${OUT}/nexo-4-canvas.png`, fullPage: true });

  // --- navegação do canvas -------------------------------------------------
  // Não há minimapa: ele não consegue desenhar nós enquanto estes vierem de um
  // `useMemo` derivado (o React Flow exige dimensões no objeto do nó). Checar
  // que ele EXISTE passaria verde com o minimapa vazio — foi o que aconteceu.
  check(
    "minimapa não é renderizado (não funciona com nós derivados)",
    (await page.locator(".react-flow__minimap").count()) === 0,
  );

  const barra = page.getByRole("button", { name: /^Tomo 0\d$/ });
  check("barra de tomos aparece com mais de uma fileira", (await barra.count()) === 2);

  // Prova que NAVEGOU, não só que o botão existe: o transform do viewport tem
  // de mudar. Um teste que só clica passaria com o botão quebrado.
  const viewport = page.locator(".react-flow__viewport");
  const antes = await viewport.getAttribute("style");
  await barra.nth(1).click();
  await page.waitForTimeout(700);
  const depois = await viewport.getAttribute("style");
  check("clicar em TOMO 02 muda o enquadramento", antes !== depois);

  // `0` reenquadra tudo — de novo comparando o viewport.
  await page.locator(".react-flow__pane").click();
  const antesDoZero = await viewport.getAttribute("style");
  await page.keyboard.press("0");
  await page.waitForTimeout(700);
  check(
    "tecla 0 reenquadra",
    (await viewport.getAttribute("style")) !== antesDoZero,
  );

  await page.screenshot({ path: `${OUT}/nexo-5-navegacao.png`, fullPage: true });

  check("nenhum erro de runtime no console", errosDeConsole.length === 0,
    errosDeConsole.slice(0, 2).join(" | "));
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
  await page.screenshot({ path: `${OUT}/nexo-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

console.log(
  falhas === 0
    ? "\nTudo OK. Prints em " + OUT
    : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
