// A validação do achado: procedente, falso positivo e corrigido.
//
//   node scripts/prova-validacao-do-achado.mjs   (== npm run prova:validacao-do-achado)
//
// O QUE ESTA PROVA MEDE, E POR QUE ASSIM
//
// "Corrigido" vivia só no IndexedDB desta máquina. Quem revisasse metade do
// parecer no escritório e abrisse em casa recomeçava a marcar do zero. Agora a
// marcação também vai para `AuditFeedback`, na mesma linha do veredito e em
// coluna própria (`resolvedAt`) — as duas perguntas são independentes.
//
// A ROTA DE FEEDBACK É INTERCEPTADA, e é de propósito. Esta máquina não tem
// `DATABASE_URL`, então um teste "de verdade" aqui só provaria que a rota
// devolve 503. Interceptando, o que se mede é o CONTRATO do cliente, que é
// justamente onde mora o risco:
//
//  · ele LÊ `resolvedAt` de uma linha que a conversa local não conhece — o
//    cenário "abri em outra máquina", que era o defeito;
//  · ele LÊ o veredito e o mostra como etiqueta no cabeçalho do achado, em vez
//    de escondê-lo num botão aceso no fim do cartão;
//  · ele ESCREVE `{ resolved: true }` ao marcar corrigido.
//
// O que continua SEM PROVA aqui, e está dito no commit: a ida ao Postgres.
// Depende de um banco, e esta máquina não tem nenhum.
//
// Nenhuma chamada de modelo: o parecer é semeado no IndexedDB.
import { chromium } from "playwright";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

const AUDIT_ID = "qa-validacao-do-achado";
// O achado que o SERVIDOR já conhece — corrigido e julgado procedente noutra
// máquina. A conversa semeada não sabe de nenhum dos dois.
const REF_DO_SERVIDOR = "INC-002";
// O achado virgem, que será marcado aqui.
const REF_LOCAL = "INC-001";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

/** O que o cliente MANDOU para a rota — é o outro lado do contrato. */
const gravacoes = [];

