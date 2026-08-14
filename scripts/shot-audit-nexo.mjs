// Verificação da AUDITORIA DE MEMORIAL **PELO CHAT** (Nexo), via Playwright.
//
// Irmão do `scripts/shot-audit.mjs`, que faz o mesmo pela tela /audit. As
// asserções são as MESMAS de propósito: os dois caminhos precisam achar o mesmo
// no mesmo documento. Divergência é regressão, não diferença de caminho — e é
// isso que autoriza, mais adiante, aposentar a /audit sem perder recurso.
//
//   npm run dev                      (noutro terminal)
//   node scripts/shot-audit-nexo.mjs
//
// CUSTA IA DE VERDADE: auditoria Profunda de um memorial de 132 páginas.
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NexoDoc\\NEXO - TESTES\\Memoriais\\017_26_md_geral_c_assinado.pdf";
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

  await pularTourGuiado(page);

  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  check("abriu /nexo autenticado", page.url().includes("/nexo"));

  // Começa limpo: conversa restaurada mediria a rodada de ontem.
  const nova = page.getByRole("button", { name: /Nova conversa/i });
  if ((await nova.count()) > 0) {
    await nova.first().click();
    await page.waitForTimeout(800);
  }

  // Pelo CLIPE: a tela tem três inputs de arquivo e só este dispara a leitura.
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(MEMORIAL);

  await page.getByText(/memorial descritivo/i).first().waitFor({ timeout: 180000 });
  check("o Nexo reconheceu o memorial sozinho", true);

  const texto0 = await page.locator("body").innerText();
  check(
    "o intake afirma a obra lida (é o gabarito da auditoria)",
    /Centro Comunit[áa]rio Primeira Linha/i.test(texto0),
    texto0.slice(0, 200).replace(/\s+/g, " "),
  );
  check(
    "e oferece corrigir a obra",
    (await page.getByRole("button", { name: /A obra está errada/i }).count()) > 0,
  );
  await page.screenshot({ path: `${OUT}/nexo-audit-1-intake.png`, fullPage: true });

  // --- pedir a auditoria profunda -----------------------------------------
  await page.getByRole("button", { name: /Auditoria profunda/i }).first().click();
  // O agente responde e propõe; o cartão de auditoria precisa ser confirmado.
  const confirmar = page.getByRole("button", { name: /^(Auditar|Gerar|Confirmar)/i });
  await confirmar.first().waitFor({ timeout: 180000 });
  await confirmar.first().click();

  /*
   * Trava de partida: sem ela um clique que não pega vira quinze minutos de
   * espera por uma auditoria que nunca começou.
   */
  const comecou = await page
    .getByText(/Analisando|auditando|processando/i)
    .first()
    .waitFor({ timeout: 90000 })
    .then(() => true)
    .catch(() => linhasDeIa(marcoLog).length > 0);
  check("a auditoria começou de fato", comecou);
  if (!comecou) throw new Error("o clique não disparou a auditoria — nada a medir adiante");
  console.log("  … auditoria rodando (pode levar minutos e gasta token)");

  const veredito = page.getByText(/NÃO EMITIR|REVISAR|LIBERADO|ANÁLISE PARCIAL/i);
  await veredito.first().waitFor({ timeout: 900000 });
  check("a auditoria terminou e mostrou o veredito", true);
  await page.screenshot({ path: `${OUT}/nexo-audit-2-resultado.png`, fullPage: true });

  // --- as MESMAS asserções do portão da tela ------------------------------
  const linhas = linhasDeIa(marcoLog);
  const global = linhas.find((l) => l.includes("op=audit-global"));
  const entrada = global ? Number(/in=(\d+)/.exec(global)?.[1] ?? 0) : 0;
  check("a passada global rodou", Boolean(global));
  check(
    "o documento INTEIRO chegou na IA (A1: entrada > 60k tokens)",
    entrada > 60000,
    `in=${entrada} tokens`,
  );
  const abortadas = linhas.filter((l) => l.includes("status=FAILED"));
  check(
    "nenhuma passada da auditoria abortou",
    abortadas.length === 0,
    abortadas.map((l) => /op=([a-z-]+)/.exec(l)?.[1]).join(", "),
  );
  check(
    "a validação rodou (separa achado sólido de sugestão)",
    linhas.some((l) => l.includes("op=audit-validation") && l.includes("status=OK")),
  );

  const texto = await page.locator("body").innerText();
  for (const identidade of IDENTIDADES_ERRADAS) {
    check(
      `achou a identidade reaproveitada "${identidade}"`,
      texto.toLowerCase().includes(identidade.toLowerCase()),
    );
  }

  check("nenhum erro de runtime no console", erros.length === 0, erros[0] ?? "");

  const gasto = linhas.reduce((s, l) => s + Number(/total=(\d+)/.exec(l)?.[1] ?? 0), 0);
  console.log(`\n  custo desta rodada: ${gasto} tokens em ${linhas.length} chamadas`);
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e);
  await page.screenshot({ path: `${OUT}/nexo-audit-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
