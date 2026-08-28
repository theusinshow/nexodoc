// O LOTE DO ENVIO DE ACHADO, medido na tela.
//
//   node scripts/prova-envio-de-achado.mjs   (== npm run prova:envio)
//
// Três coisas foram pedidas em 25/08/2026 e feitas em 27/08, e as três só
// existem de verdade no navegador:
//
//   1. o "pop" do achado enviado — o retorno era mono cinza numa seção alheia;
//   2. seleção em massa — 22 cliques para mandar 22 achados;
//   3. o botão ENVIAR fora do menu `···`, irmão de "Decisão técnica".
//
// SEMEIA A AUDITORIA no banco. Disparar uma de verdade custaria minutos de
// modelo e não mediria nada disto — o que se testa aqui é a fila de ações, não
// o motor.
//
// A ARMADILHA DA LARGURA é medida junto: a fila de ações já quebrava em duas
// linhas no painel estreito do Nexo com TRÊS controles, e este lote pôs um
// quarto. A prova conta as linhas de verdade, pelas caixas dos botões — julgar
// isso por captura é o que já me deu falso positivo nesta tela.
import nextEnv from "@next/env";
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE =
  process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const AUDIT_ID = "qa-envio-de-achado";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();
const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul" },
  select: { id: true, code: true },
});
check("há projeto do escritório", Boolean(projeto), "rode npm run seed:dev");
if (!projeto) process.exit(1);

/*
 * SEIS achados, e não dois: a seleção em massa só diz alguma coisa quando o
 * número é grande o bastante para que marcar um a um incomode. Disciplinas
 * misturadas de propósito — é o caso em que o seletor de destinatário NÃO
 * sugere grupo, e o pop precisa continuar dizendo para quem foi.
 */
const incongruencias = Array.from({ length: 6 }, (_, i) => ({
  id: `INC-00${i + 1}`,
  prioridade: i < 2 ? "Alta" : "Media",
  pagina: String(10 + i),
  capitulo: i % 2 === 0 ? "PPCI" : "Hidrossanitário",
  local: `item ${i + 1}.2`,
  tipo: `Pendência de prova ${i + 1}`,
  descricao: "Semeado para medir a fila de ações.",
  evidencia: `trecho semeado ${i + 1}`,
  conflito: "regra semeada",
  sugestao_correcao: "Corrigir.",
  confianca: "alta",
  impacto: i < 2 ? "critico_documental" : "tecnico_contratual",
}));

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.audit.create({
  data: {
    id: AUDIT_ID,
    projectId: projeto.id,
    title: `Memorial ${projeto.code} — prova do envio`,
    projectName: projeto.code,
    auditMode: "memorial",
    status: "COMPLETED",
    totalFindings: incongruencias.length,
    report: {
      tipo_auditoria: "memorial",
      tipo_documento: "memorial descritivo",
      obra: "Prova do envio de achado",
      codigo: projeto.code,
      municipio: "Criciúma",
      status_analise: "concluida",
      status_geral: "NAO_EMITIR",
      total_incongruencias: incongruencias.length,
      arquivos_analisados: [],
      comparacoes: [],
      conclusao: "Semeado.",
      incongruencias,
    },
  },
});

/*
 * VIEWPORT ESTREITO de propósito: 1280 de largura deixa o palco do Nexo com
 * folga, e a fila de ações nunca quebraria. O painel real é apertado, e é lá
 * que o quarto controle podia doer.
 */
const browser = await chromium.launch();
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1100, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

await entrarComo(page, "victor@prosul.com");
await page.goto(`/nexo?auditoria=${encodeURIComponent(AUDIT_ID)}`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);

// O tour de 11 passos intercepta clique e dá timeout de 30s sem explicar por quê.
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(400);

await page
  .getByRole("button", { name: /achados/i })
  .first()
  .click();
await page.waitForTimeout(1200);

const palco = page.locator("main.nexo-shell__stage");

