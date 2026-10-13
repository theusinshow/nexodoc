/**
 * PROVA DO MEMORIAL SEM CAPA NO NAVEGADOR (13/10/2026) — sem token.
 *
 *   node scripts/prova-memorial-sem-capa.mjs     (build de produção na porta 3000)
 *
 * O passo 4 da Task 10 do plano `2026-10-09-memorial-sem-capa.md`, com os PDFs
 * do 040-26 e o projeto `040-26` do banco de dev. Três conversas, cada uma num
 * navegador limpo:
 *
 * 1. a disciplina sozinha (`040_26_est_md_a.pdf`): a ficha diz "a capa vem no
 *    geral" nas linhas vazias, "do texto — confira" na obra e avisa o 125-23 do
 *    rodapé; preencher o município grava "usuario" no projeto;
 * 2. o geral (`040_26_md_geral_a.pdf`): a capa grava no projeto, a auditoria
 *    semeada com a obra do rodapé diverge e o Nexo diz isso no fio;
 * 3. a disciplina de novo: a obra vem "do projeto".
 *
 * Pré-requisito: a auditoria `prova-sem-capa-0001` (COMPLETED, report.obra
 * "Feira Comercial de Chapecó") semeada no projeto 040-26 do `nexodoc_dev`.
 * A rota grava no projeto: restaure `name`, `client`, `clientKey` e
 * `identidade` depois.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { entrarSemTela, pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3000";
const SAIDA = process.env.NEXODOC_PROVA_SAIDA ?? path.join(process.cwd(), "tmp", "prova-memorial-sem-capa");
const PROJETO = process.env.NEXODOC_PROVA_PROJETO ?? "cmt2xkihn0007ksetqz0ezvqe";
const AUDITORIA = "prova-sem-capa-0001";
const DISCIPLINA = "docs/samples/040-26/estrutural_concreto/040_26_est_md_a.pdf";
const GERAL = "docs/samples/040-26/1_memorial/040_26_md_geral_a.pdf";
fs.mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const confere = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FALHOU"}  ${msg}`);
  if (!ok) falhas++;
};

/** As rotas que gastam modelo. A classificação do anexo e o `audit/delta` são determinísticos. */
const GASTA = /\/api\/(audit(?!\/delta)|nexo\/agent|nexo\/parecer|nexo\/selo-check|nexo\/check)/;

const browser = await chromium.launch();

