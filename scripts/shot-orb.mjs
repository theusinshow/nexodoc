// O ORBE, olhado de perto: cada estado visual, o card de status, e os dois
// tamanhos. Sem gastar token — o OCR do carimbo é encenado.
//
// Existe porque o orbe é a única coisa do produto que se move continuamente, e
// movimento não se confere lendo código: confere-se olhando. As capturas são
// tiradas em MOMENTOS DIFERENTES da animação (duas por estado, com intervalo)
// para dar para ver o que muda — um print só de uma coisa que respira não diz
// nada sobre o respiro.
//
//   npm run dev                (noutro terminal)
//   node scripts/shot-orb.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-orb";
fs.mkdirSync(OUT, { recursive: true });

const MARCADOR = "QA AUTOMATICO ORB";
const ATRASO_DO_SELO = Number(process.env.ORB_ATRASO ?? 900);

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his",
);
const PRANCHAS = [1, 2, 3].map((i) =>
  path.join(PASTA, `040_26_his_${String(i).padStart(3, "0")}_a.pdf`),
);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});

await context.addInitScript(
  ({ marcador, atraso }) => {
    const original = window.fetch.bind(window);
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    window.fetch = async (entrada, init = {}) => {
      const url = typeof entrada === "string" ? entrada : entrada.url;
      if (url.includes("/api/ld/extract-stamp")) {
        const corpo = JSON.parse(init.body ?? "{}");
        const arquivo = corpo?.metadata?.fileName ?? "";
        const n = Number(/_(\d{3})_/.exec(arquivo)?.[1] ?? 1);
        await espera(atraso);
        return new Response(
          JSON.stringify({
            disciplina: "Hidrossanitario",
            folha: n,
            total: 3,
            numeroFolha: `${n}/3`,
            arquivo: `999_26_his_${String(n).padStart(3, "0")}_a`,
            conteudo: `FOLHA ${n} — ${marcador}`,
            cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
            secretaria: "SECRETARIA DE OBRAS",
            obra: "ESCOLA MUNICIPAL PRIMEIRA LINHA",
            fase: "EXECUTIVO",
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
          async start(controller) {
            const manda = (o) =>
              controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            // Devagar de propósito: é durante isto que o orbe "responde".
            for (const t of ["Estou ", "montando ", "a proposta ", "com calma."]) {
              await espera(700);
              manda({ type: "delta", text: t });
            }
            manda({ type: "done", proposals: [], slotRequest: null, ldPreview: null, usage: 0 });
            controller.close();
          },
        });
        return new Response(corpo, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }
      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, atraso: ATRASO_DO_SELO },
);

const page = await context.newPage();

/** Recorta a região do orbe (o nó + folga para o halo e o card). */
async function tirar(nome, { comCard = false } = {}) {
  // `.nexo-agent-orb` é só do orbe R3F — o `.nexo-agent-orb` também casava
  // com a mini-marca da sidebar, que é outro componente (CSS puro).
  const orb = page.locator(".nexo-agent-orb").first();
  const caixa = await orb.boundingBox();
  if (!caixa) {
    await page.screenshot({ path: `${OUT}/${nome}.png` });
    return;
  }
  const folga = comCard ? 260 : 70;
  await page.screenshot({
    path: `${OUT}/${nome}.png`,
    clip: {
      x: Math.max(0, caixa.x - 90),
      y: Math.max(0, caixa.y - 60),
      width: Math.min(1600 - Math.max(0, caixa.x - 90), caixa.width + 180),
      height: caixa.height + 60 + folga,
    },
  });
}

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500);

  console.log("hero / idle");
  await tirar("1-hero-idle-a");
  await page.waitForTimeout(1400);
  await tirar("1-hero-idle-b");
  await page.screenshot({ path: `${OUT}/1-hero-tela.png`, fullPage: false });

  console.log("hero / card aberto");
  await page.locator('.nexo-agent-orb').first().click();
  await page.waitForTimeout(700);
  await tirar("2-hero-card", { comCard: true });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  console.log("lendo os selos (compact + satélites)");
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  await page.waitForTimeout(ATRASO_DO_SELO + 300);
  await tirar("3-lendo-a");
  await page.waitForTimeout(900);
  await tirar("3-lendo-b");

  await page.getByText(/folha\(s\) de selo lidas/i).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1200);
  console.log("pronto (compact, com satélites)");
  await tirar("4-compact-pronto");
  await page.screenshot({ path: `${OUT}/4-compact-tela.png` });

  console.log("card aberto, já com fatos");
  await page.locator('.nexo-agent-orb').first().click();
  await page.waitForTimeout(700);
  await tirar("5-card-com-fatos", { comCard: true });
  await page.screenshot({ path: `${OUT}/5-card-na-tela.png` });
  await page.keyboard.press("Escape");

  console.log("press: o orbe reconhece o toque");
  {
    const caixa = await page.locator(".nexo-agent-orb").first().boundingBox();
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.waitForTimeout(500);
    await tirar("6-hover");
    await page.mouse.down();
    await page.waitForTimeout(120);
    await tirar("7-press");
    await page.mouse.up();
    await page.waitForTimeout(500);
    await page.keyboard.press("Escape");
  }

  console.log("o ponteiro puxa o orbe (à esquerda / à direita)");
  {
    const caixa = await page.locator(".nexo-agent-orb").first().boundingBox();
    await page.mouse.move(caixa.x - 120, caixa.y + caixa.height / 2);
    await page.waitForTimeout(800);
    await tirar("8-mira-esquerda");
    await page.mouse.move(caixa.x + caixa.width + 120, caixa.y + caixa.height / 2);
    await page.waitForTimeout(800);
    await tirar("8-mira-direita");
    await page.mouse.move(10, 10);
    await page.waitForTimeout(600);
  }

  console.log("respondendo (streaming) e o pulso de conclusão");
  const composer = page.locator("textarea").first();
  await composer.fill("Monta a LD");
  await composer.press("Enter");
  await page.waitForTimeout(1200);
  await tirar("9-respondendo-a");
  await page.waitForTimeout(900);
  await tirar("9-respondendo-b");
  /*
   * O pulso de conclusão vive 900ms. Esperar por relógio erra: a captura tem de
   * sair no instante em que o turno FECHA. O sinal é o botão voltar a ser
   * "Enviar" (enquanto responde, ele é "Parar").
   */
  await page
    .getByRole("button", { name: "Enviar", exact: true })
    .first()
    .waitFor({ timeout: 20000 });
  await tirar("10-conclusao-a");
  await page.waitForTimeout(220);
  await tirar("10-conclusao-b");
  await page.waitForTimeout(260);
  await tirar("10-conclusao-c");

  console.log(`\nCapturas em ${OUT}`);
} catch (err) {
  console.error("EXPLODIU:", err instanceof Error ? err.message : err);
  await page.screenshot({ path: `${OUT}/erro.png`, fullPage: true }).catch(() => {});
} finally {
  await page
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
      for (const c of todas.filter((x) => JSON.stringify(x).includes(marcador))) {
        await new Promise((res) => {
          const tx = db.transaction("conversations", "readwrite");
          tx.objectStore("conversations").delete(c.id);
          tx.oncomplete = () => res();
          tx.onerror = () => res();
        });
      }
    }, MARCADOR)
    .catch(() => {});
  await browser.close();
}
