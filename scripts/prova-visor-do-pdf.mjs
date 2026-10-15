// O visor do PDF ampliado (VisorDoMemorial): navegação, zoom e enquadramento.
//
//   node scripts/prova-visor-do-pdf.mjs   (== npm run prova:visor-do-pdf)
//
// HISTÓRICO
//
// 13/08/2026: o visor antigo só alcançava as folhas com pin — num memorial de
// 12 páginas com 3 achados, nove eram inalcançáveis. Ganhou "Página [n] de N",
// setas e zoom.
//
// 08/10/2026: reescrita para o visor de hoje (components/telas/resultado/
// visor.tsx), que abre por cima do resultado pelo "Ver no memorial". A versão
// de agosto procurava "VER NO DOCUMENTO" e os pins da margem, que não existem
// mais — não rodava fazia semanas.
//
// O memorial é gerado com pdf-lib, em memória: doze páginas de texto de
// verdade. Sem amostra confidencial e sem token.
import { chromium } from "playwright";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

const PAGINAS = 12;
// INC-001 está em DUAS páginas (3 e 7): é ele que exercita Shift+→.
// INC-003 divide a p. 3 com o INC-001: é ele que exercita os grifos dos OUTROS
// achados da página e o pino na margem.
const ACHADOS = [
  { id: "INC-001", paginas: [3, 7] },
  { id: "INC-002", paginas: [11] },
  { id: "INC-003", paginas: [3], trecho: "linha 5 da pagina 3 com texto" },
];
// Uma folha SEM achado nenhum.
const PAGINA_ORFA = 5;
const LARGURA = Number(process.env.SHOT_LARGURA ?? 1440);
const ALTURA = Number(process.env.SHOT_ALTURA ?? 900);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}${detalhe ? `  (${detalhe})` : ""}`);
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
    pagina.drawText(`linha ${l} da pagina ${p} com texto de corpo dez`, { x: 60, y: 710 - l * 20, size: 10, font: fonte });
  }
  pagina.drawText(`trecho de conferencia ${p}`, { x: 60, y: 90, size: 10, font: fonte });
}
const pdfB64 = Buffer.from(await doc.save()).toString("base64");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: LARGURA, height: ALTURA } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

const visor = page.locator('[role="dialog"][aria-label="Memorial com os achados"]');
const campo = visor.getByLabel("Ir para a página");
const paginaAtual = async () => Number(await campo.inputValue());
const canvas = () =>
  page.evaluate(() => {
    const c = document.querySelector(".vm-pdf .react-pdf__Page canvas");
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
const mesa = () =>
  page.evaluate(() => {
    const m = document.querySelector(".vm-mesa");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: m.scrollTop, alto: m.scrollHeight - m.clientHeight };
  });
/**
 * O marca-texto (08/10/2026): as faixas desenhadas, as caixas dos `<mark>` que
 * elas cobrem e a cor que se VÊ no `<mark>` (tem de ser transparente).
 */
const grifo = () =>
  page.evaluate(() => {
    const folha = document.querySelector(".vm-pdf .react-pdf__Page");
    if (!folha) return null;
    const faixas = [...folha.querySelectorAll(".grifo-faixa--ativo")].map((f) => {
      const r = f.getBoundingClientRect();
      return { x: r.left, y: r.top, d: r.right, b: r.bottom, pinta: f.classList.contains("grifo-faixa--pinta"), cor: getComputedStyle(f).backgroundColor };
    });
    const marcas = [...folha.querySelectorAll('.textLayer mark[data-g="0"]')].flatMap((m) => [...m.getClientRects()]);
    const fundoDaMarca = marcas.length ? getComputedStyle(folha.querySelector(".textLayer mark")).backgroundColor : null;
    const outros = folha.querySelectorAll(".grifo-faixa--outro").length;
    const realce = folha.querySelectorAll(".grifo-faixa--realce").length;
    const pinos = [...folha.querySelectorAll(".grifo-pino")].map((b) => ({ texto: b.textContent, ativo: b.getAttribute("aria-pressed") === "true", titulo: b.title }));
    const tom = folha.closest("[data-grifo-tom]")?.getAttribute("data-grifo-tom") ?? null;
    const cobre = marcas.every((m) => faixas.some((f) => m.left >= f.x - 1 && m.right <= f.d + 1 && m.top >= f.y - 1 && m.bottom <= f.b + 1));
    return { faixas, marcas: marcas.length, fundoDaMarca, tom, cobre, outros, realce, pinos };
  });
/** O balão do achado: onde está, se cobre o grifo, e o que diz. */
const balao = () =>
  page.evaluate(() => {
    const b = document.querySelector(".vm-pdf .grifo-balao");
    const folha = document.querySelector(".vm-pdf .react-pdf__Page");
    if (!b || !folha) return null;
    const r = b.getBoundingClientRect();
    const f = folha.getBoundingClientRect();
    const faixas = [...folha.querySelectorAll(".grifo-faixa--ativo")].map((x) => x.getBoundingClientRect());
    const cobre = faixas.some((x) => x.left < r.right && x.right > r.left && x.top < r.bottom && x.bottom > r.top);
    const acima = b.classList.contains("grifo-balao--acima");
    const encosta = faixas.length ? (acima ? faixas[0].top - r.bottom : r.top - faixas[faixas.length - 1].bottom) : null;
    return {
      acima,
      encosta,
      cobre,
      dentro: r.left >= f.left - 1 && r.right <= f.right + 1,
      aberto: Boolean(b.querySelector(".vm-balao")),
      texto: b.textContent ?? "",
    };
  });
/** Espera a folha pedida estar desenhada (o canvas do react-pdf troca). */
const esperarFolha = async () => {
  await page.waitForFunction(() => document.querySelector(".vm-pdf .react-pdf__Page canvas"), null, { timeout: 15000 });
  await page.waitForTimeout(900);
};
const ir = async (n) => {
  await campo.fill(String(n));
  await campo.press("Enter");
  await esperarFolha();
};
const tecla = async (k) => {
  // As teclas do visor não valem dentro de campo: tira o foco antes.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press(k);
  await esperarFolha();
};

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(1500);

  await page.evaluate(
    async ({ pdfB64, achados }) => {
      const convId = "qa-visor-do-pdf";
      const bytes = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const put = (store, valor) =>
        new Promise((res, rej) => {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(valor);
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
      await put("result_blobs", { key: `${convId}:memorial`, blob });
      const agora = Date.now();
      const incongruencias = achados.map((a) => ({
        id: a.id,
        prioridade: "Media",
        pagina: a.paginas.join(", "),
        capitulo: "",
        local: "",
        tipo: "Redação / editorial",
        descricao: "Achado semeado.",
        evidencia: a.trecho ? a.trecho : a.paginas.map((p) => `Pág. ${p}: "trecho de conferencia ${p}"`).join(" | "),
        termo_busca: a.trecho ?? `trecho de conferencia ${a.paginas[0]}`,
        conflito: "Diverge.",
        sugestao_correcao: "Corrigir.",
        confianca: "alta",
        origem: "ia",
        impacto: "revisao_editorial",
        // Achado de duas disciplinas (15/10/2026): o selo mostra as duas.
        ...(a.id === "INC-001" ? { disciplina: "arquitetura", disciplinas_envolvidas: ["hidrossanitario"] } : {}),
        // O balão mostra a troca pronta do texto corrigido.
        ...(a.id === "INC-001"
          ? { texto_corrigido: { tipo: "troca", procure_por: "trecho de conferencia 3", substitua_por: "trecho de conferência 3", modelo: "qa", geradoEm: new Date(0).toISOString() } }
          : {}),
      }));
      await put("conversations", {
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
    },
    { pdfB64, achados: ACHADOS },
  );

  await page.goto(`${BASE}/nexo?c=qa-visor-do-pdf`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const naLista = page.getByText("QA VISOR DO PDF", { exact: false }).first();
  if (!(await page.getByRole("button", { name: /Ver no memorial/i }).count())) {
    await naLista.click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  const abaAchados = page.getByRole("button", { name: /^Achados/i }).first();
  if ((await abaAchados.count()) > 0) await abaAchados.click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/visor-0-antes.png` });

  // O achado entre páginas troca o "Ver no memorial" pelos chips "p. 3", "p. 7";
  // M abre o visor nos dois casos.
  await page.getByText("Achado semeado.").first().waitFor({ timeout: 15000 });
  const selos = await page.evaluate(() => [...document.querySelectorAll(".dc-varias")].map((s) => s.textContent?.replace(/\s+/g, " ").trim()));
  check("o achado de duas disciplinas mostra as duas", selos.some((t) => /Arquitetura.*HID|ARQ.*HID/.test(t ?? "")), JSON.stringify(selos));
  // A prévia do trecho, no detalhe do achado, divide o PDF com o visor (pdf-compartilhado).
  const previa = page.locator(".rs-previa").first();
  if (await previa.count()) {
    await previa.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector(".rs-previa .grifo-faixa--ativo"), null, { timeout: 15000 }).catch(() => {});
    check("a prévia do trecho no detalhe também grifa", (await page.locator(".rs-previa .grifo-faixa--ativo").count()) > 0);
  } else check("a prévia do trecho existe no detalhe do achado", false);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("m");
  await visor.waitFor({ timeout: 15000 });
  // Abre lado a lado (conflito entre páginas): espera as DUAS folhas.
  await page.waitForFunction(() => document.querySelectorAll(".vm-lado-folha .react-pdf__Page canvas").length === 2, null, { timeout: 15000 });
  await page.waitForTimeout(1500);

  // --- 0a. o foco mora no visor ---------------------------------------------
  const foco = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));
  check("o foco entra no visor ao abrir", foco);
  let escapou = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press(i % 7 === 6 ? "Shift+Tab" : "Tab");
    if (!(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]'))))) escapou++;
  }
  check("Tab e Shift+Tab dão a volta dentro do visor", escapou === 0, `${escapou} de 40 saíram`);

  // --- 0. o conflito entre páginas abre lado a lado ------------------------
  /*
   * O INC-001 cita "Pág. 3: … | Pág. 7: …": é um conflito entre páginas, e a
   * comparação abre com as duas folhas juntas, cada uma no seu trecho.
   */
  await page.waitForTimeout(1500);
  const lado = await page.evaluate(() => {
    const folhas = [...document.querySelectorAll(".vm-lado-folha")];
    const janela = { w: innerWidth, h: innerHeight };
    return {
      folhas: folhas.map((f) => {
        const r = f.getBoundingClientRect();
        const mesa = f.querySelector(".vm-lado-folha-mesa");
        const faixa = f.querySelector(".grifo-faixa--ativo")?.getBoundingClientRect();
        const m = mesa?.getBoundingClientRect();
        const c = f.querySelector(".react-pdf__Page canvas")?.getBoundingClientRect();
        return {
          titulo: f.querySelector(".vm-lado-folha-cabeca")?.textContent ?? "",
          cabe: r.left >= 0 && r.right <= janela.w + 1,
          grifoVisivel: Boolean(faixa && m && faixa.top >= m.top && faixa.bottom <= m.bottom),
          folha: c ? Math.round(c.width) : 0,
          coluna: m ? Math.round(m.width) : 0,
        };
      }),
      ladoEscondido: getComputedStyle(document.querySelector(".vm-lado")).display === "none",
    };
  });
  check("o conflito entre páginas abre lado a lado", lado.folhas.length === 2, `${lado.folhas.length} folha(s)`);
  check(
    "as duas folhas são a p. 3 e a p. 7, cada uma com o seu trecho",
    /p\. 3.*trecho 1 de 2/.test(lado.folhas[0]?.titulo ?? "") && /p\. 7.*trecho 2 de 2/.test(lado.folhas[1]?.titulo ?? ""),
    lado.folhas.map((f) => f.titulo).join(" | "),
  );
  check("os dois grifos estão à vista ao mesmo tempo", lado.folhas.every((f) => f.grifoVisivel), JSON.stringify(lado.folhas.map((f) => f.grifoVisivel)));
  check("as folhas cabem na janela e ocupam a coluna", lado.folhas.every((f) => f.cabe && f.folha >= f.coluna - 40), lado.folhas.map((f) => `${f.folha}/${f.coluna}px`).join(" "));
  check("a coluna da direita sai para dar largura à comparação", lado.ladoEscondido);
  check("o visor sabe o total de páginas também lado a lado", (await visor.getByText(/de 12/).count()) > 0);
  await page.screenshot({ path: `${OUT}/visor-0-lado-a-lado.png` });
  await visor.getByRole("button", { name: /Uma página/ }).click();
  await page.waitForTimeout(400);
  check("o botão volta para uma página só", (await page.locator(".vm-lado-folha").count()) === 0);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("l");
  await page.waitForTimeout(800);
  check("L liga o lado a lado de novo", (await page.locator(".vm-lado-folha").count()) === 2);
  await page.keyboard.press("l");
  await esperarFolha();
  await page.waitForTimeout(1200);

  // --- 1. abre no achado --------------------------------------------------
  check("abre na página do achado (p. 3)", (await paginaAtual()) === 3, String(await paginaAtual()));
  check("o trecho está grifado", (await page.locator(".vm-pdf .react-pdf__Page mark").count()) > 0);
  check("o visor sabe que são 12 páginas", (await visor.getByText(/de 12/).count()) > 0);
  const caixa = await visor.boundingBox();
  check(
    `o visor cabe na janela ${LARGURA}×${ALTURA}`,
    caixa && caixa.x >= 0 && caixa.y >= 0 && caixa.x + caixa.width <= LARGURA + 1 && caixa.y + caixa.height <= ALTURA + 1,
    caixa ? `${Math.round(caixa.x)},${Math.round(caixa.y)} ${Math.round(caixa.width)}×${Math.round(caixa.height)}` : "sem caixa",
  );
  const c100 = await canvas();
  const m100 = await mesa();
  check(
    "a folha a 100% aproveita a largura da mesa (≥ 70%)",
    c100 && m100 && c100.w / m100.w >= 0.7,
    c100 && m100 ? `folha ${c100.w}px numa mesa de ${m100.w}px = ${Math.round((100 * c100.w) / m100.w)}%` : "",
  );
  await page.screenshot({ path: `${OUT}/visor-1-abre-no-achado.png` });

  // --- 1b. o marca-texto contínuo ------------------------------------------
  const g1 = await grifo();
  check("o trecho de uma linha vira UMA faixa", g1?.faixas.length === 1, `${g1?.faixas.length} faixa(s) para ${g1?.marcas} retalho(s)`);
  check("a faixa cobre todos os retalhos do <mark>", g1?.cobre === true);
  check("o <mark> do navegador fica transparente", g1?.fundoDaMarca === "rgba(0, 0, 0, 0)", g1?.fundoDaMarca ?? "");
  const nivelDoAtivo = await visor.locator(".vm-doachado").getAttribute("class").then((c) => /vm--(\w+)/.exec(c ?? "")?.[1] ?? null);
  check("a faixa leva a gravidade do achado", g1?.tom && g1.tom === nivelDoAtivo, `tom=${g1?.tom} nível=${nivelDoAtivo} cor=${g1?.faixas[0]?.cor}`);
  check("ao chegar, a faixa se pinta", g1?.faixas.every((f) => f.pinta) === true);
  if (g1?.faixas[0]) {
    const f = g1.faixas[0];
    await page.screenshot({ path: `${OUT}/visor-1b-grifo-de-perto.png`, clip: { x: f.x - 60, y: f.y - 60, width: f.d - f.x + 240, height: f.b - f.y + 120 } });
  }

  // --- 1c. os outros achados da página e os pinos ------------------------
  check("o outro achado da p. 3 também está grifado, mais fraco", g1?.outros >= 1, `${g1?.outros} faixa(s) de outro`);
  check("dois pinos na margem, o do ativo marcado", g1?.pinos.length === 2 && g1.pinos.filter((p) => p.ativo).length === 1, JSON.stringify(g1?.pinos.map((p) => `${p.texto}${p.ativo ? "*" : ""}`)));
  await visor.locator(".vm-achado").filter({ hasNotText: /Abrir na fila/ }).first().hover();
  await page.waitForTimeout(250);
  check("mouse no outro achado da lista acende o grifo dele", (await grifo())?.realce >= 1);
  await page.mouse.move(5, 5);
  const yAntes = g1?.faixas[0]?.y ?? 0;
  await page.locator(".grifo-pino:not(.grifo-pino--ativo)").first().click();
  await page.waitForTimeout(900);
  const g2 = await grifo();
  const ativoNaLista = await visor.locator(".vm-achado--ativo .vm-achado-id").innerText();
  check("clicar no pino do outro o torna o ativo (a lista acende junto)", /003/.test(ativoNaLista), ativoNaLista.replace(/\s+/g, " "));
  check("o grifo forte passa para o trecho dele", g2?.faixas.length === 1 && g2.faixas[0].y < yAntes, `y ${Math.round(yAntes)} → ${Math.round(g2?.faixas[0]?.y ?? 0)}`);
  check("e o de antes fica fraco", g2?.outros >= 1);
  check("trocar de achado pelo pino pinta a chegada", g2?.faixas.every((f) => f.pinta) === true);
  await page.screenshot({ path: `${OUT}/visor-1c-dois-achados.png` });
  // Volta ao INC-001 para o resto da prova.
  await page.locator(".grifo-pino:not(.grifo-pino--ativo)").first().click();
  await page.waitForTimeout(900);

  // --- 1d. o balão do achado ------------------------------------------------
  const b1 = await balao();
  check("o balão do achado está na folha, recolhido", b1 && !b1.aberto && /ACH-001/.test(b1.texto), b1?.texto.slice(0, 60));
  check("no pé da folha, o balão abre para cima", b1?.acima === true);
  check("o balão encosta no trecho (até 16px) sem cobrir o grifo", b1 && b1.encosta !== null && b1.encosta >= 0 && b1.encosta <= 16 && !b1.cobre, `vão ${b1?.encosta}px, cobre=${b1?.cobre}`);
  check("o balão não sai da folha", b1?.dentro === true);
  await page.locator(".vm-balao-pilula").click();
  await page.waitForTimeout(500);
  const b2 = await balao();
  check("clicar abre o achado no balão", b2?.aberto === true && /O que está errado/.test(b2.texto));
  check("o balão aberto traz o texto corrigido", /trecho de conferência 3/.test(b2?.texto ?? ""));
  check("aberto, continua sem cobrir o grifo e dentro da folha", b2 && !b2.cobre && b2.dentro);
  await page.screenshot({ path: `${OUT}/visor-1d-balao.png` });
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("b");
  await page.waitForTimeout(400);
  check("B recolhe o balão", (await balao())?.aberto === false);

  // --- 1e. arrastar e esconder o balão (15/10/2026) --------------------------
  const pilula = page.locator(".vm-balao-pilula");
  const pAntes = await pilula.boundingBox();
  await page.mouse.move(pAntes.x + 20, pAntes.y + pAntes.height / 2);
  await page.mouse.down();
  await page.mouse.move(pAntes.x + 80, pAntes.y + pAntes.height / 2 - 120, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const pDepois = await pilula.boundingBox();
  const b3 = await balao();
  const desvio = await page.evaluate(() => document.querySelector(".vm-pdf .grifo-balao")?.style.transform ?? "");
  check("arrastar a pílula move o balão junto com o mouse", desvio === "translate(60px, -120px)", `${desvio}; caixa dx ${Math.round(pDepois.x - pAntes.x)} dy ${Math.round(pDepois.y - pAntes.y)}`);
  check("o arrasto não abre o balão (não é clique)", b3?.aberto === false);
  check("arrastado, continua dentro da folha", b3?.dentro === true);
  // Arrastar para muito longe para: a folha é a cerca.
  await page.mouse.move(pDepois.x + 20, pDepois.y + pDepois.height / 2);
  await page.mouse.down();
  await page.mouse.move(pDepois.x - 3000, pDepois.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  check("não dá para arrastar para fora da folha", (await balao())?.dentro === true);
  // Aberto, continua onde foi largado; o duplo clique no topo dele devolve ao trecho.
  await page.keyboard.press("b");
  await page.waitForTimeout(400);
  check("abrir não devolve o balão ao trecho", (await page.evaluate(() => document.querySelector(".vm-pdf .grifo-balao")?.style.transform ?? "")) !== "");
  await page.locator(".vm-balao header b").dblclick();
  await page.waitForTimeout(400);
  const b4 = await balao();
  check("duplo clique no topo devolve o balão ao trecho", b4 && b4.encosta !== null && b4.encosta >= 0 && b4.encosta <= 16, `vão ${b4?.encosta}px`);
  // Arrastado de novo, G (volta ao grifo) também o traz de volta.
  const topo = await page.locator(".vm-balao header").boundingBox();
  await page.mouse.move(topo.x + 30, topo.y + topo.height / 2);
  await page.mouse.down();
  await page.mouse.move(topo.x + 30, topo.y - 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.keyboard.press("g");
  await page.waitForTimeout(400);
  check("G também devolve o balão ao trecho", (await page.evaluate(() => document.querySelector(".vm-pdf .grifo-balao")?.style.transform ?? "")) === "");
  await page.keyboard.press("b");
  await page.waitForTimeout(300);
  await visor.getByRole("button", { name: /^Esconder o balão/ }).click();
  await page.waitForTimeout(300);
  check("o botão do topo esconde o balão", (await balao()) === null);
  await page.keyboard.press("Shift+B");
  await page.waitForTimeout(300);
  check("Shift+B traz o balão de volta", (await balao()) !== null);

  // --- 2. a folha órfã, pelo campo ----------------------------------------
  await ir(PAGINA_ORFA);
  check(`chega à p. ${PAGINA_ORFA}, que não tem achado`, (await paginaAtual()) === PAGINA_ORFA);

  // --- 3. setas: botões e teclado -----------------------------------------
  await visor.getByRole("button", { name: /^Página anterior \(←\)/ }).click();
  await esperarFolha();
  check("o botão ‹ recua uma folha", (await paginaAtual()) === PAGINA_ORFA - 1);
  await tecla("ArrowRight");
  check("→ avança uma folha", (await paginaAtual()) === PAGINA_ORFA);
  await tecla("ArrowLeft");
  check("← recua uma folha", (await paginaAtual()) === PAGINA_ORFA - 1);

  // --- 4. bordas ----------------------------------------------------------
  await ir(1);
  check("na p. 1 o ‹ fica desabilitado", await visor.getByRole("button", { name: /^Página anterior \(←\)/ }).isDisabled());
  await ir(999);
  check("p. 999 é presa na última", (await paginaAtual()) === PAGINAS, String(await paginaAtual()));
  check("na última o › fica desabilitado", await visor.getByRole("button", { name: /^Próxima página \(→\)/ }).isDisabled());

  // --- 5. J/K entre páginas com achado ------------------------------------
  await ir(1);
  await tecla("j");
  check("J vai à próxima página com achado (3)", (await paginaAtual()) === 3, String(await paginaAtual()));
  await tecla("j");
  check("J de novo vai à 7", (await paginaAtual()) === 7, String(await paginaAtual()));
  await tecla("k");
  check("K volta à 3", (await paginaAtual()) === 3, String(await paginaAtual()));

  // --- 6. o achado em duas páginas ----------------------------------------
  // A tela renumera os achados (INC-001 → ACH-001): procura pela fita, não pelo id.
  check("a fita do achado mostra as 2 páginas", (await visor.locator(".vm-doachado").getByText(/em 2 páginas/).count()) > 0);
  await tecla("Shift+ArrowRight");
  check("Shift+→ segue o achado até a p. 7", (await paginaAtual()) === 7, String(await paginaAtual()));
  check("na página nova, a faixa se pinta de novo", (await grifo())?.faixas.some((f) => f.pinta) === true);
  check("na p. 7 o grifo é o trecho da p. 7", (await page.locator(".vm-pdf .react-pdf__Page mark").count()) > 0);
  await tecla("Shift+ArrowLeft");
  check("Shift+← volta à p. 3", (await paginaAtual()) === 3, String(await paginaAtual()));

  // --- 7. zoom ------------------------------------------------------------
  const base = (await canvas())?.w ?? 0;
  await visor.getByRole("button", { name: /Aumentar zoom/ }).click();
  await esperarFolha();
  const maior = (await canvas())?.w ?? 0;
  check("+ aumenta a folha desenhada", maior > base, `${base} → ${maior}`);
  const gz = await grifo();
  check("com zoom, a faixa é remedida e continua cobrindo o trecho", gz?.faixas.length === 1 && gz.cobre === true);
  check("zoom não repinta a chegada (o grifo não chegou de novo)", gz?.faixas.every((f) => !f.pinta) === true);
  await visor.getByRole("button", { name: /Diminuir zoom/ }).click();
  await esperarFolha();
  check("− volta ao tamanho de antes", (await canvas())?.w === base);
  await visor.getByRole("button", { name: /Aumentar zoom/ }).click();
  await esperarFolha();
  await page.locator(".vm-zoom-valor").click();
  await esperarFolha();
  check("clicar no número do zoom ajusta à largura (100%)", (await canvas())?.w === base && /100%/.test(await page.locator(".vm-zoom-valor").innerText()));
  for (let i = 0; i < 4; i++) await visor.getByRole("button", { name: /Aumentar zoom/ }).click();
  await esperarFolha();
  const ampliada = (await canvas())?.w ?? 0;
  await ir(PAGINA_ORFA);
  check("trocar de página mantém o zoom", (await canvas())?.w === ampliada, `${ampliada}`);

  // --- 8. ampliada, a folha nova começa no topo ---------------------------
  /*
   * Lendo de cima a baixo com zoom, a pessoa chega ao pé da folha e avança.
   * A folha seguinte tem de abrir no TOPO — abrir no pé dela pula o texto.
   */
  await page.evaluate(() => {
    const m = document.querySelector(".vm-mesa");
    if (m) m.scrollTop = m.scrollHeight;
  });
  await page.waitForTimeout(300);
  const noPe = await mesa();
  await tecla("ArrowRight");
  const depois = await mesa();
  check(
    "com zoom, avançar do pé da folha abre a seguinte no topo",
    depois && depois.top <= 4,
    `rolagem ${noPe?.top} de ${noPe?.alto} → ${depois?.top} de ${depois?.alto}`,
  );
  await page.screenshot({ path: `${OUT}/visor-2-ampliado.png` });

  /*
   * A BORDA ESQUERDA DA FOLHA AMPLIADA. Folha mais larga que a mesa, centrada
   * por flex: o que transborda à esquerda não tem barra que o alcance.
   */
  const borda = await page.evaluate(() => {
    const m = document.querySelector(".vm-mesa");
    const c = document.querySelector(".vm-pdf .react-pdf__Page canvas");
    if (!m || !c) return null;
    m.scrollLeft = 0;
    const mr = m.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    return { folha: Math.round(cr.left), mesa: Math.round(mr.left), largura: Math.round(cr.width), visivel: m.clientWidth };
  });
  check(
    "com zoom, a borda esquerda da folha é alcançável",
    borda && borda.folha >= borda.mesa,
    borda ? `folha começa em x=${borda.folha}, mesa em x=${borda.mesa} (folha ${borda.largura}px, mesa ${borda.visivel}px)` : "",
  );
  await page.screenshot({ path: `${OUT}/visor-3-borda-esquerda.png` });

  // --- 8b. o grifo fora da vista ------------------------------------------
  await ir(3);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const m = document.querySelector(".vm-mesa");
    if (m) m.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  const seta = visor.locator(".vm-grifo-fora");
  check("com zoom, rolar para longe do grifo mostra a seta", (await seta.count()) === 1, (await seta.count()) ? await seta.innerText() : "sem seta");
  if (await seta.count()) {
    const caixaSeta = await seta.boundingBox();
    const m = await mesa();
    check("a seta aponta para baixo (o grifo ficou abaixo)", /abaixo/.test(await seta.innerText()));
    check("a seta cabe na janela", caixaSeta && caixaSeta.y + caixaSeta.height <= ALTURA && caixaSeta.x >= 0, JSON.stringify(caixaSeta));
    await page.screenshot({ path: `${OUT}/visor-4-grifo-fora.png` });
    await seta.click();
    await page.waitForTimeout(1200);
    check("clicar na seta traz o grifo de volta (e ela some)", (await seta.count()) === 0, `mesa ${m?.top}`);
  }
  await page.evaluate(() => {
    const m = document.querySelector(".vm-mesa");
    if (m) m.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("g");
  await page.waitForTimeout(1200);
  check("G também volta ao grifo", (await seta.count()) === 0);

  // --- 8c. a roda passa de folha ------------------------------------------
  // 100% já é a largura da mesa: a folha é mais alta que a mesa e tem rolagem.
  for (let i = 0; i < 6; i++) await page.locator(".vm-zoom-valor").click().catch(() => {});
  await page.locator(".vm-zoom-valor").click();
  await ir(5);
  await page.evaluate(() => {
    const m = document.querySelector(".vm-mesa");
    if (m) m.scrollTop = m.scrollHeight;
  });
  const sobreAMesa = await page.locator(".vm-mesa").boundingBox();
  await page.mouse.move(sobreAMesa.x + sobreAMesa.width / 2, sobreAMesa.y + sobreAMesa.height / 2);
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(300);
  check("um toque de roda no pé não vira a folha", (await paginaAtual()) === 5);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(60);
  }
  await esperarFolha();
  const desceu = await mesa();
  check("continuar rolando no pé da folha leva à seguinte, pelo topo", (await paginaAtual()) === 6 && desceu.top <= 4, `p. ${await paginaAtual()}, rolagem ${desceu?.top}`);
  await page.waitForTimeout(800);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(60);
  }
  await esperarFolha();
  await page.waitForTimeout(900);
  const subiu = await mesa();
  check("rolar para cima no topo volta à anterior, pelo pé", (await paginaAtual()) === 5 && subiu.top >= subiu.alto - 4, `p. ${await paginaAtual()}, rolagem ${subiu?.top} de ${subiu?.alto}`);

  // --- 9. sair ------------------------------------------------------------
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  check("Esc fecha o visor", (await visor.count()) === 0);

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
