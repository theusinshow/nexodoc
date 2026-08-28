/**
 * A ÚNICA prova do chat advogado do diabo que paga modelo.
 *
 *   PROVA_PAGA=1 node scripts/prova-chat-com-token.mjs   (== npm run prova:chat-token)
 *
 * Ela existe para responder o que nenhum teste puro responde: **a página que o
 * chat cita bate com o documento?** Tudo o mais já está provado de graça
 * (`test:ancoragem`, `test:memoria`, `test:chat:*`, `prova:chat-advogado`).
 *
 * O roteiro em `scripts/prova-chat-com-token.md` mandava conferir a olho, abrindo
 * o PDF na página citada. Isso foi trocado por conferência automática pelo mesmo
 * motivo que o produto inteiro existe: julgamento humano cansado erra número de
 * página, e uma prova que só passa quando alguém tem paciência não roda duas
 * vezes. O gabarito é extraído aqui com **pdfjs cru** — nenhum módulo do produto
 * participa da conferência, senão o defeito e o juiz seriam o mesmo código.
 *
 * CUSTO, medido em 27/08/2026 no `AiUsageEvent`: auditoria de memorial em
 * `standard` roda no `gpt-5.6-terra` e custou US$ 0,25; em `deep` roda no
 * `gpt-5.6-sol` e custou US$ 1,95 — 8x. **Esta prova roda em `standard` de
 * propósito.** As perguntas medem se a página citada bate, e a página sai de
 * ferramenta determinística sobre o texto guardado; profundidade de leitura do
 * motor não muda essa resposta.
 *
 * O teto do ambiente NÃO protege esta corrida: sem `NEXODOC_MONTHLY_BUDGET_USD`
 * não há teto, e quem administra é isento do bloqueio de propósito
 * (`isentoDoTeto`). Por isso a prova imprime o gasto antes e depois — quem
 * segura o orçamento é quem lê a saída.
 */
import { readFileSync } from "node:fs";

import nextEnv from "@next/env";
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

if (process.env.PROVA_PAGA !== "1") {
  console.error(
    "\nEsta prova PAGA MODELO e não roda por acidente.\n" +
      "Rode com PROVA_PAGA=1 depois de conferir o teto do mês.\n",
  );
  process.exit(1);
}

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ARQUIVO = process.env.PROVA_MEMORIAL ?? "tests/117_25_md_geral_a.pdf";
const ATOR = process.env.PROVA_ATOR ?? "milton@prosul.com";

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

/**
 * Aparar acento, caixa e espaço — e MAIS: o que o modelo acrescenta ao citar.
 *
 * A primeira corrida (27/08/2026) reprovou duas asserções que estavam certas: o
 * chat devolve markdown, e `**Proprietário: …**` entre aspas curvas não casa com
 * o texto cru do PDF. O defeito era do conferidor, não do produto — as três
 * citações foram conferidas à mão no gabarito e todas existiam. Comparar sem
 * apagar ênfase e aspas é medir a formatação da resposta, não a verdade dela.
 */
