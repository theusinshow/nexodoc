// Quanto custa a auditoria visual numa auditoria DE VERDADE?
//
// O portão do canvas prova 5 páginas. Uma auditoria real do 017_26 rende ~30
// achados espalhados pelo documento, e hoje CADA página com achado monta seu
// próprio <Document> do react-pdf sobre o mesmo PDF de 3,8 MB. Este script mede
// o que isso cobra: tempo até a última miniatura, memória do heap e quantos pins
// sobreviveram.
//
// Os trechos NÃO são inventados: para cada página escolhida, o pdfjs extrai aqui
// no node uma linha real do documento e ela vira a evidência do achado semeado.
// Assim o custo medido inclui o trabalho verdadeiro (render + camada de texto +
// locateTermOnPage), não uma casca.
//
//   node scripts/shot-audit-canvas-escala.mjs [quantas=30]
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NEXO - TESTES\\Memoriais\\017_26_md_geral_c_assinado.pdf";
const QUANTAS = Number.parseInt(process.argv[2] ?? "30", 10);

fs.mkdirSync(OUT, { recursive: true });

// --- Monta os casos a partir do documento real -------------------------------
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const bytes = fs.readFileSync(MEMORIAL);
const doc = await pdfjs.getDocument({
  data: new Uint8Array(bytes),
  disableWorker: true,
}).promise;

const passo = Math.max(1, Math.floor(doc.numPages / QUANTAS));
const casos = [];
for (let p = 1; p <= doc.numPages && casos.length < QUANTAS; p += passo) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  // A linha mais longa da página: é a que tem cara de texto corrido, não de
  // cabeçalho ou número solto.
  const linha = content.items
    .filter((i) => "str" in i)
    .map((i) => i.str.trim())
    .filter((s) => s.length >= 25)
    .sort((a, b) => b.length - a.length)[0];
  if (linha) casos.push({ pagina: String(p), evidencia: linha.slice(0, 80) });
}
await doc.destroy();

console.log(`\n${casos.length} páginas de ${doc.numPages}, uma a cada ${passo}\n`);

