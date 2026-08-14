// O memorial sobrevive à troca de conversa e ao F5 — sem gastar token.
//
// Anexa o memorial, troca de conversa e volta: o cartão de auditoria tem que
// continuar sabendo qual arquivo auditar. Antes, os arquivos de entrada eram
// todos efêmeros, então a conversa restaurada mostrava "arraste o PDF do
// memorial →" — e o veredito parcial mandava "rode de novo" sem que houvesse
// como obedecer.
//
// Não dispara auditoria nenhuma: só a leitura das primeiras páginas (classify),
// que não passa pelo modelo de auditoria.
//
//   node scripts/shot-audit-memorial-retido.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NexoDoc\\NEXO - TESTES\\Memoriais\\017_26_md_geral_c_assinado.pdf";

fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  const nova = page.getByRole("button", { name: /Nova conversa/i });
  if ((await nova.count()) > 0) await nova.first().click();
  await page.waitForTimeout(1200);

  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(MEMORIAL);
  await page.getByText(/memorial descritivo/i).first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);

  // Pede a proposta de auditoria (não confirma — não gasta token de auditoria).
  await page.getByRole("button", { name: /Auditar o memorial/i }).first().click();
  await page.getByRole("button", { name: /^(Auditar|Rodar)/i }).first().waitFor({ timeout: 180000 });
  await page.waitForTimeout(800);
  const antes = await page.locator("body").innerText();
  check("o cartão sabe o arquivo antes do F5", /017_26_md_geral_c/i.test(antes));

  // O F5.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Reabre a conversa pela sidebar (é o caminho de quem volta).
  const item = page.locator("aside button, [class*=sidebar] button").filter({
    hasText: /memorial|Centro Comunit/i,
  });
  if ((await item.count()) > 0) {
    await item.first().click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: `${OUT}/z1-memorial-retido.png` });

  const depois = await page.locator("body").innerText();
  check(
    "o memorial voltou com a conversa",
    /017_26_md_geral_c/i.test(depois) && !/arraste o PDF do memorial/i.test(depois),
    depois.slice(0, 220),
  );
  // Reter os bytes sem os FATOS devolveria um "Auditar" de gabarito vazio — a
  // auditoria rodaria comparando o documento consigo mesmo.
  check(
    "o gabarito voltou junto",
    /Centro Comunitário Primeira Linha/i.test(depois) &&
      /PREFEITURA MUNICIPAL DE CRICI/i.test(depois),
  );
  check(
    "o botão de auditar está utilizável",
    (await page.getByRole("button", { name: /^(Auditar|Rodar)/i }).count()) > 0,
  );
  const desabilitado = await page
    .getByRole("button", { name: /^(Auditar|Rodar)/i })
    .first()
    .isDisabled()
    .catch(() => true);
  check("e não está desabilitado por falta de arquivo", !desabilitado);

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/z-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