await page.route("**/api/audits/*/feedback", async (route) => {
  const req = route.request();

  if (req.method() === "GET") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        feedback: [
          {
            id: "f1",
            findingId: REF_DO_SERVIDOR,
            verdict: "CONFIRMED",
            resolvedAt: "2026-08-13T12:00:00.000Z",
            note: "",
          },
        ],
      }),
    });
    return;
  }

  gravacoes.push(JSON.parse(req.postData() ?? "{}"));
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ feedback: {} }),
  });
});

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(1500);

  // --- semeia um parecer com três achados ---------------------------------
  await page.evaluate(async (auditId) => {
    const convId = "qa-validacao-do-achado";
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const incongruencias = [1, 2, 3].map((n) => ({
      id: `INC-${String(n).padStart(3, "0")}`,
      prioridade: "Media",
      pagina: String(n * 3),
      capitulo: "",
      local: "",
      tipo: "Redação / editorial",
      descricao: `Achado semeado ${n}.`,
      evidencia: `trecho de conferencia ${n}`,
      conflito: "Diverge do declarado.",
      sugestao_correcao: "Conferir e corrigir.",
      confianca: "alta",
      origem: "ia",
      impacto: "revisao_editorial",
    }));
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA VALIDACAO DO ACHADO",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
        seloResults: [],
        // A conversa NÃO tem `achadosResolvidos`: é a máquina que nunca marcou
        // nada, e é ela que precisa aprender com o servidor.
        results: [
          {
            artifactId: "auditoria:qa-validacao",
            kind: "auditoria",
            summary: "Auditoria do memorial",
            files: [],
            payload: {
              auditId,
              texto: "RESULTADO DA AUDITORIA",
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
                conclusao: "Parecer semeado.",
                incongruencias,
              },
            },
          },
        ],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }, AUDIT_ID);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page
    .getByText("QA VALIDACAO DO ACHADO", { exact: false })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(2000);

  const chipAuditoria = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chipAuditoria.count()) > 0) await chipAuditoria.first().click();
  const abaAchados = page.getByRole("button", { name: /^Achados/i }).first();
  if ((await abaAchados.count()) > 0) await abaAchados.click();
  await page.waitForTimeout(1500);

  const cartao = (ref) => page.locator(`[data-achado="${ref}"]`);
  /*
   * A BARRA DE AÇÕES É IRMÃ DO CARTÃO, e não filha — desde a reorganização do
   * desenho dos achados (7f53b3c), o que se FAZ com o achado fica acima dele.
   * Procurar o botão dentro de `[data-achado]` fazia esta prova esperar 30s por
   * um elemento que existe na tela, em outro galho do DOM.
   */
  const acoes = (ref) => page.locator(`[data-acoes-do-achado="${ref}"]`);
  check("o parecer montou com os achados semeados", (await cartao(REF_LOCAL).count()) > 0);
  check("e a barra de ações do achado sabe de quem é", (await acoes(REF_LOCAL).count()) > 0);

  // --- 1. o que o servidor sabia e a máquina não --------------------------
  /*
   * Este é o defeito que a etapa corrige. A conversa desta máquina nunca marcou
   * nada; a marca veio da linha do banco. Se o cliente ignorasse `resolvedAt`,
   * o cartão apareceria pendente — que era o comportamento antigo.
   */
  check(
    "achado corrigido em OUTRA máquina volta marcado",
    (await cartao(REF_DO_SERVIDOR).getAttribute("data-resolvido")) !== null,
    "data-resolvido ausente",
  );

  const veredito = cartao(REF_DO_SERVIDOR).locator("[data-veredito]");
  check("o veredito gravado vira etiqueta no cabeçalho", (await veredito.count()) > 0);
  check(
    "e a etiqueta diz qual foi",
    /procedente/i.test((await veredito.first().innerText().catch(() => "")) || ""),
    await veredito.first().innerText().catch(() => "(sem texto)"),
  );

  // O achado virgem não pode ter herdado nada disto.
  check(
    "achado sem registro continua pendente",
    (await cartao(REF_LOCAL).getAttribute("data-resolvido")) === null &&
      (await cartao(REF_LOCAL).locator("[data-veredito]").count()) === 0,
  );
  await page.screenshot({ path: `${OUT}/validacao-1-vindo-do-servidor.png` });

  // --- 2. marcar aqui grava nos dois lugares ------------------------------
  const antes = gravacoes.length;
  await acoes(REF_LOCAL).getByRole("button", { name: /Marcar corrigido/i }).click();
  await page.waitForTimeout(1200);

  check(
    "marcar corrigido pinta o cartão na hora",
    (await cartao(REF_LOCAL).getAttribute("data-resolvido")) !== null,
  );

  const gravado = gravacoes.slice(antes).find((g) => g.findingId === REF_LOCAL);
  check("a marcação foi ao servidor", Boolean(gravado), JSON.stringify(gravacoes.slice(antes)));
  check(
    "e foi como 'resolved', não como veredito",
    gravado?.resolved === true && gravado?.verdict === undefined,
    JSON.stringify(gravado ?? {}),
  );

  // --- 3. desmarcar desfaz dos dois lados ---------------------------------
  const antesDeDesmarcar = gravacoes.length;
  await acoes(REF_LOCAL).getByRole("button", { name: /^Corrigido/i }).click();
  await page.waitForTimeout(1200);

  check(
    "desmarcar limpa o cartão",
    (await cartao(REF_LOCAL).getAttribute("data-resolvido")) === null,
  );
  check(
    "e avisa o servidor com resolved: false",
    gravacoes.slice(antesDeDesmarcar).some((g) => g.findingId === REF_LOCAL && g.resolved === false),
    JSON.stringify(gravacoes.slice(antesDeDesmarcar)),
  );
  await page.screenshot({ path: `${OUT}/validacao-2-marcado-e-desmarcado.png` });

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/validacao-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
