// O CHAT DA AUDITORIA APARECE, LÊ E MOSTRA O ACHADO NOVO — sem gastar token.
//
//   node scripts/prova-chat-advogado.mjs   (== npm run prova:chat-advogado)
//
// O `/api/audit/chat` é INTERCEPTADO e devolve um SSE roteirizado. O que se
// prova aqui é o lado do CLIENTE: que a pergunta foi para a porta certa, que o
// achado novo entra no parecer gravado, e que a resposta cabe na janela.
//
// A última asserção é a que costuma pegar defeito: uma bolha que existe no DOM
// e nasce abaixo do fim da janela passa em qualquer teste de seletor e é
// invisível para quem está usando. Aqui a caixa é medida contra a janela.
import { chromium } from "playwright";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const CONV = "qa-chat-advogado";

const ACHADO_NOVO = {
  id: "INC-002",
  arquivo: "qa.pdf",
  prioridade: "Media",
  pagina: "41",
  capitulo: "1 - PAREDES",
  local: "",
  tipo: "Traco de argamassa divergente",
  descricao: "O traco declarado nao bate com a norma citada.",
  evidencia: 'Pagina 41: "argamassa de cimento e areia no traco 1:3"',
  conflito: "A norma exige 1:4.",
  sugestao_correcao: "Uniformizar o traco.",
  confianca: "media",
  origem: "chat",
  impacto: "tecnico_contratual",
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const erros = [];
const chamadas = [];
page.on("pageerror", (e) => erros.push(String(e)));

// A porta do chat da auditoria, encenada. Nenhum token é gasto.
await page.route("**/api/audit/chat", async (route) => {
  const corpo = JSON.parse(route.request().postData() ?? "{}");
  chamadas.push(corpo);

  const report = {
    ...corpo.report,
    total_incongruencias: (corpo.report?.incongruencias?.length ?? 0) + 1,
    incongruencias: [...(corpo.report?.incongruencias ?? []), ACHADO_NOVO],
  };

  const eventos = [
    { type: "ferramenta", nome: "buscar_no_memorial", resumo: 'procurando "argamassa"' },
    { type: "ferramenta", nome: "ler_paginas", resumo: "lendo as páginas 41-42" },
    { type: "achado", achado: ACHADO_NOVO, report },
    {
      type: "delta",
      text: "Encontrei um problema que o parecer nao trazia: na PAGINA 41 o traco da argamassa e 1:3, e a norma citada no capitulo 1 exige 1:4. Registrei como INC-002.",
    },
    { type: "done", voltas: 3, parouPorTeto: false },
  ];

  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    body: eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
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

  // Semeia uma conversa COM parecer: é isso que abre a porta do chat da auditoria.
  await page.evaluate(async (convId) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const report = {
      tipo_auditoria: "memorial",
      tipo_documento: "memorial descritivo",
      obra: "QA ADVOGADO",
      codigo: "000-00",
      municipio: "",
      data_documento: "",
      status_analise: "concluida",
      status_geral: "com pontos de revisão",
      total_incongruencias: 1,
      arquivos_analisados: [],
      comparacoes: [],
      conclusao: ".",
      incongruencias: [
        {
          id: "INC-001",
          arquivo: "qa.pdf",
          prioridade: "Alta",
          pagina: "44",
          capitulo: "3 - COBERTURA",
          local: "",
          tipo: "Espessura de telha divergente",
          descricao: "Semeado.",
          evidencia: 'Pagina 44: "telha de 30mm"',
          conflito: "A prancha indica 50mm.",
          sugestao_correcao: "Uniformizar.",
          confianca: "alta",
          origem: "ia",
          impacto: "critico_documental",
        },
      ],
    };
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA CHAT ADVOGADO",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:qa-advogado",
            kind: "auditoria",
            summary: "Auditoria",
            files: [],
            generatedAt: agora,
            payload: { auditId: "qa-advogado", texto: "RESULTADO", report },
          },
        ],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }, CONV);

  /*
   * A CONVERSA SE ABRE CLICANDO NA BARRA, e não por parâmetro de URL: `?conversa=`
   * não existe. Com ele, o aplicativo abria uma conversa NOVA e vazia, o parecer
   * não estava no palco e o turno ia — corretamente — para o agente do Nexo.
   * O defeito estava nesta prova, não no roteamento.
   */
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByText("QA CHAT ADVOGADO", { exact: false }).first().click({ timeout: 15000 });
  await page.waitForTimeout(2500);

  const campo = page.locator("textarea").first();
  await campo.fill("Voce concorda com o INC-001? Procure erro que o motor deixou passar.");
  await campo.press("Enter");
  await page.waitForTimeout(3000);

  check("a pergunta foi para /api/audit/chat, e nao para o agente", chamadas.length === 1);
  check(
    "o corpo levou o auditId e o parecer",
    chamadas[0]?.auditId === "qa-advogado" && Array.isArray(chamadas[0]?.report?.incongruencias),
    JSON.stringify(Object.keys(chamadas[0] ?? {})),
  );

  const bolha = page.getByText(/PAGINA 41/i).first();
  const apareceu = (await bolha.count()) > 0;
  check("a resposta chegou na tela", apareceu);

  // A ASSERÇÃO QUE PEGA DEFEITO: a caixa contra a janela.
  if (apareceu) {
    const caixa = await bolha.boundingBox();
    const janela = page.viewportSize();
    check(
      "a resposta esta DENTRO da janela, e nao so no DOM",
      caixa && caixa.y >= 0 && caixa.y + caixa.height <= janela.height && caixa.width > 0,
      JSON.stringify({ caixa, janela }),
    );
  }

  // O achado novo entrou no parecer que a tela desenha.
  const gravado = await page.evaluate(async (convId) => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
    });
    const conv = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const req = tx.objectStore("conversations").get(convId);
      req.onsuccess = () => res(req.result);
    });
    const auditoria = (conv?.results ?? []).find((r) => r.kind === "auditoria");
    return (auditoria?.payload?.report?.incongruencias ?? []).map((f) => ({
      id: f.id,
      origem: f.origem,
    }));
  }, CONV);

  check(
    "o achado nascido no chat foi gravado no IndexedDB com origem chat",
    gravado.some((f) => f.id === "INC-002" && f.origem === "chat"),
    JSON.stringify(gravado),
  );

  check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));
  await page.screenshot({ path: `${OUT}/chat-advogado.png`, fullPage: false });
} finally {
  await browser.close();
}

console.log(falhas === 0 ? "\nPROVA OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
