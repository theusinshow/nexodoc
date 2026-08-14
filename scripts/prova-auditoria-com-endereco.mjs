// Auditoria sem projeto deixou de existir.
//
//   node scripts/prova-auditoria-com-endereco.mjs   (== npm run prova:endereco)
//
// Era o caminho do Nexo — a interface principal — e era ele que produzia parecer
// sem dono, sem escritório e sem endereço. É o chão onde nenhum achado
// atribuível pode nascer: fila, gate de emissão e linhagem entre versões são
// todos POR PROJETO.
//
// A rota tambem nao exigia SESSAO quando nao vinha projeto, porque a
// autenticacao morava dentro do `if (projectId)`. As duas coisas se resolveram
// na mesma mudanca, e as duas sao medidas aqui.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";

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
  where: { organizationId: "org-prosul", code: "063-26" },
  select: { id: true },
});
check("o 063-26 existe para a prova usar", Boolean(projeto), "rode npm run seed:dev");

const browser = await chromium.launch();

/*
 * Um PDF mínimo de verdade.
 *
 * A rota recusa por falta de arquivo ANTES de olhar o projeto, então um
 * formulário sem anexo mediria a validação errada — foi o que aconteceu na
 * primeira versão desta prova, que passava por 400 e parecia certa. O conteúdo
 * não importa: nenhuma asserção daqui chega a ler o documento.
 */
const PDF_MINIMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);

function formulario(extras = {}) {
  return {
    message: "Auditoria de prova.",
    auditMode: "memorial",
    analysisLevel: "standard",
    fileTypes: "memorial",
    files: {
      name: "memorial-de-prova.pdf",
      mimeType: "application/pdf",
      buffer: PDF_MINIMO,
    },
    ...extras,
  };
}

// --- Sem sessão.
const anonimo = await browser.newContext({ baseURL: BASE });
const semSessao = await anonimo.request.post("/api/audit", {
  multipart: formulario(),
});
check(
  "sem sessao a auditoria e recusada",
  [401, 403].includes(semSessao.status()),
  `status ${semSessao.status()}`,
);

// --- Com sessão, sem projeto.
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
page.setDefaultTimeout(25000);
await entrarComo(page, "milton@prosul.com");

const semProjeto = await page.request.post("/api/audit", {
  multipart: formulario(),
});
check(
  "com sessao e sem projeto, tambem e recusada",
  semProjeto.status() === 400,
  `status ${semProjeto.status()}`,
);

const corpo = await semProjeto.text();
check(
  "e a recusa explica o que falta",
  /projeto|centro de custo/i.test(corpo),
  corpo.slice(0, 120),
);

// --- Projeto de outro escritório não serve de endereço.
const doFantasma = await prisma.project.findFirst({
  where: { organizationId: "org-fantasma" },
  select: { id: true },
});

if (doFantasma) {
  const alheio = await page.request.post("/api/audit", {
    multipart: formulario({ projectId: doFantasma.id }),
  });
  check(
    "projeto de outro escritorio nao serve de endereco",
    alheio.status() === 404,
    `status ${alheio.status()}`,
  );
} else {
  console.log("  PULA    projeto do escritorio fantasma (rode prova:escritorio antes)");
}

/*
 * O caminho FELIZ não é medido aqui de propósito: ele dispara uma auditoria de
 * verdade, que custa modelo e leva minutos. O que esta prova garante é o
 * contrário — que nenhum parecer nasça sem endereço. O caminho feliz é medido
 * por `prova:auditoria`, que já existe e roda em modo simulado.
 */

await browser.close();
console.log(falhas === 0 ? "\nOK  auditoria com endereco" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
