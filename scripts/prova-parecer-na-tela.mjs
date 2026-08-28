// O PARECER EM PDF, do menu até os bytes.
//
//   node scripts/prova-parecer-na-tela.mjs   (== npm run prova:parecer-tela)
//
// `prova:parecer` já mede o DESENHO (gera e relê o PDF, sem servidor). Aqui se
// mede o caminho: a rota recusa quem não tem sessão, aceita quem tem, e o item
// existe no menu Exportar da tela — que é por onde o engenheiro chega nele.
//
// Semeia a auditoria no banco: disparar uma de verdade custaria minutos de
// modelo e não mediria nada disto.
import nextEnv from "@next/env";
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE =
  process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const AUDIT_ID = "qa-parecer-em-pdf";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

const prisma = getPrisma();
const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul" },
  select: { id: true, code: true },
});
check("há projeto do escritório", Boolean(projeto), "rode npm run seed:dev");
if (!projeto) process.exit(1);

const report = {
  tipo_auditoria: "memorial",
  tipo_documento: "memorial descritivo",
  // O nome NAO pode conter o texto que a prova procura: a primeira versao
  // chamava a obra de "Prova do parecer em PDF" e a assercao passava lendo o
  // cabecalho do proprio parecer, com o menu fechado.
  obra: "Obra semeada da prova",
  codigo: projeto.code,
  municipio: "Criciuma",
  data_documento: "10/2025",
  status_analise: "concluida",
  status_geral: "com inconsistências críticas",
  total_incongruencias: 2,
  arquivos_analisados: [],
  comparacoes: [],
  conclusao: "Semeado.",
  incongruencias: [
    {
      id: "INC-001",
      prioridade: "Alta",
      pagina: "12",
      capitulo: "PPCI",
      local: "",
      tipo: "Saída de emergência sem largura",
      descricao: "Falta a largura.",
      evidencia: "a saída deverá atender ao previsto",
      conflito: "NBR 9077",
      sugestao_correcao: "Declarar a largura.",
      confianca: "alta",
      impacto: "critico_documental",
    },
    {
      id: "INC-002",
      prioridade: "Media",
      pagina: "31",
      capitulo: "Estrutural",
      local: "",
      tipo: "Tabela sem unidade",
      descricao: "Sem unidade.",
      evidencia: "carga acidental de 250",
      conflito: "unidade ausente",
      sugestao_correcao: "Informar kN/m2.",
      confianca: "alta",
      impacto: "tecnico_contratual",
    },
  ],
};

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.audit.create({
  data: {
    id: AUDIT_ID,
    projectId: projeto.id,
    title: "Parecer em PDF — prova",
    projectName: projeto.code,
    auditMode: "memorial",
    status: "COMPLETED",
    totalFindings: 2,
    report,
  },
});

const browser = await chromium.launch();

// --- A rota, sem sessão.
const anonimo = await browser.newContext({ baseURL: BASE });
const semSessao = await anonimo.request.post("/api/nexo/parecer", {
  data: { report },
});
check(
  "sem sessao a rota do parecer recusa",
  [401, 403].includes(semSessao.status()),
  `status ${semSessao.status()}`,
);

// --- A rota, com sessão.
const ctx = await browser.newContext({
  baseURL: BASE,
  viewport: { width: 1100, height: 900 },
});
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
await entrarComo(page, "victor@prosul.com");

const vazio = await page.request.post("/api/nexo/parecer", { data: {} });
check(
  "corpo sem relatorio da 400, e nao 500",
  vazio.status() === 400,
  `status ${vazio.status()}`,
);

const ok = await page.request.post("/api/nexo/parecer", { data: { report } });
check(
  "com sessao e relatorio, responde 200",
  ok.status() === 200,
  `status ${ok.status()}`,
);
check(
  "e o tipo e PDF",
  (ok.headers()["content-type"] ?? "").includes("application/pdf"),
);
const corpo = await ok.body();
check(
  "os bytes sao mesmo um PDF",
  corpo.subarray(0, 5).toString() === "%PDF-",
  corpo.subarray(0, 8).toString(),
);
check(
  "com tamanho de peca, e nao de casca",
  corpo.length > 1500,
  `${corpo.length} bytes`,
);
check(
  "o nome do arquivo carrega obra e codigo",
  /filename="parecer-.*obra-semeada-da-prova\.pdf"/.test(
    ok.headers()["content-disposition"] ?? "",
  ),
  ok.headers()["content-disposition"],
);
check(
  "abre para conferir (inline), e nao baixa as cegas",
  (ok.headers()["content-disposition"] ?? "").startsWith("inline"),
);

// --- O caminho da tela.
await page.goto(`/nexo?auditoria=${encodeURIComponent(AUDIT_ID)}`);
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);
const pular = page.getByRole("button", { name: /pular/i });
if (await pular.count()) await pular.first().click();
await page.waitForTimeout(400);

const palco = page.locator("main.nexo-shell__stage");
await palco
  .getByRole("button", { name: /exportar/i })
  .first()
  .click();
await page.waitForTimeout(500);
/*
 * O MENU SAI POR PORTAL, direto no `document.body` — ler o palco depois do
 * clique devolvia a tela SEM o menu, e a primeira versão desta prova passava
 * porque o nome da obra semeada continha "parecer em PDF". Espera-se o
 * `role="menu"` aparecer, e lê-se ELE.
 */
const menu = page.locator('[role="menu"]').last();
await menu.waitFor({ state: "visible", timeout: 8000 });
const itens = await menu.innerText();
check(
  "o menu Exportar oferece o parecer em PDF",
  /parecer em pdf/i.test(itens),
  itens.slice(0, 300),
);
console.log("MENU:", JSON.stringify(itens.replace(/\s+/g, " ").slice(0, 400)));
check(
  "e ele vem ANTES dos copiar — e a peca, nao mais um texto",
  itens.search(/parecer em pdf/i) < itens.search(/copiar resposta/i),
);

await browser.close();
await prisma.$disconnect();
console.log(
  falhas === 0 ? "\nPROVA DO PARECER NA TELA OK" : `\n${falhas} FALHA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
