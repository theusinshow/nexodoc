// Reauditar mostra o parecer NOVO, e diz o que mudou.
//
//   node scripts/prova-reauditoria.mjs   (== npm run prova:reauditoria)
//
// O DEFEITO QUE ISTO TRAVA
//
// `saveResult` ACRESCENTA um artefato por auditoria, sem substituir o anterior
// — o que está certo, porque o histórico da conversa é o histórico. Mas o palco
// escolhia com `results.find(...)`, que devolve o PRIMEIRO. Reauditar um
// memorial corrigido gravava o parecer novo e a tela continuava exibindo o
// velho.
//
// Reproduzido antes do conserto: duas auditorias semeadas na mesma conversa, a
// velha com cinco achados e a nova com dois. A tela mostrava os cinco. Pior que
// invisível — a tela afirmava com confiança o resultado errado, e quem
// corrigisse o memorial concluiria que a correção não adiantou nada.
//
// Sem token: os dois pareceres são semeados no IndexedDB.
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
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
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

  /*
   * OS DOIS PARECERES SE SOBREPÕEM DE PROPÓSITO. A auditoria velha tem quatro
   * achados; a nova mantém dois deles (mesmo tipo e mesmo trecho, em páginas
   * diferentes — a paginação anda quando o memorial é corrigido) e traz um
   * inédito. Assim o diff tem de dizer as três coisas: 2 saíram, 1 novo, 2
   * continuam. Um par sem sobreposição deixaria a chave de comparação passar
   * mesmo se ela fosse ingênua.
   *
   * A VELHA é gravada com `generatedAt` MAIOR e em segundo lugar no vetor: é a
   * armadilha do teste. Se o palco voltar a escolher por posição, ele pega a
   * primeira; se escolher pelo carimbo errado, pega a velha. Só acertar os dois
   * critérios passa.
   */
  await page.evaluate(async () => {
    const convId = "qa-reauditoria";
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const inc = (n, tipo, evidencia, pagina) => ({
      id: `INC-${String(n).padStart(3, "0")}`,
      prioridade: "Media",
      pagina: String(pagina),
      capitulo: "",
      local: "",
      tipo,
      descricao: "d",
      evidencia,
      conflito: "c",
      sugestao_correcao: "s",
      confianca: "alta",
      origem: "ia",
      impacto: "tecnico_contratual",
    });
    const parecer = (incongruencias) => ({
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
    });

    const velha = parecer([
      inc(1, "Reservatorio divergente", "o reservatorio tem 10 m3", 40),
      inc(2, "Norma desatualizada", "conforme NBR 5410 de 2004", 12),
      inc(3, "Grafia", "instalacoes eletrcias", 8),
      inc(4, "Bancada divergente", "bancada em marmore", 22),
    ]);
    // Corrigidos: "Grafia" e "Bancada divergente". Persistem os dois primeiros,
    // agora em outras páginas. E entra um inédito.
    const nova = parecer([
      inc(1, "Reservatorio divergente", "o reservatorio tem 10 m3", 38),
      inc(2, "Norma desatualizada", "conforme NBR 5410 de 2004", 11),
      inc(3, "Hidrante sem vazao", "hidrante sem vazao declarada", 30),
    ]);

    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA REAUDITORIA",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:v2",
            kind: "auditoria",
            summary: "Auditoria nova",
            files: [],
            generatedAt: agora,
            payload: { auditId: "aud-v2", texto: "PARECER NOVO", report: nova },
          },
          {
            artifactId: "auditoria:v1",
            kind: "auditoria",
            summary: "Auditoria velha",
            files: [],
            generatedAt: agora - 600000,
            payload: { auditId: "aud-v1", texto: "PARECER VELHO", report: velha },
          },
        ],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("QA REAUDITORIA", { exact: false }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const chip = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chip.count()) > 0) await chip.first().click();
  await page.waitForTimeout(1200);

  // --- 1. o palco mostra a auditoria MAIS RECENTE -------------------------
  const abaAchados = page.getByRole("button", { name: /^Achados/i }).first();
  await abaAchados.click();
  await page.waitForTimeout(1500);

  const titulos = await page.locator("[data-achado] h4").allInnerTexts();
  check("mostra os achados do parecer NOVO", titulos.length === 3, `${titulos.length}: ${titulos}`);
  check(
    "e não os do velho",
    !titulos.some((t) => /Grafia|Bancada/i.test(t)),
    titulos.join(" | "),
  );
  check(
    "o achado inédito da nova rodada está na tela",
    titulos.some((t) => /Hidrante/i.test(t)),
    titulos.join(" | "),
  );
  await page.screenshot({ path: `${OUT}/reauditoria-1-parecer-novo.png` });

  // --- 2. e diz o que mudou -----------------------------------------------
  const faixa = page.locator("[data-diff-do-parecer]");
  check("a faixa de comparação existe", (await faixa.count()) > 0);
  const texto = (await faixa.first().innerText().catch(() => "")).trim();
  check("diz quantos saíram", /2 achados sa/i.test(texto), texto);
  check("diz quantos são novos", /1 achado novo/i.test(texto), texto);
  check("diz quantos continuam de pé", /2 continuam de p/i.test(texto), texto);

  // --- 3. numa auditoria só, a faixa não existe ---------------------------
  /*
   * Comparar com o nada produziria "3 achados novos" numa primeira auditoria —
   * um dado verdadeiro e inútil, ocupando a barra com cara de novidade.
   */
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const conv = await new Promise((res, rej) => {
      const req = db.transaction("conversations").objectStore("conversations").get("qa-reauditoria");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    conv.results = conv.results.filter((r) => r.artifactId === "auditoria:v2");
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put(conv);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("QA REAUDITORIA", { exact: false }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const chip2 = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chip2.count()) > 0) await chip2.first().click();
  await page.waitForTimeout(1500);
  check(
    "com uma auditoria só, não há faixa de comparação",
    (await page.locator("[data-diff-do-parecer]").count()) === 0,
  );
  await page.screenshot({ path: `${OUT}/reauditoria-2-sem-anterior.png` });

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/reauditoria-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
