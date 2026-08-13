// O visor de PDF do parecer: navegação e zoom.
//
//   node scripts/prova-visor-do-pdf.mjs   (== npm run prova:visor-do-pdf)
//
// O QUE ESTAVA FALTANDO, MEDIDO ANTES DE CONSTRUIR
//
// O visor já abria a página exata do achado, grifava o trecho e trazia a régua
// de pins na margem. O que ele não tinha era o documento: os únicos destinos
// eram os pins, um por achado. Medido num memorial de 12 páginas com 3 achados,
// NOVE PÁGINAS ERAM INALCANÇÁVEIS — e conferir um achado é quase sempre ler o
// parágrafo anterior, que mora na folha anterior.
//
// A página também era fixa em 520px de largura, sem zoom: enquadramento que
// responde "onde está o trecho" e não responde "o que ele diz".
//
// O memorial desta prova é gerado com pdf-lib, em memória: doze páginas de
// texto de verdade, três com achado. Sem amostra confidencial e sem token.
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

const PAGINAS = 12;
const PAGINAS_COM_ACHADO = [3, 7, 11];
// Uma folha SEM achado nenhum: é ela que o visor antigo não alcançava.
const PAGINA_ORFA = 5;

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// --- o memorial de mentira --------------------------------------------------
const doc = await PDFDocument.create();
const fonte = await doc.embedFont(StandardFonts.Helvetica);
for (let p = 1; p <= PAGINAS; p++) {
  const pagina = doc.addPage([595, 842]);
  pagina.drawText("12 - INSTALACOES ELETRICAS", { x: 60, y: 780, size: 14, font: fonte });
  pagina.drawText(`Pagina ${p} do memorial de teste`, { x: 60, y: 750, size: 11, font: fonte });
  for (let l = 0; l < 28; l++) {
    pagina.drawText(`linha ${l} da pagina ${p} com texto de corpo dez`, {
      x: 60,
      y: 710 - l * 20,
      size: 10,
      font: fonte,
    });
  }
  pagina.drawText(`trecho de conferencia ${p}`, { x: 60, y: 90, size: 10, font: fonte });
}
const pdfB64 = Buffer.from(await doc.save()).toString("base64");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

/** A caixa da página desenhada, que é o que o zoom move. */
const larguraDoCanvas = () =>
  page.evaluate(() => {
    const c = document.querySelector(".react-pdf__Page canvas");
    return c ? Math.round(c.getBoundingClientRect().width) : 0;
  });

