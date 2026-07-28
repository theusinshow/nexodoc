// Verificação da AUDITORIA DE MEMORIAL no NAVEGADOR, via Playwright.
//
// Existe pelo mesmo motivo do `shot-nexo.mjs`: `tsc`, as 43 suítes e o build
// passam limpos e não alcançam a classe de defeito que só aparece rodando —
// documento que não chega inteiro na IA, lixo de sumário virando achado, visor
// de PDF que não destaca. O motor da auditoria nunca foi visto rodando de ponta
// a ponta no navegador.
//
// Faz CHECAGENS, não fotos: cada passo imprime OK/FALHOU e o script sai != 0.
//
//   npm run dev                 (noutro terminal)
//   node scripts/shot-audit.mjs
//
// CUSTA IA DE VERDADE: uma auditoria Profunda de um memorial de 132 páginas no
// gpt-5.5, com o documento inteiro na passada global. Rode com intenção.
//
// O memorial 017-26 é o artefato calibrado: obra correta "Centro Comunitário
// Primeira Linha" (Criciúma), com texto reaproveitado de 3 outros projetos.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NEXO - TESTES\\Memoriais\\017_26_md_geral_c_assinado.pdf";
const OBRA = "Centro Comunitário Primeira Linha";
/*
 * AUDIT_REUSE=1 reabre a ÚLTIMA auditoria do histórico em vez de rodar outra.
 * As checagens de tela (camadas, selos, visor de PDF) não precisam de uma
 * auditoria nova, e cada rodada de verdade custa ~110k tokens — consertar uma
 * asserção de UI a esse preço é o que faz ninguém consertar.
 */
const REUSAR = process.env.AUDIT_REUSE === "1";
const LOG_DEV = path.resolve(".next/dev/logs/next-development.log");

/** As identidades reaproveitadas que ESTE memorial comprovadamente contém. */
const IDENTIDADES_ERRADAS = [
  "Cidade do Autista",
  "Centro Dia do Idoso",
  "unidade básica de saúde",
  "Centro Comunitário Boa Vista",
];

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/** Linhas `[ai]` que o servidor gravou depois de um marco. */
function linhasDeIa(desde) {
  if (!fs.existsSync(LOG_DEV)) return [];
  return fs
    .readFileSync(LOG_DEV, "utf8")
    .split("\n")
    .slice(desde)
    .filter((l) => l.includes("[ai] flow=audit"));
}
function totalDeLinhas() {
  if (!fs.existsSync(LOG_DEV)) return 0;
  return fs.readFileSync(LOG_DEV, "utf8").split("\n").length;
}

