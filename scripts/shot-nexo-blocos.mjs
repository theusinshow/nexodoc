// Prova VISUAL de que o volume de várias disciplinas aparece como blocos.
//
// A regra do escritório (docs/samples): um volume tem UMA capa e, depois dela,
// um bloco por disciplina — separatriz → LD → pranchas. O volume 10 de 040-26
// tem uma capa e TRÊS separatrizes e TRÊS LDs. Até aqui o Nexo montava todo
// volume como se fosse de uma disciplina só.
//
// NÃO CUSTA IA: a conversa é SEMEADA no IndexedDB com selos fabricados (é o que
// o OCR devolveria) e com as propostas já prontas. Nenhuma leitura de carimbo,
// nenhum turno de agente — por isso dá para repetir à vontade.
//
//   npm run dev                       (noutro terminal)
//   node scripts/shot-nexo-blocos.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "docs/ui-references/blocos";
mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/**
 * Os selos do volume 10 de 040-26, como o OCR os devolveria: hidrossanitário,
 * preventivo contra incêndio e SPDA — três disciplinas, um volume.
 */
const SELOS = [
  ...[1, 2, 3].map((n) => selo("his", n, "HIDROSSANITARIO")),
  ...[1, 2].map((n) => selo("inc", n, "PREVENTIVO CONTRA INCENDIO")),
  ...[1].map((n) => selo("spd", n, "SPDA")),
];

function selo(codigo, n, disciplina) {
  const nome = `040_26_${codigo}_${String(n).padStart(3, "0")}_a.pdf`;
  return {
    fileName: nome,
    pageNumber: 1,
    pageCount: 1,
    extraction: {
      disciplina,
      folha: n,
      total: null,
      numeroFolha: null,
      arquivo: nome.replace(/\.pdf$/, ""),
      conteudo: "PLANTA BAIXA",
      cliente: "PREFEITURA MUNICIPAL DE CHAPECO",
      secretaria: null,
      obra: "QA — VOLUME DE VARIAS DISCIPLINAS",
      fase: "PROJETO BASICO",
      tituloSecao: null,
      confianca: "alta",
    },
  };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }

  const convId = await page.evaluate(async (selos) => {
    const convId = "qa-blocos";
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA — blocos",
        createdAt: agora,
        updatedAt: agora,
        seloResults: selos,
        results: [],
        messages: [
          { id: "m1", role: "user", content: "Monta o volume 10." },
          {
            id: "m2",
            role: "assistant",
            content: "Li 6 pranchas. Proponho a LD e o volume:",
            proposals: [
              {
                kind: "ld",
                resumo: "LD do volume 10",
                params: {
                  tituloLd: "HIDROSSANITARIO",
                  numTomos: 1,
                  tomoInicial: 1,
                },
              },
              { kind: "volume", resumo: "Volume 10 montado", params: {} },
            ],
          },
        ],
      });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    return convId;
  }, SELOS);

  await pularTourGuiado(page);

  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  await page.getByText("QA — blocos", { exact: false }).first().click();
  await page.waitForTimeout(2500);

  const texto = await page.evaluate(() => document.body.innerText);

  // O PLANO: a proposta trazia UMA LD; o volume misto tem de virar três LDs e
  // três separatrizes, cada uma com o nome da sua disciplina.
  check(
    "o plano diz que as pranchas são de três disciplinas",
    /pranchas são de 3 disciplinas/i.test(texto),
  );
  check(
    "o plano nomeia as três disciplinas com a contagem",
    /Hidrossanitario \(3\)/i.test(texto) &&
      /Preventivo contra incendio \(2\)/i.test(texto) &&
      /SPDA \(1\)/i.test(texto),
  );
  check(
    "uma LD por disciplina no plano",
    /LD · Hidrossanitario/i.test(texto) &&
      /LD · Preventivo contra incendio/i.test(texto) &&
      /LD · SPDA/i.test(texto),
  );
  check(
    "o botão anuncia os 3 documentos, não 1",
    /Gerar os 3/.test(texto),
    (texto.match(/Gerar os \d+/) ?? ["(nenhum)"])[0],
  );

  // O card do volume: a sequência de blocos, numerada.
  check("o volume lista os blocos", /blocos/i.test(texto));
  check(
    "o volume diz que gera a separatriz e a LD que faltarem",
    /um bloco por disciplina/i.test(texto),
  );

  await page.screenshot({ path: `${OUT}/volume-misto.png`, fullPage: true });
  // O plano fica acima da dobra do chat: é o card que decide o que será gerado,
  // então tem captura própria.
  const plano = page.locator("text=Vou gerar").first().locator("xpath=../..");
  await plano.scrollIntoViewIfNeeded();
  await plano.screenshot({ path: `${OUT}/plano-misto.png` });
  console.log(`\n  capturas em ${OUT}/`);

  // Limpa a conversa de QA — o banco local é o mesmo em que se trabalha.
  await page.evaluate(async (convId) => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
    });
    await new Promise((res) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").delete(convId);
      tx.oncomplete = res;
    });
  }, convId);
} catch (err) {
  falhas++;
  console.error(`  FALHOU  execucao :: ${err.message}`);
} finally {
  await browser.close();
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
