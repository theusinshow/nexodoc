// A auditoria VISTA NO DOCUMENTO — e sem gastar um token.
//
// Semeia no IndexedDB uma conversa com o memorial real e um parecer cujos cinco
// achados são os erros de identidade CONFERIDOS À MÃO no 017_26 (páginas 11,
// 112, 114, 115 e 118). Abre a conversa, troca para "No documento" e exige que
// cada achado vire um pin sobre a miniatura da sua página.
//
// Nenhuma chamada de modelo: o parecer é semeado, o PDF vem do disco. O que se
// prova aqui é a FIAÇÃO — miniatura → camada de texto → locateTermOnPage → pin —
// que nenhum teste puro alcança.
//
//   node scripts/shot-audit-canvas.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NEXO - TESTES\\Memoriais\\017_26_md_geral_c_assinado.pdf";

fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// Erros reais do memorial, com a página conferida à mão. `evidencia` é o texto
// como está escrito no documento — é o que o pin tem de achar.
const ACHADOS = [
  { pagina: "11", tipo: "Nome da obra divergente", evidencia: "Cidade do Autista" },
  { pagina: "112", tipo: "Nome da obra divergente", evidencia: "Centro Dia do Idoso" },
  { pagina: "114", tipo: "Nome da obra divergente", evidencia: "Centro Dia do Idoso" },
  { pagina: "115", tipo: "Ocupação divergente", evidencia: "unidade básica de saúde" },
  { pagina: "118", tipo: "Nome da obra divergente", evidencia: "Centro Comunitário Boa Vista" },
];

