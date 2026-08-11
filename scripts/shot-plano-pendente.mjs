// O ESTADO "ALTERAÇÃO PENDENTE" DO PLANO, EM TELA.
//
// O teste unitário (test:nexo:plano-pendente) prova a LÓGICA: mudou o volume,
// a prefeitura ou a data depois de gerar => pendente. Ele não prova que a tela
// mostra isso. Este script prova — e a distinção importa neste projeto, porque
// asserção de DOM já passou verde com painel fora da tela.
//
// NÃO GASTA TOKEN: semeia duas conversas no IndexedDB, uma com o payload igual
// aos params (em dia) e outra com o volume trocado depois de gerar (pendente).
// Nenhuma chamada a modelo, nenhuma geração de documento.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-plano-pendente.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/plano-pendente";

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  console.log(`  ${ok ? "ok  " : "FALHOU"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

/** Selos com nome de arquivo no padrão do escritório: código 042-26. */
const SELOS = [1, 2, 3, 4].map((n) => ({
  fileName: `042_26_arq_${n}_a.pdf`,
  pageNumber: 1,
  pageCount: 1,
  extraction: {
    total: 4,
    arquivo: null,
    cliente: "Prefeitura Municipal de Criciuma",
    secretaria: "Secretaria Municipal de Educacao",
    obra: "Escola Municipal Vila Nova",
    fase: "Projeto Executivo",
    tituloSecao: null,
    data: "MARCO/2026",
    logoOrgao: "Prefeitura Municipal de Criciuma",
    confianca: "alta",
    disciplina: "Arquitetura",
    folha: n,
    numeroFolha: `0${n}/04`,
    conteudo: "Planta baixa",
  },
  usage: 0,
}));

const PARAMS = {
  templateId: "pmcriciuma",
  tituloCapa: "PROJETO ARQUITETONICO",
  volume: "I",
  mes: "03",
  ano: "2026",
  numTomos: 1,
  tomoInicial: 1,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForTimeout(2500);

  // Nunca mais o tour por cima do que queremos ver.
  await page.evaluate(() => localStorage.setItem("nexo:tour-visto", "1"));

  /**
   * Semeia UMA conversa e devolve o id. `payloadGerado` é o que ficou gravado
   * quando o documento saiu; os params do card são sempre PARAMS. Iguais = em
   * dia; diferentes = o engenheiro mexeu depois de gerar.
   */
  async function semear(convId, titulo, payloadGerado) {
    return page.evaluate(
      async ({ convId, titulo, payloadGerado, SELOS, PARAMS }) => {
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
            title: titulo,
            createdAt: agora,
            updatedAt: agora,
            messages: [
              { id: `${convId}-1`, role: "user", content: "monta o volume" },
              {
                id: `${convId}-2`,
                role: "assistant",
                content: "Preparei a capa do volume.",
                proposals: [{ kind: "capa", params: PARAMS }],
              },
            ],
            seloResults: SELOS,
            results: payloadGerado
              ? [
                  {
                    artifactId: "capa:042-26",
                    kind: "capa",
                    summary: "Capa do volume",
                    payload: payloadGerado,
                    canvas: {
                      label: "CAPA",
                      detail: "042-26 · rev. A",
                      titulo: "Escola Municipal Vila Nova",
                      pageNumber: 1,
                    },
                    files: [],
                    generatedAt: agora,
                  },
                ]
              : [],
          });
          tx.oncomplete = () => res();
          tx.onerror = () => rej(tx.error);
        });
        return convId;
      },
      { convId, titulo, payloadGerado, SELOS, PARAMS },
    );
  }

  /** Abre a conversa pela barra lateral e lê o card do plano. */
  async function abrir(convId, nome) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const item = page.getByText(nome, { exact: false }).first();
    if (await item.count()) {
      await item.click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    return page.locator("text=documento").first();
  }

  // ---------------------------------------------------------------- em dia
  // tomoNumero = tomoInicial + i => 1 com numTomos:1. Semear tomo:0 aqui
  // faria o card dizer pendente com razao -- foi o que a tela mostrou primeiro.
  await semear("qa-plano-emdia", "QA em dia", { ...PARAMS, tomo: 1 });
  await abrir("qa-plano-emdia", "QA em dia");
  const textoEmDia = await page.locator("body").innerText();
  await page.screenshot({ path: path.join(OUT, "01-em-dia.png") });
  check(
    "com o payload igual aos params, o card diz Gerado (o texto vem MAIUSCULO: LABEL_CLASS tem uppercase e innerText reflete text-transform)",
    /Gerado/i.test(textoEmDia) && !/Alteração pendente/i.test(textoEmDia),
    textoEmDia.match(/(Gerado|Vou gerar|Alteração pendente)[^\n]*/)?.[0] ?? "nada",
  );

  // ------------------------------------------------------------- pendente
  // Gerou com o volume I; o engenheiro passou para VI depois.
  await semear("qa-plano-pendente", "QA pendente", {
    ...PARAMS,
    volume: "VI",
    tomo: 1,
  });
  await abrir("qa-plano-pendente", "QA pendente");
  const textoPendente = await page.locator("body").innerText();
  await page.screenshot({ path: path.join(OUT, "02-pendente.png") });

  check(
    "mudou o volume depois de gerar: o card diz Alteração pendente",
    /Alteração pendente/i.test(textoPendente),
    textoPendente.match(/(Gerado|Vou gerar|Alteração pendente)[^\n]*/)?.[0] ?? "nada",
  );
  check(
    "o botão chama para atualizar, não para 'gerar de novo'",
    /Atualizar 1 documento/i.test(textoPendente),
  );
  check(
    "a frase 'Prontos no canvas' NÃO aparece — era ela que dava a confiança errada",
    !/Prontos no canvas/i.test(textoPendente),
  );
  check(
    "o aviso explica que o que está no canvas não vale",
    /não vale até atualizar/i.test(textoPendente),
  );

  // DENTRO DA JANELA, nao so no DOM. Este projeto ja viu assercao de DOM passar
  // verde com o painel fora da tela -- por isso a caixa e medida contra a janela.
  const vp = page.viewportSize();
  for (const [nome, re] of [
    ["o rotulo ALTERACAO PENDENTE", /Altera..o pendente/i],
    ["o aviso de que o canvas nao vale", /n.o vale at. atualizar/i],
  ]) {
    const el = page.getByText(re).first();
    if (!(await el.count())) {
      check(`${nome} esta visivel na janela`, false, "nao achei o texto");
      continue;
    }
    const box = await el.boundingBox();
    check(
      `${nome} esta visivel na janela, nao fora da tela`,
      Boolean(box) && box.y >= 0 && box.y + box.height <= vp.height && box.x >= 0,
      box ? `y=${Math.round(box.y)}..${Math.round(box.y + box.height)} de ${vp.height}` : "sem caixa",
    );
  }

  check("nenhum erro de página", erros.length === 0, erros[0] ?? "");
  console.log(`\n  retratos em ${path.resolve(OUT)}`);
} finally {
  await browser.close();
}

if (falhas > 0) {
  console.error(`\n${falhas} verificação(ões) falharam`);
  process.exitCode = 1;
} else {
  console.log("\nO plano mostra o estado pendente em tela.");
}
