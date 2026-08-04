// O ESCAPE DA CAPA no navegador: corrigir órgão, secretaria, obra, fase, código
// e revisão quando o carimbo mente — e sem gastar um token.
//
// O carimbo encenado aqui MENTE de propósito: obra e secretaria erradas. É o
// caso que fechava o Nexo e obrigava a abrir a tela /capas, que tem um passo
// inteiro para esses campos.
//
// As asserções que importam são duas, e são diferentes entre si:
//   1. a correção CHEGA ao servidor (o corpo da requisição a carrega) — a classe
//      de defeito "fiação esquecida", que já mordeu duas vezes neste módulo;
//   2. a correção VENCE o carimbo (o documento sai com o valor corrigido) — a
//      classe "correção que perde para o parser", que é pior que não ter campo.
//
// Encenado: o OCR do carimbo e o turno do agente. REAL: a geração da capa e da
// LD, que é o caminho que se quer provar. A capa e a LD geradas gravam linhas no
// banco de dev com o código de QA 999-26.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-identidade.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-identidade";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA AUTOMATICO IDENTIDADE";
/** O que o carimbo diz — e está errado. */
const OBRA_ERRADA = `OBRA ERRADA DO CARIMBO ${MARCADOR}`;
const SECRETARIA_ERRADA = "SECRETARIA QUE O OCR INVENTOU";
/** O que o engenheiro digita, olhando a prancha. */
const OBRA_CERTA = "ESCOLA MUNICIPAL PRIMEIRA LINHA";
const SECRETARIA_CERTA = "SECRETARIA DE EDUCACAO";
/*
 * Um código que o carimbo NUNCA daria. Com "999_26" — o mesmo que o selo
 * fabricado carrega — a asserção "a correção venceu" passaria verde sem a
 * correção existir, que é o pior tipo de teste.
 */