const pdfB64 = fs.readFileSync(MEMORIAL).toString("base64");
const nomeDoPdf = MEMORIAL.split(/[\\/]/).pop();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(1500);

  const titulo = "QA — canvas da auditoria";
  await page.evaluate(
    async ({ pdfB64, nomeDoPdf, achados, titulo }) => {
      const convId = "qa-canvas-auditoria";
      const bytes = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });

      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo", 1);
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
      const report = {
        tipo_auditoria: "memorial",
        tipo_documento: "memorial descritivo",
        obra: "Centro Comunitário Primeira Linha",
        codigo: "017-26",
        municipio: "Criciúma",
        data_documento: "",
        status_analise: "concluida",
        status_geral: "com inconsistências críticas",
        total_incongruencias: achados.length,
        arquivos_analisados: [],
        comparacoes: [],
        conclusao: "Parecer semeado para prova de UI.",
        incongruencias: achados.map((a, i) => ({
          id: `A${i + 1}`,
          prioridade: "Alta",
          pagina: a.pagina,
          capitulo: "",
          local: "",
          tipo: a.tipo,
          descricao: "Texto reaproveitado de outro projeto.",
          evidencia: a.evidencia,
          conflito: "Diverge da obra declarada.",
          sugestao_correcao: "Corrigir para a obra deste projeto.",
          confianca: "alta",
          origem: "regra",
        })),
      };

      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: titulo,
          createdAt: agora,
          updatedAt: agora,
          /*
           * A conversa PRECISA ter mensagens: o shell só abre o palco (onde vive
           * o canvas) quando a conversa começou de fato. Uma auditoria real
           * sempre escreve no chat, então isto é fidelidade ao caminho normal,
           * não um truque.
           */
          messages: [
            { id: "m1", role: "user", content: `Anexei o memorial — ${nomeDoPdf}` },
            { id: "m2", role: "assistant", content: "Auditoria concluída." },
          ],
          seloResults: [],
          results: [
            {
              artifactId: "auditoria:qa",
              kind: "auditoria",
              summary: "Auditoria do memorial",
              files: [],
              payload: { auditId: "qa-canvas", texto: "RESULTADO DA AUDITORIA", report },
            },
          ],
          memorial: { name: nomeDoPdf, blobKey: `${convId}:memorial` },
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    { pdfB64, nomeDoPdf, achados: ACHADOS, titulo },
  );

  // Recarrega e abre a conversa semeada pela sidebar — o caminho de quem volta.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const item = page.locator("aside button, [class*=sidebar] button").filter({
    hasText: /canvas da auditoria/i,
  });
  check("a conversa semeada aparece na sidebar", (await item.count()) > 0);
  if ((await item.count()) > 0) {
    await item.first().click();
    await page.waitForTimeout(2500);
  }

  const chipAuditoria = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chipAuditoria.count()) > 0) {
    await chipAuditoria.first().click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${OUT}/c1-parecer.png` });

  const chipDoc = page.getByRole("button", { name: /No documento/i });
  check("a vista 'No documento' é oferecida", (await chipDoc.count()) > 0);
  if ((await chipDoc.count()) === 0) throw new Error("sem a vista do documento");
  await chipDoc.first().click();

  // As miniaturas são PDF de verdade: renderizar 5 páginas leva alguns segundos.
  const pins = page.locator('[aria-label*="na página"]');
  await pins.first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/c2-no-documento.png` });

  const corpo = await page.locator("body").innerText();
  check("o veredito acompanha a vista", /NÃO EMITIR/i.test(corpo), corpo.slice(0, 200));
  check("uma página por achado distinto", /5 página\(s\) com achado/i.test(corpo));

  const quantosPins = await pins.count();
  check(`os 5 achados viraram pin (achou ${quantosPins})`, quantosPins === ACHADOS.length);

  // O pin tem de estar DENTRO da miniatura: percentual fora de 0-100% põe a
  // marca fora da página, que é o mesmo que não ter pin.
  const foraDaPagina = await pins.evaluateAll((els) =>
    els.filter((el) => {
      const pai = el.parentElement?.getBoundingClientRect();
      const meu = el.getBoundingClientRect();
      if (!pai) return true;
      return (
        meu.left < pai.left - 8 ||
        meu.right > pai.right + 8 ||
        meu.top < pai.top - 8 ||
        meu.bottom > pai.bottom + 8
      );
    }).length,
  );
  check("todo pin caiu dentro da sua página", foraDaPagina === 0, `${foraDaPagina} fora`);

  // Nenhum achado pode ter sobrado sem trecho: no 017_26 os cinco ancoram.
  check("nenhum achado ficou 'sem trecho'", !/sem trecho/i.test(corpo));

  // --- Card, pilha, linha e o par que acende --------------------------------
  /*
   * "Centro Dia do Idoso" aparece nas páginas 112 e 114 com a mesma evidência:
   * é UM erro espalhado, e vira pilha. Sobram três achados soltos, com card.
   */
  const RECORRENTES = 2;
  const SOLTOS = ACHADOS.length - RECORRENTES;

  const cards = page.locator('.react-flow__node[data-id^="a-"]');
  check(`os achados soltos viraram card (achou ${await cards.count()})`, (await cards.count()) === SOLTOS);

  const pilhas = page.locator('.react-flow__node[data-id^="g-"]');
  check(`o erro repetido virou UMA pilha (achou ${await pilhas.count()})`, (await pilhas.count()) === 1);
  check("a pilha conta as ocorrências", /×2/.test(corpo), corpo.slice(0, 200));

  // 3 linhas de card + 2 linhas da pilha (uma por página onde o erro aparece).
  const linhas = page.locator(".react-flow__edge");
  check(
    `cada achado está ligado à sua página (achou ${await linhas.count()})`,
    (await linhas.count()) === SOLTOS + RECORRENTES,
  );

  // O card diz O QUÊ — sem ele a vista dependia do tooltip do pin, que some
  // quando o cursor sai.
  check("o card mostra o tipo do achado", /Ocupação divergente/i.test(corpo));

  // A opacidade vive no CARD, não no invólucro que o React Flow cria — medir o
  // invólucro dava 1 sempre, e a asserção passaria com o destaque quebrado.
  const opacidade = (loc) =>
    loc.locator("> div").first().evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));

  const primeiro = cards.first();
  const segundo = cards.nth(1);
  await primeiro.hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/c3-par-aceso.png` });
  const opAceso = await opacidade(primeiro);
  const opApagado = await opacidade(segundo);
  check("o card sob o cursor fica aceso", opAceso > 0.9, `${opAceso}`);
  check("os outros apagam", opApagado < 0.5, `${opApagado}`);

  /*
   * Acender o par NÃO pode remontar os PDFs: o destaque passa pelos dados dos
   * nós, então um erro aqui faria cada hover recarregar todas as miniaturas.
   */
  const canvasesAntes = await page.locator("canvas.react-pdf__Page__canvas").count();
  await segundo.hover();
  await page.waitForTimeout(800);
  const canvasesDepois = await page.locator("canvas.react-pdf__Page__canvas").count();
  check(
    "passar o cursor não remonta as miniaturas",
    canvasesAntes === canvasesDepois && canvasesDepois === ACHADOS.length,
    `${canvasesAntes} → ${canvasesDepois}`,
  );

  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  check("saindo do card, tudo volta a acender", (await opacidade(segundo)) > 0.9);

  // A pilha acende o GRUPO: os pins das duas páginas do erro repetido, e nenhum
  // outro. Um destaque que acendesse só um deles negaria o próprio motivo da
  // pilha existir.
  await pilhas.first().hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/c4-pilha-acesa.png` });
  const acesos = await pins.evaluateAll(
    (els) => els.filter((el) => Number.parseFloat(getComputedStyle(el).opacity) > 0.9).length,
  );
  check(`a pilha acende as ${RECORRENTES} páginas do erro (acesos ${acesos})`, acesos === RECORRENTES);

  // O cursor pausa o ciclo — sem isso, ler a lista de páginas seria perseguir
  // uma camada em movimento.
  // Medir por posição não serve: o React Flow injeta o conector como último
  // filho do nó, e era ELE que respondia "running" — a camada é marcada.
  const pausado = await pilhas
    .first()
    .locator('[data-pilha="topo"]')
    .evaluate((el) => getComputedStyle(el).animationPlayState);
  check("o cursor pausa o ciclo da pilha", pausado === "paused", pausado);
  const listaDePaginas = await pilhas.first().innerText();
  check("e abre a lista das páginas", /112/.test(listaDePaginas) && /114/.test(listaDePaginas), listaDePaginas);

  /*
   * Quem pede menos movimento recebe a pilha PARADA — e ainda assim inteira: o
   * ×N e a lista continuam lá. O repouso do desenho já é o estado legível, então
   * congelar não tira informação nenhuma.
   */
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  const ciclo = await pilhas
    .first()
    .locator('[data-pilha="topo"]')
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return { duracao: cs.animationDuration, repeticoes: cs.animationIterationCount };
    });
  check(
    "com menos movimento, o ciclo congela",
    Number.parseFloat(ciclo.duracao) < 0.001 && ciclo.repeticoes === "1",
    JSON.stringify(ciclo),
  );
  await page.screenshot({ path: `${OUT}/c5-pilha-congelada.png` });
  check("e a pilha continua contando as ocorrências", /×2/.test(await page.locator("body").innerText()));
  await page.emulateMedia({ reducedMotion: "no-preference" });

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/c-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
