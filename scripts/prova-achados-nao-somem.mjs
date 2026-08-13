// "O achado aparece num e some no outro" — a queixa, reproduzida e travada.
//
//   node scripts/prova-achados-nao-somem.mjs   (== npm run prova:achados-nao-somem)
//
// O QUE FOI REPRODUZIDO
//
// O roadmap mandava reproduzir antes de "unificar a fonte de dados", e a
// reprodução mudou o diagnóstico: não era divergência de estado entre o canvas
// e a lista. Era o RÓTULO falando de outro conjunto.
//
// Semeados seis achados, dois deles de confiança baixa. A aba dizia "Achados 6"
// e a lista entregava QUATRO — os dois rebaixados estão na seção recolhível
// "Sugestões da IA", que é uma decisão de projeto e não um defeito. Quem
// confere um parecer conta os cartões, não acha os dois que faltam, e conclui
// que o software perdeu achado.
//
// Esta tela já pagou por esse erro uma vez: o cartão de veredito dizia "3
// críticas" enquanto a matriz mostrava 2. Dois números para a mesma pergunta é
// pior que qualquer um dos dois estar errado.
//
// A segunda metade prova o filtro de GRAVIDADE, que era o que faltava dos três
// (disciplina e tipo já existiam) — e prova que ele filtra a lista de verdade,
// não só acende o chip.
import { chromium } from "playwright";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

// Quatro sólidos + dois de confiança baixa (que a lista manda para "Sugestões").
const SOLIDOS = 4;
const SUGESTOES = 2;

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

const cardsNaLista = () => page.locator("[data-achado]").count();

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(1500);

  await page.evaluate(async () => {
    const convId = "qa-achados-nao-somem";
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const base = (n, extra) => ({
      id: `INC-${String(n).padStart(3, "0")}`,
      prioridade: "Media",
      pagina: String(n),
      capitulo: "",
      local: "",
      tipo: "Divergência",
      descricao: "Achado semeado.",
      evidencia: `trecho ${n}`,
      conflito: "Diverge.",
      sugestao_correcao: "Corrigir.",
      confianca: "alta",
      origem: "ia",
      impacto: "tecnico_contratual",
      ...extra,
    });
    const incongruencias = [
      // Um de cada faixa, para o filtro de gravidade ter o que separar.
      base(1, { impacto: "critico_documental", tipo: "Nome de obra divergente" }),
      base(2, { impacto: "tecnico_contratual", tipo: "Norma desatualizada" }),
      base(3, { impacto: "revisao_editorial", tipo: "Erro de grafia" }),
      base(4, { impacto: "revisao_editorial", tipo: "Pontuação" }),
      // Confiança baixa => camada "sugestao": some da lista principal.
      base(5, { confianca: "baixa" }),
      base(6, { confianca: "baixa" }),
    ];
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA ACHADOS NAO SOMEM",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:qa-achados",
            kind: "auditoria",
            summary: "Auditoria",
            files: [],
            payload: {
              auditId: "qa-achados",
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
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("QA ACHADOS NAO SOMEM", { exact: false }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);
  const chip = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chip.count()) > 0) await chip.first().click();
  await page.waitForTimeout(1200);

  // --- 1. o rótulo conta o que a lista mostra ------------------------------
  const abaAchados = page.getByRole("button", { name: /^Achados/i }).first();
  const rotulo = (await abaAchados.innerText()).replace(/\s+/g, " ").trim();
  const numeroNoRotulo = Number.parseInt(rotulo.replace(/\D+/g, ""), 10);
  check(
    `a aba promete ${SOLIDOS}, não o total cru de ${SOLIDOS + SUGESTOES}`,
    numeroNoRotulo === SOLIDOS,
    `rótulo="${rotulo}"`,
  );

  await abaAchados.click();
  await page.waitForTimeout(1500);
  const naLista = await cardsNaLista();
  check("e a lista entrega exatamente esse número", naLista === numeroNoRotulo, `lista=${naLista}`);
  await page.screenshot({ path: `${OUT}/achados-1-contagem-bate.png` });

  // --- 2. o filtro de gravidade -------------------------------------------
  const chipsGravidade = page.locator("[data-filtro-gravidade]");
  check(
    "há um chip por faixa presente no parecer",
    (await chipsGravidade.count()) === 3,
    `chips=${await chipsGravidade.count()}`,
  );

  const soEditorial = page.locator('[data-filtro-gravidade="revisao_editorial"]');
  await soEditorial.click();
  await page.waitForTimeout(1000);
  const filtrado = await cardsNaLista();
  check("filtrar por revisão de texto deixa só os dois editoriais", filtrado === 2, `lista=${filtrado}`);
  check(
    "e os cartões restantes SÃO daquela faixa",
    (await page.locator('[data-achado][data-impacto="revisao_editorial"]').count()) === 2,
  );

  // Somar faixas soma achados — o filtro é união, não troca.
  await page.locator('[data-filtro-gravidade="critico_documental"]').click();
  await page.waitForTimeout(1000);
  check("marcar duas faixas soma as duas", (await cardsNaLista()) === 3, `lista=${await cardsNaLista()}`);

  // --- 3. limpar devolve tudo ---------------------------------------------
  await page.getByRole("button", { name: /limpar filtros/i }).click();
  await page.waitForTimeout(1000);
  check("limpar filtros devolve a lista inteira", (await cardsNaLista()) === SOLIDOS);
  await page.screenshot({ path: `${OUT}/achados-2-filtro-gravidade.png` });

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/achados-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
