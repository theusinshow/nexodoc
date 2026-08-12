// Capturas do software para o kit de design (anexo da ferramenta de design).
//
// NÃO GASTA TOKEN. As telas de conversa e canvas normalmente exigiriam ler os
// carimbos das pranchas (uma chamada de OpenAI por folha); aqui a conversa é
// SEMEADA direto no IndexedDB com selos fabricados — o mesmo caminho que a
// aplicação usa ao restaurar uma conversa depois do F5, então a tela renderiza
// exatamente como renderizaria de verdade.
//
//   npm run dev                        (noutro terminal)
//   node scripts/shot-kit-design.mjs
//
// O contexto do Playwright é limpo: a conversa semeada morre com ele e não
// aparece no navegador do engenheiro.
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.KIT_OUT ?? "docs/open-design-kit/telas";
fs.mkdirSync(OUT, { recursive: true });

const VIEW = { width: 1440, height: 900 };

let n = 0;
async function shot(page, nome, opts = {}) {
  n++;
  const file = path.join(OUT, `${String(n).padStart(2, "0")}-${nome}.png`);
  await page.screenshot({ path: file, ...opts });
  console.log(`  ${file}`);
}

/** Selo fabricado — a forma que o OCR do carimbo devolve. */
function selo(i, total) {
  const nn = String(i).padStart(3, "0");
  return {
    fileName: `040_26_arq_${nn}_a.pdf`,
    pageNumber: i,
    pageCount: total,
    extraction: {
      disciplina: "ARQUITETURA",
      folha: i,
      total,
      numeroFolha: `${String(i).padStart(2, "0")}/${String(total).padStart(2, "0")}`,
      arquivo: `040_26_arq_${nn}_a`,
      conteudo: [
        "PLANTA BAIXA - PAVIMENTO TERREO",
        "PLANTA DE COBERTURA",
        "CORTES AA E BB",
        "FACHADAS",
        "PLANTA DE LOCACAO",
        "DETALHES DE ESQUADRIAS",
        "PLANTA BAIXA - PAVIMENTO SUPERIOR",
        "DETALHES DE ESCADA",
      ][i - 1],
      cliente: "PREFEITURA MUNICIPAL DE CHAPECO",
      secretaria: null,
      obra: "REVITALIZACAO DA FEIRA MUNICIPAL DE CHAPECO",
      fase: "PROJETO EXECUTIVO",
      tituloSecao: null,
      confianca: "alta",
    },
  };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
const page = await context.newPage();

try {
  // --- login (a tela, antes de entrar) -------------------------------------
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.waitForTimeout(600);
    await shot(page, "login");
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  } else {
    n++; // mantém a numeração mesmo se já estava logado
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2500); // o orbe 3D leva um instante para montar

  // --- 02 boas-vindas: orbe centrado, composer herói ------------------------
  await shot(page, "nexo-boas-vindas");

  // --- semeia uma conversa completa ----------------------------------------
  // Mensagens + selos + a proposta do agente. Nada disso chama a API: é o mesmo
  // registro que a aplicação grava sozinha ao conversar.
  const convId = await page.evaluate(async (selos) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const id = "kit-design-demo";
    const registro = {
      id,
      title: "Revitalização da Feira Municipal",
      folderKey: "040-26",
      createdAt: agora - 600000,
      updatedAt: agora,
      messages: [
        {
          id: "m1",
          role: "user",
          content: "Anexei as pranchas de arquitetura. Cria a LD e a capa de Chapecó, em 2 tomos.",
        },
        {
          id: "m2",
          role: "assistant",
          content:
            "Li 8 pranchas de ARQUITETURA, código 040-26, revisão A, obra “Revitalização da Feira Municipal de Chapecó”. Preparei a LD e a capa em 2 tomos. Confira os dados antes de eu gerar — o título é decisão sua.",
          proposals: [
            {
              kind: "ld",
              resumo: "LD Arquitetura · 040-26 · 8 folhas",
              params: { tituloLd: "PROJETO ARQUITETONICO", numTomos: 2, tomoInicial: 1 },
            },
            {
              kind: "capa",
              resumo: "Capa Chapecó",
              params: {
                templateId: "prefchap",
                tituloCapa: "PROJETO ARQUITETONICO",
                volume: "1",
                numTomos: 2,
                tomoInicial: 1,
              },
            },
          ],
        },
      ],
      seloResults: selos,
      results: [],
    };
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put(registro);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return id;
  }, Array.from({ length: 8 }, (_, i) => selo(i + 1, 8)));
  console.log(`  (conversa semeada: ${convId})`);

  // Recarrega e abre a conversa pela sidebar — o mesmo caminho do F5.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const item = page.getByText("Revitalização da Feira Municipal").first();
  await item.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);

  // --- 03 conversa com as caixas de confirmação ----------------------------
  await shot(page, "nexo-conversa-cartoes");

  // --- 04 canvas com as folhas ---------------------------------------------
  // O palco mostra as folhas lidas; rola até elas aparecerem.
  await page.mouse.move(720, 500);
  await page.waitForTimeout(800);
  await shot(page, "nexo-canvas-folhas");

  // --- 05 sidebar com histórico em pasta -----------------------------------
  await shot(page, "nexo-sidebar-historico", {
    clip: { x: 0, y: 0, width: 260, height: VIEW.height },
  });

  // --- telas de apoio -------------------------------------------------------
  for (const [rota, nome] of [
    ["/ferramentas", "ferramentas-antigas"],
    ["/projetos", "projetos"],
    ["/admin", "admin"],
    ["/ld", "legado-ld"],
    ["/capas", "legado-capas"],
    ["/separatrizes", "legado-separatrizes"],
    ["/volumes", "legado-volumes"],
  ]) {
    await page.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
    await shot(page, nome);
  }

  console.log(`\n${n} capturas em ${OUT}\n`);
} catch (err) {
  console.error(`FALHOU :: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