const pdfB64 = bytes.toString("base64");
const nomeDoPdf = MEMORIAL.split(/[\\/]/).pop();

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
  await page.waitForTimeout(1500);

  await page.evaluate(
    async ({ pdfB64, nomeDoPdf, casos }) => {
      const convId = "qa-canvas-escala";
      const bin = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bin], { type: "application/pdf" });
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
      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: "QA — escala do canvas",
          createdAt: agora,
          updatedAt: agora,
          messages: [
            { id: "m1", role: "user", content: `Anexei o memorial — ${nomeDoPdf}` },
            { id: "m2", role: "assistant", content: "Auditoria concluída." },
          ],
          seloResults: [],
          results: [
            {
              artifactId: "auditoria:escala",
              kind: "auditoria",
              summary: "Auditoria do memorial",
              files: [],
              payload: {
                auditId: "qa-escala",
                texto: "RESULTADO DA AUDITORIA",
                report: {
                  tipo_auditoria: "memorial",
                  tipo_documento: "memorial descritivo",
                  obra: "Centro Comunitário Primeira Linha",
                  codigo: "017-26",
                  municipio: "Criciúma",
                  data_documento: "",
                  status_analise: "concluida",
                  status_geral: "com pontos de revisão",
                  total_incongruencias: casos.length,
                  arquivos_analisados: [],
                  comparacoes: [],
                  conclusao: "Parecer semeado para medir escala.",
                  incongruencias: casos.map((c, i) => ({
                    id: `E${i + 1}`,
                    prioridade: "Media",
                    pagina: c.pagina,
                    capitulo: "",
                    local: "",
                    // Tipos diferentes de propósito: agrupar por recorrência
                    // reduziria o número de nós e falsearia a medição.
                    tipo: `Ponto a conferir ${i + 1}`,
                    descricao: "",
                    evidencia: c.evidencia,
                    conflito: "",
                    sugestao_correcao: "",
                    confianca: "alta",
                    origem: "ia",
                  })),
                },
              },
            },
          ],
          memorial: { name: nomeDoPdf, blobKey: `${convId}:memorial` },
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    { pdfB64, nomeDoPdf, casos },
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const item = page.locator("aside button, [class*=sidebar] button").filter({
    hasText: /escala do canvas/i,
  });
  if ((await item.count()) > 0) {
    await item.first().click();
    await page.waitForTimeout(2500);
  }
  const chipAuditoria = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chipAuditoria.count()) > 0) {
    await chipAuditoria.first().click();
    await page.waitForTimeout(1000);
  }

  /*
   * Memória pelo CDP, não por `performance.memory`: o valor exposto à página é
   * arredondado por segurança e devolvia o MESMO número antes e depois de
   * montar 30 PDFs — uma medição que não mede.
   */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  const heapAgora = async () => {
    const { metrics } = await cdp.send("Performance.getMetrics");
    return metrics.find((m) => m.name === "JSHeapUsedSize")?.value ?? 0;
  };
  const heapAntes = await heapAgora();

  // O cronômetro começa no clique: é o que o engenheiro espera olhando a tela.
  const t0 = Date.now();
  await page.getByRole("button", { name: /No documento/i }).first().click();

  const canvases = page.locator("canvas.react-pdf__Page__canvas");
  let prontas = 0;
  let estagnado = 0;
  while (Date.now() - t0 < 120000) {
    const agora = await canvases.count();
    if (agora >= casos.length) {
      prontas = agora;
      break;
    }
    estagnado = agora === prontas ? estagnado + 1 : 0;
    prontas = agora;
    // 12 sondagens seguidas sem avançar = parou de progredir.
    if (estagnado >= 12) break;
    await page.waitForTimeout(500);
  }
  const decorrido = Date.now() - t0;

  await page.waitForTimeout(2000);
  const heapDepois = await heapAgora();
  const pins = await page.locator("[data-pin]").count();
  await page.screenshot({ path: `${OUT}/e1-escala-${casos.length}.png` });

  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  console.log(`\n  páginas pedidas ....... ${casos.length}`);
  console.log(`  miniaturas prontas .... ${prontas}`);
  console.log(`  tempo até a última .... ${(decorrido / 1000).toFixed(1)}s`);
  console.log(`  pins ancorados ........ ${pins}`);
  console.log(`  heap antes/depois ..... ${mb(heapAntes)} → ${mb(heapDepois)}\n`);

  /*
   * A vista tem de ENQUADRAR o que mostra. Com 4 colunas fixas, 122 páginas
   * viravam uma torre de 31 linhas e o `fitView` batia no `minZoom` sem caber —
   * o mesmo defeito que a grade das folhas já tinha resolvido.
   */
  const foraDoQuadro = await page.evaluate(() => {
    const painel = document.querySelector(".react-flow");
    if (!painel) return -1;
    const q = painel.getBoundingClientRect();
    return [...document.querySelectorAll(".react-flow__node")].filter((n) => {
      const r = n.getBoundingClientRect();
      return r.left < q.left - 2 || r.right > q.right + 2 || r.top < q.top - 2 || r.bottom > q.bottom + 2;
    }).length;
  });

  check("toda página com achado virou miniatura", prontas >= casos.length, `${prontas}`);
  check("a vista enquadra todas as páginas", foraDoQuadro === 0, `${foraDoQuadro} fora do quadro`);
  // 15s é o teto do tolerável para uma vista que se abre num clique.
  check("a vista abre em menos de 15s", decorrido < 15000, `${(decorrido / 1000).toFixed(1)}s`);
  check("a aba não estourou o heap (< 1,5 GB)", heapDepois < 1.5 * 1024 * 1024 * 1024, mb(heapDepois));
  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/e-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