const CODIGO_CERTO = "777_26";

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his",
);
const PRANCHAS = [1, 2].map((i) =>
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
  ({ marcador, obraErrada, secretariaErrada }) => {
    const original = window.fetch.bind(window);
    window.__ENVIADO = {};
    /** Preenchido depois do login: o agente encenado precisa de um id real. */
    window.__TEMPLATE = "";

    window.fetch = async (entrada, init = {}) => {
      const url = typeof entrada === "string" ? entrada : entrada.url;

      if (url.includes("/api/ld/extract-stamp")) {
        const corpo = JSON.parse(init.body ?? "{}");
        const arquivo = corpo?.metadata?.fileName ?? "";
        const n = Number(/_(\d{3})_/.exec(arquivo)?.[1] ?? 1);
        return new Response(
          JSON.stringify({
            disciplina: "Hidrossanitario",
            folha: n,
            total: 2,
            numeroFolha: `${n}/2`,
            arquivo: `999_26_his_${String(n).padStart(3, "0")}_a`,
            conteudo: `FOLHA ${n} — ${marcador}`,
            cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
            // O CARIMBO MENTE — é isto que o escape existe para consertar.
            secretaria: secretariaErrada,
            obra: obraErrada,
            fase: "PROJETO BASICO",
            tituloSecao: "PROJETO HIDROSSANITARIO",
            confianca: "alta",
            usage: { totalTokens: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

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
                  kind: "capa",
                  resumo: "Capa",
                  params: {
                    templateId: window.__TEMPLATE,
                    tituloCapa: "PROJETO HIDROSSANITARIO",
                    volume: "1",
                    numTomos: 1,
                    tomoInicial: 1,
                  },
                },
                {
                  kind: "ld",
                  resumo: "LD",
                  params: { tituloLd: "PROJETO HIDROSSANITARIO", numTomos: 1, tomoInicial: 1 },
                },
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

      if (url.includes("/api/nexo/capa") || url.includes("/api/nexo/ld")) {
        try {
          window.__ENVIADO[url.includes("/api/nexo/capa") ? "capa" : "ld"] = JSON.parse(
            init.body ?? "{}",
          );
        } catch {}
      }

      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, obraErrada: OBRA_ERRADA, secretariaErrada: SECRETARIA_ERRADA },
);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});

  // A prefeitura tem de ser uma de verdade: a rota recusa template inexistente.
  const template = await page.evaluate(async () => {
    const r = await fetch("/api/capas/templates").then((x) => x.json());
    window.__TEMPLATE = r.templates?.[0]?.id ?? "";
    return window.__TEMPLATE;
  });
  check("há uma prefeitura configurada para gerar a capa", Boolean(template), template);

  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 90000 });

  // =========================================================================
  // Gerar com o carimbo MENTINDO — o estado de antes
  // =========================================================================
  console.log("\nA capa sai com o que o carimbo disse");
  const composer = page.locator("textarea").first();
  await composer.fill("Cria a capa e a LD");
  await composer.press("Enter");
  await page.getByText(/Vou gerar · \d+ documentos?/i).first().waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Gerar os \d+/i }).first().click();
  await page
    .getByText(/Gerado · \d+ documentos?/i)
    .first()
    .waitFor({ timeout: 180000 });

  const primeiraCapa = await page.evaluate(() => window.__ENVIADO.capa ?? null);
  check(
    "a primeira geração vai SEM identidade (nada foi corrigido ainda)",
    primeiraCapa !== null && primeiraCapa.obra === undefined,
    JSON.stringify(primeiraCapa?.obra),
  );
  await page.screenshot({ path: `${OUT}/1-carimbo-errado.png`, fullPage: true });

  // =========================================================================
  // Corrigir a identidade no editor do nó da capa
  // =========================================================================
  console.log("\nCorrigir o que o carimbo errou");
  // Pelo id do artefato, não pelo texto: o rótulo do nó carrega o nome da
  // prefeitura e depende do template configurado na máquina.
  const noDaCapa = page.locator('.react-flow__node[data-id^="capa"]').first();
  await noDaCapa.click();
  await page.getByRole("button", { name: /Editar aqui/i }).first().click();

  const dialogo = page.getByRole("dialog");
  await dialogo.waitFor({ timeout: 5000 });
  check(
    "os campos de identidade ficam RECOLHIDOS (o carimbo acerta quase sempre)",
    (await dialogo.locator("details").count()) === 1 &&
      !(await dialogo.locator("details").first().evaluate((el) => el.open)),
  );

  await dialogo.getByText(/Identidade do projeto/i).click();
  await page.waitForTimeout(300);
  const campo = (rotulo) =>
    dialogo.locator("label").filter({ hasText: rotulo }).first().locator("input, textarea").first();
  await campo("Secretaria").fill(SECRETARIA_CERTA);
  await campo("Obra").fill(OBRA_CERTA);
  await campo("Código").fill(CODIGO_CERTO);
  await page.screenshot({ path: `${OUT}/2-editor-identidade.png`, fullPage: true });

  await dialogo.getByRole("button", { name: /Aplicar/i }).click();
  await page.waitForTimeout(4000);

  // --- 1. A correção CHEGOU ao servidor ------------------------------------
  const capaCorrigida = await page.evaluate(() => window.__ENVIADO.capa ?? null);
  check(
    "a geração da capa leva a obra corrigida",
    capaCorrigida?.obra === OBRA_CERTA,
    JSON.stringify(capaCorrigida?.obra),
  );
  check(
    "a geração da capa leva a secretaria corrigida",
    capaCorrigida?.secretaria === SECRETARIA_CERTA,
    JSON.stringify(capaCorrigida?.secretaria),
  );
  check(
    "a geração da capa leva o código corrigido",
    capaCorrigida?.codigo === CODIGO_CERTO,
    JSON.stringify(capaCorrigida?.codigo),
  );

  // --- 2. A correção VENCEU o carimbo --------------------------------------
  // O resumo do nó vem da RESPOSTA do servidor: se o código corrigido aparece
  // ali, foi o builder que o usou — não o cliente que o mandou e o servidor
  // ignorou, que é o defeito que a secretaria tinha (o carimbo vinha primeiro).
  const textoDoCanvas = await page.locator(".react-flow").innerText();
  check(
    "o documento sai com o código corrigido (a correção venceu o carimbo)",
    /777[-_]26/.test(textoDoCanvas),
    textoDoCanvas.slice(0, 300),
  );
  await page.screenshot({ path: `${OUT}/3-corrigido.png`, fullPage: true });

  // --- A correção é da CONVERSA, não daquele documento ---------------------
  const guardado = await page.evaluate(async (marcador) => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
    });
    const todas = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const r = tx.objectStore("conversations").getAll();
      r.onsuccess = () => res(r.result ?? []);
    });
    const atual = todas.find((c) => JSON.stringify(c).includes(marcador));
    return atual?.identidade ?? null;
  }, MARCADOR);
  check(
    "a identidade corrigida é gravada na conversa",
    guardado?.obra === OBRA_CERTA && guardado?.codigo === CODIGO_CERTO,
    JSON.stringify(guardado),
  );

  // --- E vale para a LD, não só para a capa --------------------------------
  console.log("\nA mesma correção vale para a LD");
  await page.getByRole("button", { name: /Gerar os \d+|Gerar de novo/i }).first().click();
  await page.waitForTimeout(6000);
  const ldCorrigida = await page.evaluate(() => window.__ENVIADO.ld ?? null);
  check(
    "a LD recebe a mesma obra corrigida",
    ldCorrigida?.obra === OBRA_CERTA,
    JSON.stringify(ldCorrigida?.obra),
  );
  check(
    "a LD recebe o mesmo código corrigido",
    ldCorrigida?.codigo === CODIGO_CERTO,
    JSON.stringify(ldCorrigida?.codigo),
  );
  check(
    "a LD NÃO recebe secretaria (ela é da capa; a LD não a imprime)",
    ldCorrigida?.secretaria === undefined,
    JSON.stringify(ldCorrigida?.secretaria),
  );
  await page.screenshot({ path: `${OUT}/4-ld.png`, fullPage: true });

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
