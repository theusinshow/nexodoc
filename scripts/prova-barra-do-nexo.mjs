// A barra do topo do Nexo — prova de tela, sem gastar um token.
//
// O que ela mede, e por que assim:
//
//  - a barra NÃO EXISTE em conversa nova. É o estado vazio decidido no spec:
//    sem obra lida e sem auditoria, nada renderiza e o palco fica com a altura
//    inteira. Provar ausência é tão importante quanto provar presença — o
//    defeito que esta barra veio corrigir era justamente uma faixa ocupando
//    altura sem dizer nada;
//  - a camada de REPOUSO aparece com a obra do carimbo, semeada no IndexedDB
//    como as outras provas fazem. Nenhuma chamada de modelo;
//  - a CAIXA é medida contra a janela. Asserção de DOM passa verde com o
//    elemento fora da tela, e este repo já pagou por isso;
//  - o cabeçalho do AppShell sumiu de /nexo mas CONTINUA em /volumes. É a
//    regressão de verdade desta mudança: `fullBleed` é a condição, e errar o
//    sinal apagaria o cabeçalho do produto inteiro.
//
// FORA DESTA PROVA, de propósito: a camada de TRABALHO (auditoria em curso) e o
// não-vazamento entre conversas. Ambas dependem do `emCurso`, que é estado em
// memória do React — não há como semeá-lo de fora, e encená-lo de verdade custa
// uma auditoria paga por rodada. A regra dessas duas está coberta em node:
// `test:nexo:resumo-auditoria` prova a linha da etapa, e o filtro por conversa
// é `auditoriaDaConversa`, uma comparação de igualdade no store.
//
//   node scripts/prova-barra-do-nexo.mjs   (== npm run prova:barra-do-nexo)
import { chromium } from "playwright";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
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
  await page.waitForTimeout(2000);

  // --- 1. conversa nova: a barra não existe --------------------------------
  const antes = await page.locator(".nexo-barra").count();
  check("conversa nova: a barra não está no DOM", antes === 0, `count=${antes}`);

  // E a linha do grid não pode cobrar espaço por uma faixa que não está lá.
  const vaoDoTopo = await page.evaluate(() => {
    const shell = document.querySelector(".nexo-shell");
    const primeiro = shell?.querySelector(".nexo-shell__sidebar");
    if (!shell || !primeiro) return null;
    return primeiro.getBoundingClientRect().top - shell.getBoundingClientRect().top;
  });
  check(
    "sem barra, a lateral encosta no topo do shell",
    vaoDoTopo !== null && vaoDoTopo < 4,
    `vão=${vaoDoTopo}px`,
  );
  await page.screenshot({ path: `${OUT}/barra-1-ausente.png` });

  // --- 2. semeia uma conversa com selos lidos ------------------------------
  const convId = await page.evaluate(async () => {
    const convId = "qa-barra-do-nexo";
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const extraction = {
      disciplina: "ARQ",
      folha: 1,
      total: 8,
      numeroFolha: "01/08",
      arquivo: "063-26-ARQ-01",
      conteudo: "PLANTA BAIXA",
      cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ",
      secretaria: "SECRETARIA DE OBRAS",
      obra: "CRECHE JARDIM MARISTELA",
      fase: "PROJETO EXECUTIVO",
      tituloSecao: null,
      data: "08/2026",
      logoOrgao: "PREFEITURA MUNICIPAL DE CHAPECÓ",
      confianca: "alta",
    };
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "CRECHE JARDIM MARISTELA",
        createdAt: agora,
        updatedAt: agora,
        messages: [],
        seloResults: [
          { fileName: "063-26-ARQ-01.pdf", pageNumber: 1, pageCount: 1, extraction },
        ],
        results: [],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return convId;
  });
  console.log(`       conversa semeada: ${convId}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  // Abre a conversa semeada pela lateral.
  await page
    .getByText("CRECHE JARDIM MARISTELA", { exact: false })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(1500);

  // --- 3. camada de repouso -----------------------------------------------
  const repouso = page.locator('.nexo-barra[data-camada="repouso"]');
  await repouso.first().waitFor({ timeout: 15000 });
  check("a barra nasce na camada de repouso", (await repouso.count()) > 0);

  const texto = await repouso.first().innerText();
  check("mostra a obra do carimbo", /CRECHE JARDIM MARISTELA/i.test(texto), texto);
  check("mostra o órgão", /CHAPEC/i.test(texto), texto);
  check("mostra o código da obra", /063-26/.test(texto), texto);
  await page.screenshot({ path: `${OUT}/barra-2-repouso.png` });

  // --- 4. a caixa, contra a janela ----------------------------------------
  /*
   * Asserção de DOM passa verde com o painel fora da tela. O que prova que a
   * barra APARECE é a caixa dela caber na janela.
   */
  const caixa = await repouso.first().boundingBox();
  const janela = page.viewportSize();
  check("a barra tem caixa", Boolean(caixa));
  if (caixa) {
    check(
      "a barra está dentro da janela",
      caixa.y >= 0 && caixa.y + caixa.height <= janela.height,
      `y=${caixa.y} h=${caixa.height} janela=${janela.height}`,
    );
    check(
      "a barra atravessa a largura do shell",
      caixa.width > janela.width * 0.5,
      `largura=${caixa.width} de ${janela.width}`,
    );
    check(
      "a barra está no topo, não no meio da tela",
      caixa.y < 120,
      `y=${caixa.y}`,
    );
  }

  // --- 5. o cabeçalho antigo sumiu, e só ele -------------------------------
  /*
   * O `AppShell` perdeu o cabeçalho de vez (tinha um consumidor só, `/nexo`, e
   * a faixa não tinha o que nem como dizer). O que esta prova cobre é o efeito
   * colateral que importaria: sumir o cabeçalho de OUTRAS telas. `/volumes`
   * nunca passou pelo AppShell — traz o próprio `ProjectContextStrip` — e é
   * isso que se confere aqui.
   */
  const headerNoNexo = await page.locator("header").count();
  check("em /nexo não há mais cabeçalho do AppShell", headerNoNexo === 0, `count=${headerNoNexo}`);

  await page.goto(`${BASE}/volumes`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const volumesIntacto = await page
    .getByText(/Projeto vinculado|Modo independente/i)
    .count();
  check(
    "/volumes segue com o próprio cabeçalho de contexto",
    volumesIntacto > 0,
    `faixa de contexto não encontrada`,
  );

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/barra-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
