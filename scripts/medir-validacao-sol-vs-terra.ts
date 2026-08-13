/**
 * SOL x TERRA na passada de VALIDAÇÃO — medição sobre a mesma entrada.
 *
 * A validação é a segunda maior linha do gasto (17% da semana) e é a única
 * etapa que não descobre nada: ela confere achados que já existem. Daí a
 * pergunta — dá para rodá-la no `terra` ($2/$12) em vez do `sol` ($5/$30) sem
 * perder qualidade?
 *
 * COMO ISTO É HONESTO: não roda auditoria nenhuma. Pega um parecer JÁ GRAVADO,
 * usa os achados dele como candidatos e monta o prompt com o MESMO módulo que a
 * produção usa (`lib/audit-validation-prompt.ts`). Os dois modelos recebem
 * texto idêntico, então a diferença medida é do modelo, não do sorteio.
 *
 * O que se mede, nesta ordem de importância:
 *   1. quantos achados cada modelo manda para a camada recolhível ("remover"
 *      vira `tier: sugestao` no código — ver route.ts:2718). É o risco real:
 *      achado verdadeiro que sai da lista principal e ninguém abre.
 *   2. em quantos achados os dois discordam, e quais.
 *   3. o texto reescrito, lado a lado, porque é o que o engenheiro lê.
 *
 *   node scripts/medir-validacao-sol-vs-terra.ts <auditId> <caminho-do-pdf>
 */
import fs from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import OpenAI from "openai";

import { getAuditorPrompt } from "../lib/auditor-prompt.ts";
import { extractPdfText } from "../lib/pdf-text.ts";
import {
  auditValidationResponseFormat,
  getFindingValidationPrompt,
} from "../lib/audit-validation-prompt.ts";
import { estimateOpenAiCostUsd } from "../lib/ai-precos.ts";

for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const [auditId, pdfPath] = process.argv.slice(2);

if (!auditId || !pdfPath) {
  console.error("uso: node scripts/medir-validacao-sol-vs-terra.ts <auditId> <caminho-do-pdf>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const audit = await prisma.audit.findUnique({
  where: { id: auditId },
  select: { id: true, projectName: true, auditMode: true, analysisLevel: true, report: true },
});

if (!audit?.report) {
  console.error(`auditoria ${auditId} não encontrada ou sem parecer`);
  process.exit(1);
}

const report = audit.report as Record<string, unknown>;
const findings = (report.incongruencias ?? []) as Array<Record<string, unknown>>;

console.log(`auditoria .......... ${audit.id}`);
console.log(`obra ............... ${audit.projectName}`);
console.log(`achados no parecer . ${findings.length} (o prompt usa os 40 primeiros)`);
console.log(`validado em ........ ${(report.runtime as Record<string, unknown>)?.modelo_validacao}`);

console.log(`\nextraindo ${path.basename(pdfPath)}...`);
const extracted = await extractPdfText(fs.readFileSync(pdfPath));
console.log(`  ${extracted.pageCount} páginas, ${extracted.text.length} chars`);

const prompt = getFindingValidationPrompt({
  auditMode: audit.auditMode,
  userMessage: "Auditar o memorial descritivo.",
  projectName: audit.projectName,
  learningContext: "(nenhum aprendizado ativo)",
  files: [
    {
      file: { name: path.basename(pdfPath) },
      fileType: "memorial",
      extracted,
    },
  ],
  findings: findings as Parameters<typeof getFindingValidationPrompt>[0]["findings"],
});

console.log(`prompt montado ..... ${prompt.length} chars\n`);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const maxOutput = Math.min(16000, Math.max(2600, findings.length * 260));

type Decisao = {
  source_id: string;
  acao: "confirmar" | "rebaixar" | "remover";
  prioridade: string;
  impacto: string;
  tipo: string;
  descricao: string;
  conflito: string;
  sugestao_correcao: string;
  confianca: string;
  motivo: string;
};

async function validar(model: string) {
  const inicio = Date.now();
  const response = await client.responses.create({
    model,
    instructions: getAuditorPrompt(audit!.auditMode as "memorial" | "volume"),
    reasoning: { effort: "medium" },
    max_output_tokens: maxOutput,
    text: { format: auditValidationResponseFormat },
    input: prompt,
  });
  const duracao = Date.now() - inicio;
  const usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
  };
  const parsed = JSON.parse(response.output_text || "{}") as { decisions?: Decisao[] };
  const decisions = parsed.decisions ?? [];

  console.log(
    `${model.padEnd(14)} ${String(decisions.length).padStart(3)} decisões | ` +
      `in ${usage.inputTokens} (cache ${usage.cachedTokens}) out ${usage.outputTokens} | ` +
      `${(duracao / 1000).toFixed(1)}s | $${(estimateOpenAiCostUsd(model, usage) ?? 0).toFixed(4)}` +
      `${response.status === "incomplete" ? "  *** TRUNCADO ***" : ""}`,
  );

  return { model, decisions, usage, duracao, custo: estimateOpenAiCostUsd(model, usage) ?? 0 };
}