if (!fs.existsSync(MEMORIAL)) {
  console.error(`Memorial não encontrado: ${MEMORIAL}`);
  console.error("Aponte outro com AUDIT_PDF=<caminho>.");
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  const marcoLog = totalDeLinhas();

  // --- login ---------------------------------------------------------------
  await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/audit**", { timeout: 20000 });
  }
  check("abriu /audit autenticado", page.url().includes("/audit"));

  if (REUSAR) {
    // Reabre a última auditoria concluída: as checagens de TELA não precisam de
    // execução nova, e assim elas ficam baratas de consertar.
    const itens = page.locator("aside button");
    const alvo = page.getByRole("button", { name: /Memorial\s*·\s*(Padrão|Profundo)\s*·\s*conclu/i }).first();
    await alvo.waitFor({ timeout: 20000 });
    await alvo.click();
    await page.waitForTimeout(2500);
    check("reabriu a última auditoria do histórico", (await itens.count()) > 0);
  } else {
  // Começa limpo: sem isto a tela pode estar exibindo uma auditoria restaurada do
  // histórico, e o teste mediria a rodada de ontem achando que é a de agora.
  const novaAuditoria = page.getByRole("button", { name: /Nova auditoria/i });
  if ((await novaAuditoria.count()) > 0) {
    await novaAuditoria.first().click();
    await page.waitForTimeout(800);
  }

  // --- anexar o memorial ---------------------------------------------------
  await page.locator('input[type="file"]').first().setInputFiles(MEMORIAL);
  // A classificação determinística roda antes de qualquer IA e monta o cartão.
  await page
    .getByText(/Gabarito da obra/i)
    .first()
    .waitFor({ timeout: 120000 });
  check("classificou o arquivo e ofereceu o gabarito", true);
  await page.screenshot({ path: `${OUT}/audit-1-setup.png`, fullPage: true });

  // --- gabarito: a obra declarada é a base de comparação da identidade -----
  await page.getByRole("button", { name: /Gabarito da obra/i }).first().click();
  await page.waitForTimeout(300);
  const campoObra = page.getByPlaceholder(/Como consta na capa/i);
  await campoObra.waitFor({ timeout: 10000 });
  await campoObra.fill(OBRA);
  check("preencheu a obra do gabarito", (await campoObra.inputValue()) === OBRA);

  // --- nível Profundo ------------------------------------------------------
  // O preset fica no dropdown de configuração; sem Profundo não há passada
  // global com o documento inteiro, que é justamente o que se quer observar.
  /*
   * O botão de configuração é o que mostra "Memorial · Profundo". Mirar só
   * /Memorial/ é ambíguo: o seletor de TIPO ao lado de "Anexar PDFs" também
   * casa, e qual dos dois o `.first()` pega muda conforme o estado da tela.
   */
  /*
   * ANCORADO no texto inteiro. Sem as âncoras, o seletor casava com os ITENS DO
   * HISTÓRICO da barra lateral ("017-26 · Memorial · Profundo · concluído"), que
   * vêm antes no DOM: o teste lia "Profundo" de uma auditoria passada, pulava a
   * seleção, e a rodada saía em Padrão — com o log parecendo provar que o
   * Profundo estava quebrado.
   */
  const botaoConfig = page
    .getByRole("button", { name: /^(Memorial|Volume)\s*·\s*(Padrão|Profundo)$/ })
    .first();
  await botaoConfig.waitFor({ timeout: 10000 });
  /*
   * Clica SEMPRE, mesmo que o rótulo já diga Profundo. O rótulo é restaurado do
   * histórico ao abrir a tela, e confiar nele deixa em aberto se o estado que vai
   * na requisição é o mesmo que está escrito no botão — que é justamente o que
   * este teste precisa distinguir.
   */
  await botaoConfig.click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Profundo$/ }).first().click({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  check(
    "o nível é Profundo (sem ele não há passada global com o doc inteiro)",
    /Profundo/i.test((await botaoConfig.innerText()) ?? ""),
    await botaoConfig.innerText(),
  );

  // --- rodar ---------------------------------------------------------------
  const composer = page.locator("textarea").first();
  await composer.fill("Audita este memorial.");
  // Enter NÃO envia nesta tela: o disparo é o botão. Pressionar Enter deixava a
  // etiqueta em "aguardando envio" e o script esperava 15 minutos por uma
  // auditoria que nunca tinha começado.
  await page.getByRole("button", { name: /^Auditar$/ }).first().click();

  /*
   * Trava de partida: a auditoria PRECISA dar sinal de vida rápido. Sem isto, um
   * envio que não pega vira quinze minutos de espera e um timeout que não diz
   * nada sobre o motor.
   */
  /*
   * O sinal é o PROGRESSO ("Analisando blocos…"), não o sumiço da etiqueta
   * "aguardando envio": ela continua na tela enquanto a auditoria roda (é um
   * defeito da própria etiqueta, anotado à parte). Vigiá-la fazia o teste abortar
   * uma rodada perfeitamente saudável.
   */
  const comecou = await page
    .getByText(/Analisando|servidor segue trabalhando/i)
    .first()
    .waitFor({ timeout: 90000 })
    .then(() => true)
    .catch(() => linhasDeIa(marcoLog).length > 0);
  check("a auditoria SAIU do estado de espera (o envio pegou)", comecou);
  if (!comecou) throw new Error("o envio não disparou a auditoria — nada a medir adiante");
  console.log("  … auditoria rodando (pode levar minutos e gasta token)");

  // O veredito é o herói do topo do resultado: é ele que diz que acabou.
  }

  const veredito = page.getByText(/NÃO EMITIR|REVISAR|LIBERADO|ANÁLISE PARCIAL/i);
  await veredito.first().waitFor({ timeout: 900000 });
  check("a auditoria terminou e mostrou o veredito", true);
  await page.screenshot({ path: `${OUT}/audit-2-resultado.png`, fullPage: true });

  /*
   * O nível QUE O RELATÓRIO REGISTROU, não o que o botão mostrava. É a única
   * forma de saber se o Profundo escolhido na tela chegou de fato à execução —
   * e é o que separa "meu clique não pegou" de "o produto ignorou a escolha".
   */
  await page.getByRole("button", { name: /Detalhes/i }).first().click();
  await page.waitForTimeout(600);
  const painel = await page.locator("aside").last().innerText();
  const nivelRegistrado = /N[íi]vel\s*\n?\s*(Profundo|Padr[ãa]o)/i.exec(painel)?.[1] ?? "?";
  check(
    "o relatório registrou nível Profundo (a escolha da tela chegou na execução)",
    /Profundo/i.test(nivelRegistrado),
    `registrado: ${nivelRegistrado}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  /*
   * Os achados moram na aba "Achados". Ler o corpo na aba "Resumo" reportava
   * ausência de tudo — inclusive de coisas que a auditoria tinha encontrado.
   */
  const abaAchados = page.getByRole("button", { name: /^Achados$/ });
  if ((await abaAchados.count()) > 0) {
    await abaAchados.first().click();
    await page.waitForTimeout(800);
  }
  check("a aba de achados abriu", (await abaAchados.count()) > 0);
  await page.screenshot({ path: `${OUT}/audit-2b-achados.png`, fullPage: true });

  const texto = await page.locator("body").innerText();

  // --- A1: o documento INTEIRO chega na passada global ---------------------
  const linhas = REUSAR ? [] : linhasDeIa(marcoLog);
  if (REUSAR) console.log("  (modo reuso: as checagens de log são puladas)");
  const global = linhas.find((l) => l.includes("op=audit-global"));
  const entrada = global ? Number(/in=(\d+)/.exec(global)?.[1] ?? 0) : 0;
  if (!REUSAR) {
  check(
    "a passada global rodou",
    Boolean(global),
    linhas.map((l) => /op=([a-z-]+)/.exec(l)?.[1]).join(", ") || "nenhuma linha [ai]",
  );
  check(
    "o documento INTEIRO chegou na IA (A1: entrada > 60k tokens)",
    entrada > 60000,
    `in=${entrada} tokens`,
  );

  /*
   * NENHUMA passada pode ter abortado. A validação — quem rebaixa achado incerto
   * para "Sugestão" e filtra alucinação — falhava por timeout em toda auditoria
   * Profunda, e a tela não dizia nada: o relatório saía inteiro, só que sem a
   * camada que separa o que é sólido do que é palpite.
   */
  const abortadas = linhas.filter((l) => l.includes("status=FAILED"));
  check(
    "nenhuma passada da auditoria abortou",
    abortadas.length === 0,
    abortadas.map((l) => /op=([a-z-]+)/.exec(l)?.[1]).join(", "),
  );
  check(
    "a validação rodou (é ela que separa achado sólido de sugestão)",
    linhas.some((l) => l.includes("op=audit-validation") && l.includes("status=OK")),
  );
  }

  /*
   * O AVISO de análise parcial. Só existe quando alguma passada aborta — e aborto
   * é intermitente, então a rodada normal não o exercita. Com DEGRADAR=1 o teste
   * inverte a expectativa: aí o veredito TEM de se rebaixar, e passar batido é a
   * falha. É a única forma de saber que o aviso funciona antes de precisar dele.
   */
  const textoTopo = await page.locator("body").innerText();
  const avisouParcial = /AN[ÁA]LISE PARCIAL/i.test(textoTopo);
  if (process.env.DEGRADAR === "1") {
    check("com passada abortada, o veredito se rebaixa a ANÁLISE PARCIAL", avisouParcial);
  } else {
    check("sem aborto, o veredito NÃO grita análise parcial", !avisouParcial);
  }

  // --- os achados que este memorial COMPROVADAMENTE tem -------------------
  for (const identidade of IDENTIDADES_ERRADAS) {
    check(
      `achou a identidade reaproveitada "${identidade}"`,
      texto.toLowerCase().includes(identidade.toLowerCase()),
    );
  }

  // --- as duas camadas do resultado ---------------------------------------
  check(
    "o veredito de emissão está no topo",
    /NÃO EMITIR|REVISAR|LIBERADO|ANÁLISE PARCIAL/i.test(texto),
  );
  check(
    "achado de regra vem com o selo de verificado",
    /Verificad/i.test(texto),
  );
  /*
   * A camada de sugestões só é renderizada quando ALGUM achado foi rebaixado a
   * `tier === "sugestao"`. Exigi-la sempre era teste errado: numa auditoria em que
   * a validação considerou tudo sólido, a ausência é o comportamento correto.
   * O que precisa existir sempre é o VOCABULÁRIO de confiança — sem ele, o
   * usuário não distingue o que é regra do que é palpite.
   */
  const temSugeridos = /◻\s*Sugerido/i.test(texto);
  const temCamada = /Sugestões da IA/i.test(texto);
  check(
    "o vocabulário de confiança aparece nos achados",
    /✔\s*Verificado/i.test(texto) || temSugeridos,
  );
  /*
   * A camada recolhível só nasce quando a validação REBAIXA algum achado. Não dá
   * para exigir de fora: uma auditoria em que tudo é sólido não tem camada, e
   * isso é correto. Fica como MEDIÇÃO — o número interessa para calibrar o
   * quanto a validação está rebaixando.
   */
  console.log(`  camada "Sugestões da IA" presente: ${temCamada ? "sim" : "não (nada foi rebaixado)"}`);

  // --- o lixo que a supressão de meta/sumário tem de ter comido -----------
  check(
    "nenhum achado é sobre o sumário/índice do próprio documento",
    !/achado.*sum[áa]rio|sum[áa]rio.*diverg/i.test(texto),
    "aparece texto de sumário entre os achados",
  );

  // --- o visor de PDF ------------------------------------------------------
  /*
   * "Abrir PDF" vive dentro do menu `⋯` de cada achado desde o declutter da UI —
   * procurar um botão visível reportava ausência de um recurso que existe.
   */
  /*
   * Só em auditoria RECÉM-FEITA: o PDF não é guardado (decisão de projeto), então
   * a reaberta do histórico não tem `pdfUrl` e o item nem é renderizado. Cobrar
   * isso no reuso reprovaria o comportamento correto.
   */
  if (REUSAR) {
    console.log("  (modo reuso: o visor de PDF não é testável — o arquivo não é guardado)");
  } else {
  const menuDoAchado = page.getByRole("button", { name: /Ações do achado/i });
  if ((await menuDoAchado.count()) > 0) {
    await menuDoAchado.first().click();
    await page.waitForTimeout(500);
  }
  /*
   * `menuitem`, não `button`: o DropdownItem declara `role="menuitem"`, e com role
   * explícito o getByRole("button") não casa. O recurso existia desde sempre; o
   * seletor é que procurava o papel errado.
   */
  const abrirPdf = page.getByRole("menuitem", { name: /Abrir PDF|Ver no PDF/i });
  if ((await abrirPdf.count()) > 0) {
    await abrirPdf.first().click();
    await page.waitForTimeout(2500);
    check(
      "o visor de PDF abriu embutido (não em aba nova)",
      (await page.locator("canvas, .react-pdf__Page").count()) > 0,
    );
    await page.screenshot({ path: `${OUT}/audit-3-visor.png`, fullPage: true });
  } else {
    check("existe o botão de abrir o PDF no achado", false, "botão não encontrado");
  }
  }

  check("nenhum erro de runtime no console", erros.length === 0, erros[0] ?? "");

  // Painel do custo: o que esta rodada consumiu, para calibrar o preço.
  const gasto = linhas.reduce((soma, l) => soma + Number(/total=(\d+)/.exec(l)?.[1] ?? 0), 0);
  console.log(`\n  custo desta rodada: ${gasto} tokens em ${linhas.length} chamadas`);
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e);
  await page.screenshot({ path: `${OUT}/audit-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