const paginaNoTopo = async () =>
  (await page.locator(".fixed.inset-y-0.right-0 p").first().innerText()).trim();

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(1500);

  await page.evaluate(
    async ({ pdfB64, paginasComAchado }) => {
      const convId = "qa-visor-do-pdf";
      const bytes = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("result_blobs", "readwrite");
        tx.objectStore("result_blobs").put({ key: `${convId}:memorial`, blob });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      const agora = Date.now();
      const incongruencias = paginasComAchado.map((p, i) => ({
        id: `INC-00${i + 1}`,
        prioridade: "Media",
        pagina: String(p),
        capitulo: "",
        local: "",
        tipo: "Redação / editorial",
        descricao: "Achado semeado.",
        evidencia: `trecho de conferencia ${p}`,
        termo_busca: `trecho de conferencia ${p}`,
        conflito: "Diverge.",
        sugestao_correcao: "Corrigir.",
        confianca: "alta",
        origem: "ia",
        impacto: "revisao_editorial",
      }));
      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: "QA VISOR DO PDF",
          createdAt: agora,
          updatedAt: agora,
          messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
          seloResults: [],
          results: [
            {
              artifactId: "auditoria:qa-visor-do-pdf",
              kind: "auditoria",
              summary: "Auditoria",
              files: [],
              payload: {
                auditId: "qa-visor-do-pdf",
                texto: "RESULTADO",
                report: {
                  tipo_auditoria: "memorial",
                  tipo_documento: "memorial descritivo",
                  obra: "QA",
                  codigo: "000-00",
                  municipio: "",
                  data_documento: "",
                  status_analise: "concluida",
                  status_geral: "com pontos de revisão",
                  total_incongruencias: incongruencias.length,
                  arquivos_analisados: [],
                  comparacoes: [],
                  conclusao: ".",
                  incongruencias,
                },
              },
            },
          ],
          memorial: { name: "memorial-qa.pdf", blobKey: `${convId}:memorial` },
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    { pdfB64, paginasComAchado: PAGINAS_COM_ACHADO },
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("QA VISOR DO PDF", { exact: false }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  const chip = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chip.count()) > 0) await chip.first().click();
  const abaAchados = page.getByRole("button", { name: /^Achados/i }).first();
  if ((await abaAchados.count()) > 0) await abaAchados.click();
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: /VER NO DOCUMENTO/i }).first().click();
  await page.waitForTimeout(4000);

  // --- 1. o que já funcionava, e continua ---------------------------------
  check(
    "abre na página do achado",
    /3/.test(await paginaNoTopo()),
    await paginaNoTopo(),
  );
  check(
    "o trecho continua grifado",
    (await page.locator(".react-pdf__Page mark").count()) > 0,
  );
  check("o documento tem 12 páginas e o visor sabe", await page.getByText(/de 12/).count() > 0);
  await page.screenshot({ path: `${OUT}/visor-1-abre-no-achado.png` });

  // --- 2. a folha órfã, que era inalcançável ------------------------------
  /*
   * A página 5 não tem achado, logo não tem pin. Antes desta etapa não havia
   * caminho até ela: era o documento reduzido às suas três folhas defeituosas.
   */
  // `getByLabel` casaria também nos pins da margem ("Ir para a página 7: ..."),
  // que são botões. O seletor pelo nome do campo é o que aponta só para ele.
  const campo = page.locator('input[name="pagina"]');
  await campo.fill(String(PAGINA_ORFA));
  await campo.press("Enter");
  await page.waitForTimeout(2500);
  check(
    `chega à página ${PAGINA_ORFA}, que não tem achado`,
    new RegExp(`\\b${PAGINA_ORFA}\\b`).test(await paginaNoTopo()),
    await paginaNoTopo(),
  );

  // --- 3. as setas, para o parágrafo de antes -----------------------------
  await page.getByLabel("Página anterior").click();
  await page.waitForTimeout(2000);
  check(
    "a seta anterior recua uma folha",
    new RegExp(`\\b${PAGINA_ORFA - 1}\\b`).test(await paginaNoTopo()),
    await paginaNoTopo(),
  );
  await page.getByLabel("Próxima página").click();
  await page.waitForTimeout(2000);
  check(
    "a seta seguinte avança uma folha",
    new RegExp(`\\b${PAGINA_ORFA}\\b`).test(await paginaNoTopo()),
    await paginaNoTopo(),
  );

  // --- 4. as bordas do documento ------------------------------------------
  await campo.fill("1");
  await campo.press("Enter");
  await page.waitForTimeout(2000);
  check(
    "na primeira folha, o recuo fica desabilitado",
    await page.getByLabel("Página anterior").isDisabled(),
  );
  await campo.fill("999");
  await campo.press("Enter");
  await page.waitForTimeout(2500);
  check(
    "página além do fim é presa na última, não estoura",
    /\b12\b/.test(await paginaNoTopo()),
    await paginaNoTopo(),
  );
  check(
    "na última folha, o avanço fica desabilitado",
    await page.getByLabel("Próxima página").isDisabled(),
  );

  // --- 5. o zoom muda a página, e não só o rótulo -------------------------
  /*
   * O que se mede é a CAIXA do canvas. Um zoom que só troca o número no botão
   * passaria em qualquer asserção de texto — e é o defeito mais provável aqui,
   * porque a largura é uma prop que atravessa três componentes.
   */
  const base = await larguraDoCanvas();
  await page.getByLabel("Aumentar zoom").click();
  await page.waitForTimeout(2500);
  const maior = await larguraDoCanvas();
  check("aumentar zoom aumenta a página desenhada", maior > base, `${base} -> ${maior}`);

  await page.getByLabel("Diminuir zoom").click();
  await page.waitForTimeout(2500);
  check("diminuir zoom volta ao tamanho anterior", (await larguraDoCanvas()) === base);

  await page.getByLabel("Aumentar zoom").click();
  await page.waitForTimeout(1500);
  await page.getByLabel("Zoom de 100%").click();
  await page.waitForTimeout(2500);
  check("clicar no número volta a 100%", (await larguraDoCanvas()) === base);

  // --- 6. o zoom sobrevive à troca de página ------------------------------
  await page.getByLabel("Aumentar zoom").click();
  await page.waitForTimeout(1500);
  const ampliado = await larguraDoCanvas();
  await campo.fill("4");
  await campo.press("Enter");
  await page.waitForTimeout(2500);
  check(
    "trocar de página não desfaz o zoom",
    (await larguraDoCanvas()) === ampliado,
    `esperado ${ampliado}`,
  );
  await page.screenshot({ path: `${OUT}/visor-2-zoom-e-navegacao.png` });

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/visor-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
