// Paridade da LD (2/2) no NAVEGADOR: adicionar folha, remover folha e corrigir
// o total de referência — sem gastar um token.
//
// Os testes puros provam as REGRAS (`test:nexo:folhas`, `test:nexo:totais`,
// `test:nexo:check`). O que eles não alcançam é a FIAÇÃO: o número corrigido
// chegar até o corpo da requisição que gera o documento. Foi essa a classe de
// defeito do 1/2 ("passar `folhaManual` em duas das três pontas"), e é ela que
// este arquivo persegue — por isso as asserções são sobre o que SAI do cliente,
// não sobre o que a tela mostra.
//
// Encenado (custo zero): o OCR do carimbo, que devolve um total ERRADO de
// propósito (21 numa disciplina de 3 folhas — o defeito que a correção existe
// para consertar), e o turno do agente, que devolve as propostas de LD e
// conferência sem chamar modelo nenhum.
//
// REAL: a geração da LD e a conferência. Elas são determinísticas e é justamente
// o caminho que se quer provar. A LD gerada grava UMA linha `LdDraft` no banco
// de dev, com o código de QA 999-26 — é o mesmo marcador que
// `shot-nexo-persistencia.mjs` usa, e serve para reconhecê-la depois.
//
//   npm run dev                       (noutro terminal)
//   node scripts/shot-nexo-folhas.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-folhas";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA AUTOMATICO FOLHAS";
/** O total que o carimbo (mal lido) anuncia — três folhas dizendo "de 21". */
const TOTAL_ERRADO = 21;
/** O total de verdade, que o engenheiro digita no popover. */
const TOTAL_CERTO = 3;

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his",
);
const PRANCHAS = [1, 2, 3].map((i) =>
  path.join(PASTA, `040_26_his_${String(i).padStart(3, "0")}_a.pdf`),
);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