console.log("=== rodando as duas validações sobre a MESMA entrada ===");
const [sol, terra] = await Promise.all([validar("gpt-5.6-sol"), validar("gpt-5.6-terra")]);

const mapa = (ds: Decisao[]) => new Map(ds.map((d) => [d.source_id, d]));
const mSol = mapa(sol.decisions);
const mTerra = mapa(terra.decisions);

const conta = (ds: Decisao[]) => {
  const c: Record<string, number> = { confirmar: 0, rebaixar: 0, remover: 0 };
  for (const d of ds) c[d.acao] = (c[d.acao] ?? 0) + 1;
  return c;
};

console.log("\n=== O QUE MAIS IMPORTA: quantos vão para a camada recolhível ===");
console.log("(no código, 'remover' NÃO apaga — vira tier=sugestao, atrás do <details>)");
const cSol = conta(sol.decisions);
const cTerra = conta(terra.decisions);
console.log(`  sol   confirmar=${cSol.confirmar} rebaixar=${cSol.rebaixar} REMOVER=${cSol.remover}`);
console.log(`  terra confirmar=${cTerra.confirmar} rebaixar=${cTerra.rebaixar} REMOVER=${cTerra.remover}`);

const ids = [...new Set([...mSol.keys(), ...mTerra.keys()])];
const divergentes = ids.filter((id) => mSol.get(id)?.acao !== mTerra.get(id)?.acao);

console.log(`\n=== CONCORDÂNCIA: ${ids.length - divergentes.length}/${ids.length} decisões iguais ===`);
for (const id of divergentes) {
  const a = mSol.get(id);
  const b = mTerra.get(id);
  const orig = findings.find((f) => f.id === id);
  console.log(
    `  ${id.padEnd(14)} sol=${(a?.acao ?? "(ausente)").padEnd(9)} terra=${(b?.acao ?? "(ausente)").padEnd(9)}` +
      ` | origem=${orig?.origem ?? "?"} | ${String(orig?.tipo ?? "").slice(0, 46)}`,
  );
}

const soParaTerra = ids.filter(
  (id) => mSol.get(id)?.acao !== "remover" && mTerra.get(id)?.acao === "remover",
);
console.log(
  `\n>>> achados que SÓ o terra manda para a camada recolhível: ${soParaTerra.length}` +
    (soParaTerra.length ? ` (${soParaTerra.join(", ")})` : ""),
);
for (const id of soParaTerra) {
  const orig = findings.find((f) => f.id === id);
  console.log(`    ${id} [${orig?.origem}] ${String(orig?.descricao ?? "").slice(0, 150)}`);
  console.log(`      motivo do terra: ${mTerra.get(id)?.motivo}`);
}

console.log("\n=== A PROSA, que é o que o engenheiro lê (3 amostras confirmadas) ===");
const amostras = ids.filter((id) => mSol.get(id)?.acao === "confirmar" && mTerra.get(id)?.acao === "confirmar").slice(0, 3);
for (const id of amostras) {
  console.log(`\n  --- ${id} ---`);
  console.log(`  sol  : ${mSol.get(id)?.conflito}`);
  console.log(`  terra: ${mTerra.get(id)?.conflito}`);
}

console.log("\n=== CUSTO DESTA CHAMADA ===");
console.log(`  sol   $${sol.custo.toFixed(4)}   ${(sol.duracao / 1000).toFixed(1)}s`);
console.log(`  terra $${terra.custo.toFixed(4)}   ${(terra.duracao / 1000).toFixed(1)}s`);
console.log(`  economia por validação: $${(sol.custo - terra.custo).toFixed(4)} (${(((sol.custo - terra.custo) / sol.custo) * 100).toFixed(0)}%)`);

fs.writeFileSync(
  "medicao-validacao.json",
  JSON.stringify({ auditId, sol, terra, divergentes, soParaTerra }, null, 1),
);
console.log("\nbruto em medicao-validacao.json");

await prisma.$disconnect();
await pool.end();