async function conversaNova(nome, arquivo) {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await entrarSemTela(contexto, BASE);
  const page = await contexto.newPage();
  await pularTourGuiado(page);
  const erros = [];
  const gastos = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  page.on("request", (r) => {
    if (GASTA.test(r.url())) gastos.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  await page.goto(`${BASE}/nexo?intencao=auditar`);
  await page.waitForSelector(".nx-zona", { timeout: 30_000 });
  await page.locator('input[type=file][accept="application/pdf,image/*"]').first().setInputFiles(arquivo);
  await page.waitForSelector(".nx-ficha", { timeout: 120_000 });
  // O vínculo com o projeto (e a gravação da capa) corre depois da ficha.
  await page.waitForTimeout(5000);
  console.log(`\n${nome}:`);
  return { contexto, page, erros, gastos };
}

const identidade = (page) =>
  page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}/identidade`)).json()).identidade, PROJETO);

const linha = (page, campo) => page.locator(`.nx-ficha-linha[data-campo="${campo}"]`).last();

/* ---------------------------------------------- 1. a disciplina sozinha ---- */
{
  const { contexto, page, erros, gastos } = await conversaNova("1. Disciplina sem capa", DISCIPLINA);
  const vazias = await page.locator(".nx-ficha-vazio").allTextContents();
  confere(vazias.length > 0 && vazias.every((t) => t.includes("a capa vem no geral")), `linhas vazias dizem "a capa vem no geral" (${vazias.length})`);
  confere((await linha(page, "obra").locator(".nx-ficha-procedencia").textContent().catch(() => "")) === "do texto — confira", 'a obra vem "do texto — confira"');
  const aviso = (await page.locator(".nx-ficha-aviso").last().textContent().catch(() => "")) ?? "";
  confere(aviso.includes("125-23"), `a ficha avisa o código do rodapé: ${aviso.trim()}`);
  await page.screenshot({ path: path.join(SAIDA, "1-ficha-sem-capa.png") });

  await linha(page, "municipio").getByRole("button", { name: /(Preencher|Corrigir) município/ }).click();
  await page.getByRole("textbox", { name: "Município correto" }).fill("Chapecó");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  confere((await linha(page, "municipio").locator(".nx-ficha-corrigido").textContent().catch(() => "")) === "você preencheu", 'o município diz "você preencheu"');
  const id1 = await identidade(page);
  confere(id1?.campos?.municipio?.origem === "usuario", `o projeto guardou o município como do usuário (${JSON.stringify(id1?.campos?.municipio)})`);
  await page.screenshot({ path: path.join(SAIDA, "2-municipio-preenchido.png") });
  confere(gastos.length === 0, `nenhuma chamada de IA${gastos.length ? `: ${gastos.join(", ")}` : ""}`);
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros[0]}` : ""}`);
  await contexto.close();
}

/* ---------------------------------------------- 2. o geral chega ---- */
{
  const { contexto, page, erros, gastos } = await conversaNova("2. O memorial geral", GERAL);
  const fala = page.getByText(/A capa do geral diz/).first();
  await fala.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  const texto = (await fala.textContent().catch(() => "")) ?? "";
  confere(texto.includes("Feira Comercial de Chapecó"), `o Nexo diz que a auditoria foi feita com outra obra: ${texto.trim().slice(0, 200)}`);
  const id2 = await identidade(page);
  confere(id2?.campos?.obra?.origem === "capa", `a obra do projeto vem da capa: ${id2?.campos?.obra?.valor}`);
  confere(id2?.conferencias?.[AUDITORIA]?.estado === "diverge", `a auditoria semeada ficou "diverge" (${id2?.conferencias?.[AUDITORIA]?.estado})`);
  // Capa vence e avisa: o cliente cadastrado (IÇARA no dev) vira o da capa.
  const cliente = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`)).json()).project?.client, PROJETO);
  confere(/CHAPEC/i.test(cliente ?? ""), `o cliente do projeto vem da capa: ${cliente}`);
  await fala.scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: path.join(SAIDA, "3-geral-diverge.png") });
  confere(gastos.length === 0, `nenhuma chamada de IA${gastos.length ? `: ${gastos.join(", ")}` : ""}`);
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros[0]}` : ""}`);
  await contexto.close();
}

/* ---------------------------------------------- 3. a disciplina de novo ---- */
{
  const { contexto, page, erros, gastos } = await conversaNova("3. Disciplina com o projeto conhecido", DISCIPLINA);
  // A escada pede o projeto ao classificar: a ficha já nasce com ele.
  const obra = (await linha(page, "obra").locator(".nx-ficha-valor").textContent().catch(() => "")) ?? "";
  const procedencia = await linha(page, "obra").locator(".nx-ficha-procedencia").textContent().catch(() => "");
  confere(procedencia === "do projeto", `a obra vem "do projeto" (${procedencia}): ${obra}`);
  confere(/FEIRA MUNICIPAL/i.test(obra), "e é a obra da capa do geral");
  await page.screenshot({ path: path.join(SAIDA, "4-disciplina-do-projeto.png") });
  confere(gastos.length === 0, `nenhuma chamada de IA${gastos.length ? `: ${gastos.join(", ")}` : ""}`);
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros[0]}` : ""}`);
  await contexto.close();
}

await browser.close();
console.log(falhas ? `\n${falhas} falha(s). Fotos em ${SAIDA}` : `\nTudo certo. Fotos em ${SAIDA}`);
process.exit(falhas ? 1 : 0);