const norm = (s) =>
  (s ?? "")
    .replace(/[*_`]/g, "")
    .replace(/["'“”‘’«»]/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// ---------------------------------------------------------------- gabarito
console.log(`\nGabarito independente de ${ARQUIVO} (pdfjs cru)…`);
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(ARQUIVO)),
  useSystemFonts: true,
}).promise;
const paginas = [];
for (let i = 1; i <= doc.numPages; i++) {
  const conteudo = await (await doc.getPage(i)).getTextContent();
  paginas.push(norm(conteudo.items.map((x) => x.str).join(" ")));
}
console.log(
  `  ${doc.numPages} páginas, ${paginas.join("").length} caracteres.`,
);

/** A página (1-based) contém este texto? */
const temNaPagina = (n, texto) =>
  n >= 1 && n <= paginas.length && paginas[n - 1].includes(norm(texto));
/** Todas as páginas onde o texto aparece — para dizer ONDE estava, quando erra. */
const ondeEsta = (texto) =>
  paginas.map((t, i) => (t.includes(norm(texto)) ? i + 1 : 0)).filter(Boolean);
/** Os números de página que a resposta citou. */
const paginasCitadas = (texto) => {
  const achadas = new Set();
  for (const re of [
    /p[áa]gina[s]?\s*n?[.º°]?\s*(\d{1,3})/gi,
    /\bp\.?\s*(\d{1,3})\b/gi,
  ]) {
    let m;
    while ((m = re.exec(texto))) achadas.add(Number(m[1]));
  }
  return [...achadas];
};

// ---------------------------------------------------------------- gasto antes
const prisma = getPrisma();
const somaDoMes = async () =>
  (
    await prisma.aiUsageEvent.aggregate({
      _sum: { estimatedCostUsd: true },
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    })
  )._sum.estimatedCostUsd ?? 0;
const gastoAntes = await somaDoMes();
console.log(`\nGasto do mês ANTES: US$ ${gastoAntes.toFixed(4)}`);

const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul" },
  select: { id: true, code: true },
});
check(
  "há projeto do escritório para endereçar a auditoria",
  Boolean(projeto),
  "rode npm run seed:dev",
);
if (!projeto) process.exit(1);

// ---------------------------------------------------------------- a auditoria
const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
await entrarComo(page, ATOR);

/*
 * REAPROVEITAR A AUDITORIA E O QUE TORNA ESTA PROVA REPETIVEL.
 *
 * Duas coisas sao medidas aqui, e so uma precisa de auditoria nova: se o motor
 * grava a memoria, e se o chat cita a pagina certa. A primeira corrida custou
 * US$ 0,60 e US$ 0,35 disso foi o motor relendo um documento que nao mudou.
 * Com `PROVA_AUDIT_ID` a corrida seguinte paga so a conversa -- e prova barata
 * e prova que roda de novo.
 */
const reaproveitar = process.env.PROVA_AUDIT_ID?.trim();
let report;
let auditId;

if (reaproveitar) {
  const anterior = await prisma.audit.findUnique({
    where: { id: reaproveitar },
    select: { id: true, report: true },
  });
  check(
    "a auditoria reaproveitada existe e tem parecer",
    Boolean(anterior?.report),
    reaproveitar,
  );
  if (!anterior?.report) process.exit(1);
  auditId = anterior.id;
  report = anterior.report;
  console.log(`
Reaproveitando a auditoria ${auditId} -- o motor nao roda de novo.`);
} else {
  console.log(`\nAuditoria standard de ${ARQUIVO} no projeto ${projeto.code}…`);
  const t0 = Date.now();
  const resposta = await page.request.post("/api/audit", {
    timeout: 900000,
    multipart: {
      message: "Prova com token: auditoria de memorial.",
      auditMode: "memorial",
      analysisLevel: "standard",
      fileTypes: "memorial",
      projectId: projeto.id,
      files: {
        name: ARQUIVO.split("/").pop(),
        mimeType: "application/pdf",
        buffer: readFileSync(ARQUIVO),
      },
    },
  });
  check(
    "a auditoria respondeu 200",
    resposta.ok(),
    `status ${resposta.status()}`,
  );
  if (!resposta.ok()) {
    console.error((await resposta.text()).slice(0, 400));
    await browser.close();
    process.exit(1);
  }
  ({ report, auditId } = await resposta.json());
  console.log(
    `  ${Math.round((Date.now() - t0) / 1000)}s · auditId ${auditId} · ` +
      `${report?.incongruencias?.length ?? 0} achados`,
  );
}

// A memória é o chão de tudo: sem `AuditText` o chat cai no modo degradado —
// caminho legítimo, mas não é o que esta prova mede.
const memoria = await prisma.auditText.findMany({
  where: { auditId },
  select: { fileName: true, charCount: true, pages: true },
});
check(
  "o texto do memorial foi gravado em AuditText",
  memoria.length > 0,
  `${memoria.length} linhas`,
);
if (memoria[0]) {
  const guardadas = Array.isArray(memoria[0].pages)
    ? memoria[0].pages.length
    : 0;
  check(
    "a memória guardou as páginas do documento",
    guardadas === doc.numPages,
    `guardadas ${guardadas}, no PDF ${doc.numPages}`,
  );
}

// ---------------------------------------------------------------- perguntar
const historico = [];
let voltasPorPergunta = [];

async function perguntar(question) {
  const r = await page.request.post("/api/audit/chat", {
    timeout: 300000,
    data: {
      question,
      report,
      auditId,
      projectId: projeto.id,
      history: historico.slice(-6),
    },
  });
  if (!r.ok())
    return { texto: "", achados: [], voltas: 0, erro: `status ${r.status()}` };
  let texto = "";
  const achados = [];
  const ferramentas = [];
  let voltas = 0;
  let erro = "";
  for (const linha of (await r.text()).split("\n")) {
    if (!linha.startsWith("data: ")) continue;
    const ev = JSON.parse(linha.slice(6));
    if (ev.type === "delta") texto += ev.text;
    else if (ev.type === "achado") achados.push(ev.achado);
    else if (ev.type === "ferramenta") ferramentas.push(ev.nome);
    else if (ev.type === "done") voltas = ev.voltas;
    else if (ev.type === "error") erro = ev.error;
  }
  historico.push(
    { role: "user", content: question },
    { role: "assistant", content: texto },
  );
  voltasPorPergunta.push({
    pergunta: question.slice(0, 40),
    voltas,
    ferramentas: ferramentas.length,
  });
  console.log(
    `\n> ${question}\n  (${voltas} voltas, ferramentas: ${ferramentas.join(", ") || "nenhuma"})`,
  );
  // A resposta INTEIRA. Cortar em 700 escondia o fim, onde ficam as últimas
  // citações — e obrigava a pagar outra corrida só para ver qual falhou.
  console.log("  " + texto.replace(/\n/g, "\n  "));
  return { texto, achados, voltas, erro };
}

// ---------------------------------------------------------------- as perguntas
//
// Cada pergunta tem UMA resposta certa, conferida no gabarito antes de gastar
// um centavo. Sem isso a prova viraria leitura de opinião.

// 1. Página e valor — o coração da prova.
const q1 = await perguntar(
  "Em que página do memorial está a espessura nominal da telha de fibrocimento, e qual o valor?",
);
const paginaDaTelha = ondeEsta("espessura nominal de 6,5 mm")[0];
check(
  `a espessura da telha cita a página ${paginaDaTelha}`,
  paginasCitadas(q1.texto).includes(paginaDaTelha),
  `citou ${paginasCitadas(q1.texto).join(", ") || "nenhuma"}`,
);
check(
  "e traz o valor certo (6,5 mm)",
  /6[,.]5\s*mm/i.test(q1.texto),
  q1.texto.slice(0, 200),
);

// 2. Um número que existe em dois lugares diferentes e NÃO é o mesmo número:
// área do terreno (p.13) × área construída (p.99). Confundir os dois é o erro
// natural aqui, e é por isso que a pergunta existe.
const q2 = await perguntar(
  "Qual é a área total construída da edificação? Cite a página.",
);
const paginaDaArea = ondeEsta("area total construida de 467,46")[0];
check(
  `a área construída cita a página ${paginaDaArea}`,
  paginasCitadas(q2.texto).includes(paginaDaArea),
  `citou ${paginasCitadas(q2.texto).join(", ") || "nenhuma"}`,
);
check(
  "e traz 467,46 m², não a área do terreno",
  /467[,.]46/.test(q2.texto),
  q2.texto.slice(0, 200),
);

// 3. Um defeito REAL deste documento: a capa é de Criciúma e o proprietário
// declarado nas instalações é a Prefeitura de Chapecó.
const q3 = await perguntar(
  "Quem é o proprietário declarado no memorial, e em que página isso aparece?",
);
check(
  "o proprietário citado é o que está escrito (Chapecó)",
  /chapec/i.test(q3.texto),
  q3.texto.slice(0, 200),
);
const paginaDoDono = ondeEsta("prefeitura municipal de chapeco")[0];
check(
  `e a página do proprietário confere (${paginaDoDono})`,
  paginasCitadas(q3.texto).some((p) => temNaPagina(p, "chapec")),
  `citou ${paginasCitadas(q3.texto).join(", ") || "nenhuma"}`,
);

// 4. O que NÃO está no documento. Aproximar aqui é pior que não responder.
const q4 = await perguntar(
  "O que o memorial especifica sobre escadas rolantes?",
);
check(
  "sobre escada rolante ele nega, em vez de aproximar",
  /n[ãa]o (encontr|h[áa]|consta|menciona|localiz|especific|existe|aparece|prev[êe])|nenhuma (men[çc][ãa]o|refer|ocorr)/i.test(
    q4.texto,
  ),
  q4.texto.slice(0, 200),
);
/*
 * A asserção anterior era "não cita página nenhuma", e ELA estava errada.
 *
 * Na corrida de 27/08/2026 o chat negou a escada rolante e, na frase seguinte,
 * apontou a escada FIXA que existe mesmo (p.12, 38, 43 e 44). Distinguir as
 * duas é a resposta MELHOR, e a regra antiga a reprovava. O que não pode
 * acontecer é atribuir o termo inexistente a uma página — é isso que se mede.
 */
const paginasDaQ4 = paginasCitadas(q4.texto);
check(
  "e nenhuma página citada é vendida como tendo escada rolante",
  paginasDaQ4.every(
    (p) => temNaPagina(p, "escada") && !temNaPagina(p, "escada rolante"),
  ),
  `citou ${paginasDaQ4.join(", ") || "nenhuma"}`,
);

// 5. O advogado do diabo contra o próprio parecer.
const alvo = report?.incongruencias?.[0];
if (alvo) {
  const q5 = await perguntar(
    `Você concorda com o achado ${alvo.id || alvo.refId || "INC-001"}? Mostre o trecho do documento que sustenta ou contradiz.`,
  );
  const citadas = paginasCitadas(q5.texto);
  check(
    "ao julgar o próprio parecer, toda página citada existe no documento",
    citadas.every((p) => p >= 1 && p <= paginas.length),
    `citou ${citadas.join(", ")}`,
  );
  /*
   * Só o par ABRE→FECHA. A versão anterior tratava `”` como abertura também, e
   * casava o texto ENTRE duas citações — reprovando um trecho que o modelo
   * nunca afirmou. Conferido na corrida de 27/08: as quatro citações reais
   * ancoravam; o defeito era este regex.
   */
  const aspas = [...q5.texto.matchAll(/[“"]([^”"]{15,200})[”"]/g)].map(
    (m) => m[1],
  );
  const ancoradas = aspas.filter((t) => ondeEsta(t).length > 0);
  check(
    "e todo trecho que ele põe entre aspas existe mesmo no documento",
    aspas.length === 0 || ancoradas.length === aspas.length,
    `${ancoradas.length}/${aspas.length} ancoraram`,
  );
} else {
  console.log("\n  PULA    a auditoria não devolveu achado para contestar");
}

// 6. O achado nascido na conversa. É aqui que a trava de `registrar_achado`
// precisa segurar: evidência que não ancora não pode virar achado.
const q6 = await perguntar(
  "Procure no memorial um erro que a auditoria deixou passar. Se encontrar, registre o achado.",
);
if (q6.achados.length > 0) {
  for (const a of q6.achados) {
    const pag = Number(a.pagina ?? a.page ?? 0);
    const trecho = a.evidencia ?? a.trecho ?? a.evidence ?? "";
    check(
      `o achado nascido no chat ancora de verdade (p.${pag})`,
      Boolean(trecho) && temNaPagina(pag, trecho.slice(0, 60)),
      `trecho "${String(trecho).slice(0, 60)}" — está em ${ondeEsta(String(trecho).slice(0, 60)).join(", ") || "nenhuma página"}`,
    );
  }
} else {
  console.log("  (nenhum achado registrado — é um desfecho legítimo)");
}

// ---------------------------------------------------------------- o número
console.log("\nVoltas por pergunta — é este número que decide o teto:");
for (const v of voltasPorPergunta)
  console.log(
    `  ${String(v.voltas).padStart(2)} voltas · ${v.ferramentas} ferramentas · ${v.pergunta}`,
  );
const pior = Math.max(...voltasPorPergunta.map((v) => v.voltas));
console.log(
  `\n  PIOR CASO MEDIDO: ${pior} voltas. Teto atual: ${process.env.NEXODOC_AUDIT_CHAT_MAX_TOOL_TURNS ?? 8}.`,
);

const gastoDepois = await somaDoMes();
console.log(
  `\nGasto do mês DEPOIS: US$ ${gastoDepois.toFixed(4)}` +
    `\nESTA CORRIDA CUSTOU: US$ ${(gastoDepois - gastoAntes).toFixed(4)}`,
);

await browser.close();
await prisma.$disconnect();
console.log(falhas === 0 ? "\nPROVA COM TOKEN OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