await context.addInitScript(
  ({ marcador, totalErrado }) => {
    const original = window.fetch.bind(window);
    /** O que o cliente MANDOU para cada rota — é sobre isto que o teste assere. */
    window.__ENVIADO = {};
    /** Toda URL que passou pelo cliente — diagnóstico quando algo não chega. */
    window.__URLS = [];

    window.fetch = async (entrada, init = {}) => {
      const url = typeof entrada === "string" ? entrada : entrada.url;
      window.__URLS.push(url);

      // Carimbo fabricado, com o TOTAL ERRADO: é o defeito que a correção conserta.
      if (url.includes("/api/ld/extract-stamp")) {
        const corpo = JSON.parse(init.body ?? "{}");
        const arquivo = corpo?.metadata?.fileName ?? "";
        const n = Number(/_(\d{3})_/.exec(arquivo)?.[1] ?? 1);
        return new Response(
          JSON.stringify({
            disciplina: "Hidrossanitario",
            folha: n,
            total: totalErrado,
            numeroFolha: `${n}/${totalErrado}`,
            arquivo: `999_26_his_${String(n).padStart(3, "0")}_a`,
            conteudo: `FOLHA ${n} — ${marcador}`,
            cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
            secretaria: "SECRETARIA DE OBRAS",
            obra: marcador,
            fase: "EXECUTIVO",
            tituloSecao: "PROJETO HIDROSSANITARIO",
            confianca: "alta",
            usage: { totalTokens: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // O agente, encenado: devolve as propostas sem chamar modelo. O que se
      // quer exercitar é o CARD, não o cérebro.
      if (url.includes("/api/nexo/agent")) {
        const enc = new TextEncoder();
        const corpo = new ReadableStream({
          start(controller) {
            const manda = (o) =>
              controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            manda({ type: "delta", text: "Segue a proposta." });
            manda({
              type: "done",
              proposals: [
                {
                  kind: "ld",
                  resumo: "LD de HIS",
                  params: { tituloLd: "PROJETO HIDROSSANITARIO", numTomos: 1, tomoInicial: 1 },
                },
                { kind: "conferencia", resumo: "Conferir as folhas", params: {} },
              ],
              slotRequest: null,
              ldPreview: null,
              usage: 0,
            });
            controller.close();
          },
        });
        return new Response(corpo, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }

      // As rotas de verdade: o corpo é gravado ANTES de seguir viagem.
      if (url.includes("/api/nexo/ld") || url.includes("/api/nexo/check")) {
        try {
          window.__ENVIADO[url.includes("/api/nexo/ld") ? "ld" : "check"] = JSON.parse(
            init.body ?? "{}",
          );
        } catch {}
      }

      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, totalErrado: TOTAL_ERRADO },
);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

const nosDeFolha = () => page.locator('.react-flow__node[data-id^="folha:"]');

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});

  // --- leitura -------------------------------------------------------------
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 90000 });
  check("as 3 folhas viraram nós do canvas", (await nosDeFolha().count()) === 3);
  check(
    "o carimbo mal lido aparece no nó (01/21)",
    (await nosDeFolha().first().innerText()).includes(`/${TOTAL_ERRADO}`),
    await nosDeFolha().first().innerText(),
  );
  await page.screenshot({ path: `${OUT}/1-leitura.png`, fullPage: true });

  // =========================================================================
  // REMOVER e RESTAURAR
  // =========================================================================
  console.log("\nRemover uma folha, e trazê-la de volta");
  await nosDeFolha().nth(1).click();
  await page.getByRole("button", { name: /^Remover$/ }).first().click();
  await page.getByRole("button", { name: "Sim" }).first().click();
  await page.waitForTimeout(600);
  check("a folha removida sai do canvas", (await nosDeFolha().count()) === 2);

  const chipRestaurar = page.getByRole("button", { name: /1 removida/i });
  check("a barra oferece a volta", (await chipRestaurar.count()) === 1);
  await page.screenshot({ path: `${OUT}/2-removida.png`, fullPage: true });

  await chipRestaurar.click();
  await page.waitForTimeout(600);
  check("restaurar traz a folha de volta", (await nosDeFolha().count()) === 3);
  check(
    "e o chip de restaurar some quando não há mais nada removido",
    (await page.getByRole("button", { name: /removida/i }).count()) === 0,
  );

  // =========================================================================
  // ADICIONAR uma folha que não foi lida
  // =========================================================================
  console.log("\nCriar a folha que não veio em PDF");
  await page.getByRole("button", { name: /^Folha$/ }).first().click();
  await page.waitForTimeout(600);
  check("a folha criada à mão entra no canvas", (await nosDeFolha().count()) === 4);

  const avulsa = nosDeFolha().last();
  check(
    "ela avisa que ainda não sai na LD (sem código)",
    (await avulsa.innerText()).toLowerCase().includes("sem código"),
    await avulsa.innerText(),
  );

  // Preenche pelo MESMO popover das outras folhas.
  await avulsa.click();
  await page.getByRole("button", { name: /^Corrigir$/ }).first().click();
  const dialogo = page.getByRole("dialog");
  await dialogo.waitFor({ timeout: 5000 });
  await dialogo.locator("input").first().fill("4");
  await dialogo.locator("input").nth(2).fill("999_26_his_004_a");
  await dialogo.locator("textarea").first().fill("PRANCHA QUE NAO VEIO");
  await dialogo.getByRole("button", { name: /Aplicar/i }).click();
  await page.waitForTimeout(700);

  const avulsaDepois = await nosDeFolha().last().innerText();
  check("a folha criada ganha nº e título", /04/.test(avulsaDepois) && /NAO VEIO/i.test(avulsaDepois), avulsaDepois);
  check(
    "e passa a dizer que é só da LD (tem código, não tem PDF)",
    avulsaDepois.toLowerCase().includes("sem pdf"),
    avulsaDepois,
  );
  await page.screenshot({ path: `${OUT}/3-avulsa.png`, fullPage: true });

  // =========================================================================
  // CORRIGIR O TOTAL — o número que inventa "folhas faltando"
  // =========================================================================
  console.log("\nCorrigir o total de referência");
  await nosDeFolha().first().click();
  await page.getByRole("button", { name: /^Corrigir$/ }).first().click();
  await dialogo.waitFor({ timeout: 5000 });
  // 2º campo da primeira linha: "de (total)".
  await dialogo.locator("input").nth(1).fill(String(TOTAL_CERTO));
  await dialogo.getByRole("button", { name: /Aplicar/i }).click();
  await page.waitForTimeout(700);

  check(
    "o nó passa a mostrar o total corrigido (01/03)",
    (await nosDeFolha().first().innerText()).includes(`/0${TOTAL_CERTO}`),
    await nosDeFolha().first().innerText(),
  );
  await page.screenshot({ path: `${OUT}/4-total-corrigido.png`, fullPage: true });

  // A correção tem de sobreviver ao F5 — ela mora no IndexedDB da conversa.
  const guardado = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
    });
    const todas = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const r = tx.objectStore("conversations").getAll();
      r.onsuccess = () => res(r.result ?? []);
    });
    const atual = todas.find((c) => c.totaisPorDisciplina || c.avulsas);
    return {
      totais: atual?.totaisPorDisciplina ?? null,
      avulsas: (atual?.avulsas ?? []).length,
    };
  });
  check(
    "o total corrigido é gravado por DISCIPLINA",
    guardado.totais?.his === TOTAL_CERTO,
    JSON.stringify(guardado.totais),
  );
  check("a folha criada à mão também é gravada", guardado.avulsas === 1);

  // =========================================================================
  // A FIAÇÃO: o número corrigido chega às duas rotas
  // =========================================================================
  console.log("\nA correção chega ao documento");
  const composer = page.locator("textarea").first();
  await composer.fill("Cria a LD e confere as folhas");
  await composer.press("Enter");
  await page.getByText(/Vou gerar · \d+ documentos?/i).first().waitFor({ timeout: 30000 });

  await page.getByRole("button", { name: /Gerar os \d+|Gerar a LD/i }).first().click();
  // Espera a GERAÇÃO terminar, não um relógio: a LD passa pelo LibreOffice.
  await page
    .getByText(/Gerado · \d+ documentos?/i)
    .first()
    .waitFor({ timeout: 120000 })
    .catch(() => {});
  const enviadoLd = await page.evaluate(() => window.__ENVIADO.ld ?? null);
  if (!enviadoLd) {
    console.log(
      "       URLs vistas:",
      JSON.stringify(
        await page.evaluate(() =>
          window.__URLS.filter((u) => u.includes("/api/nexo/")).slice(-8),
        ),
      ),
    );
  }
  check(
    "a geração da LD leva o total corrigido ao servidor",
    enviadoLd?.referenceTotal === TOTAL_CERTO,
    JSON.stringify(enviadoLd?.referenceTotal),
  );

  /*
   * O botão do CARD, não o chip de resposta rápida: os chips se chamam
   * "Enviar: Conferir as folhas" e o casamento por substring do Playwright
   * pegava o chip primeiro — o teste mandava uma frase ao agente e seguia
   * achando que tinha conferido.
   */
  const botaoConferir = page.getByRole("button", { name: /^Conferir( agora)?$/i }).first();
  await botaoConferir.waitFor({ timeout: 15000 });
  await botaoConferir.click();
  await page.waitForTimeout(3000);
  const enviadoCheck = await page.evaluate(() => window.__ENVIADO.check ?? null);
  check(
    "a conferência leva o total corrigido ao servidor",
    enviadoCheck?.totais?.his === TOTAL_CERTO,
    JSON.stringify(enviadoCheck?.totais),
  );

  /*
   * E o efeito que justifica tudo: o conjunto completo para de acusar folhas
   * faltando (com o carimbo mal lido, cobraria 21). A asserção exige que a
   * conferência TENHA RODADO — sem isso, "não achei a palavra faltando" passaria
   * verde numa tela onde nada aconteceu, que é o pior tipo de teste.
   */
  const texto = await page.locator("body").innerText();
  check(
    "a conferência rodou de verdade (tem veredito)",
    /conferência|conferido|veredito|nada a corrigir|ok\b/i.test(texto),
  );
  check(
    "a conferência NÃO acusa mais folhas faltando",
    !/folha\(s\) faltando/i.test(texto),
    (/[^.]*faltando[^.]*\./i.exec(texto) ?? [""])[0],
  );
  await page.screenshot({ path: `${OUT}/5-conferencia.png`, fullPage: true });

  check("nenhum erro de runtime no console", errosDeConsole.length === 0, errosDeConsole[0] ?? "");
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
  await page.screenshot({ path: `${OUT}/erro.png`, fullPage: true }).catch(() => {});
} finally {
  const apagadas = await page
    .evaluate(async (marcador) => {
      const db = await new Promise((res) => {
        const req = indexedDB.open("nexo", 1);
        req.onsuccess = () => res(req.result);
      });
      const todas = await new Promise((res) => {
        const tx = db.transaction("conversations", "readonly");
        const r = tx.objectStore("conversations").getAll();
        r.onsuccess = () => res(r.result ?? []);
      });
      const alvos = todas.filter((c) => JSON.stringify(c).includes(marcador));
      await Promise.all(
        alvos.map(
          (c) =>
            new Promise((res) => {
              const tx = db.transaction("conversations", "readwrite");
              tx.objectStore("conversations").delete(c.id);
              tx.oncomplete = () => res();
              tx.onerror = () => res();
            }),
        ),
      );
      return alvos.length;
    }, MARCADOR)
    .catch(() => -1);
  console.log(`\n  conversas de QA apagadas: ${apagadas}`);
  await browser.close();
}

console.log(
  falhas === 0 ? `\nTudo OK. Prints em ${OUT}` : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