// --- 3. O botão ENVIAR está na FILA, e não escondido no menu.
const filaDoPrimeiro = palco.locator("[data-acoes-do-achado]").first();
check(
  "o botão Enviar aparece na fila de ações, sem abrir menu",
  (await filaDoPrimeiro.getByRole("button", { name: /^enviar$/i }).count()) ===
    1,
  await filaDoPrimeiro.innerText(),
);
check(
  "e a porta duplicada do menu `···` foi fechada",
  !/enviar para alguém/i.test(await palco.innerText()),
);

// A FILA NÃO PODE VIRAR TRÊS LINHAS. Conta as linhas pelas caixas: dois botões
// com o mesmo `y` estão na mesma linha. É o único jeito honesto — julgar por
// captura já me deu falso positivo nesta tela.
const linhasDaFila = await filaDoPrimeiro.evaluate((el) => {
  const ys = [...el.querySelectorAll("button")].map((b) =>
    Math.round(b.getBoundingClientRect().y),
  );
  return new Set(ys).size;
});
check(
  "e a fila com quatro controles cabe em até duas linhas",
  linhasDaFila <= 2,
  `${linhasDaFila} linhas`,
);

// --- 2. Seleção em massa.
const massa = palco.getByRole("button", { name: /^selecionar \d+ achados?$/i });
check("a linha de seleção em massa existe", (await massa.count()) === 1);
check(
  "e o rótulo traz o número do filtro atual",
  /selecionar 6 achados/i.test(await massa.first().innerText()),
  await massa.first().innerText(),
);

await massa.first().click();
await page.waitForTimeout(500);
const barra = await palco.innerText();
check(
  "um clique marcou os seis",
  /\b6\b\s*achados/i.test(barra),
  barra.replace(/\s+/g, " ").slice(0, 200),
);
check(
  "e o mesmo botão passa a desmarcar",
  (await palco.getByRole("button", { name: /^desmarcar 6$/i }).count()) === 1,
);

// --- 1. O pop.
//
// O destinatário sai do <select> da barra. `selectOption` pelo rótulo mantém a
// prova legível quando o e-mail mudar.
const seletor = palco.locator("select#destinatario-do-envio");
check(
  "a barra do rodapé traz o seletor de destinatário",
  (await seletor.count()) === 1,
);
await seletor.selectOption({ value: "milton@prosul.com" });
await palco
  .getByRole("button", { name: /enviar achados selecionados/i })
  .click();
await page.waitForTimeout(2500);

const pop = palco.locator("[data-pop]");
check("o pop apareceu depois do envio", (await pop.count()) === 1);
if (await pop.count()) {
  const texto = await pop.innerText();
  check(
    "com tom de sucesso",
    (await pop.getAttribute("data-pop")) === "ok",
    texto,
  );
  check("dizendo QUANTOS foram", /6 achados enviados/i.test(texto), texto);
  /*
   * O NOME DE QUEM RECEBEU. A frase antiga só dizia o número — e quem manda em
   * lote manda para pessoas diferentes na mesma sessão. Sem o nome, o aviso não
   * distingue um envio do seguinte.
   */
  check("e PARA QUEM", /milton/i.test(texto), texto);
  check(
    "e ele é anunciado a quem usa leitor de tela",
    (await pop.getAttribute("role")) === "status" &&
      (await pop.getAttribute("aria-live")) === "polite",
  );
}

// A seleção zerou, então a barra saiu — e o pop ficou no lugar dela.
check(
  "a barra de envio deu lugar ao pop",
  (await palco.locator("select#destinatario-do-envio").count()) === 0,
);

// E o envio chegou ao banco: sem isto, um pop bonito provaria só que a tela
// mente bem.
const linhas = await prisma.auditFeedback.findMany({
  where: { auditId: AUDIT_ID },
});
check(
  "os seis viraram linhas no banco",
  linhas.length === 6,
  `${linhas.length}`,
);

check("nenhum erro de página", erros.length === 0, erros.join(" | "));

await page.screenshot({
  path: `${process.env.SHOT_DIR ?? "."}/prova-envio-de-achado.png`,
  fullPage: false,
});

await browser.close();
await prisma.$disconnect();
console.log(falhas === 0 ? "\nPROVA DO ENVIO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
