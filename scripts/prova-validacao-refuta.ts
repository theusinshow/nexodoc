/**
 * A VALIDAÇÃO REFUTA ALGUMA COISA, OU CARIMBA?
 *
 * Ela é a única defesa do parecer contra falso positivo, custa ~20% da conta de
 * uma auditoria, e nunca foi medida. Nos quatro pareceres gravados até 18/08 ela
 * rebaixou 1, 1, 0 e 0 achados — entre 25 e 58 candidatos. Isso não decide nada:
 * pode ser que não houvesse o que refutar.
 *
 * O teste planta falsos positivos entre achados verdadeiros e vê o que ela faz.
 *
 * DOIS TIPOS DE PLANTA, e a separação é o ponto do teste:
 *
 *   VISÍVEL   — refutável pelo começo do documento, que o contexto sempre inclui.
 *               Se ela não pegar, ela não julga.
 *   PROFUNDO  — refutável só por página do miolo, que o recorte de contexto pode
 *               não conter. Se ela não pegar, o problema é COBERTURA, não juízo —
 *               e o conserto é outro (§2c da análise de 17/08).
 *
 * Sem essa separação, um resultado ruim seria atribuído à etapa errada.
 *
 *   node scripts/prova-validacao-refuta.ts <parecer.json> <memorial.pdf> [modelo]
 */
import fs from "node:fs";
import path from "node:path";

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

const [parecerPath, pdfPath, modeloArg] = process.argv.slice(2);
if (!parecerPath || !pdfPath) {
  console.error("uso: node scripts/prova-validacao-refuta.ts <parecer.json> <memorial.pdf> [modelo]");
  process.exit(1);
}
const modelo = modeloArg ?? "gpt-5.6-sol";

const report = JSON.parse(fs.readFileSync(parecerPath, "utf8")).report;
const reais = (report.incongruencias ?? []).slice(0, 15);

/**
 * As plantas. Todas têm a FORMA de um achado bom — página, evidência entre
 * aspas, conflito, sugestão — e são falsas no conteúdo. Uma validação que só
 * olha a forma confirma todas.
 */
const PLANTADOS = [
  {
    id: "PLANT-01",
    alcance: "visivel",
    porque: "A obra é UBS Vila Manaus, dito na capa e no capítulo 1.",
    achado: {
      arquivo: path.basename(pdfPath),
      origem: "ia",
      prioridade: "Alta",
      pagina: "12",
      capitulo: "1 OBJETO",
      local: "identificação da obra",
      tipo: "Obra identificada como escola",
      descricao:
        "O memorial identifica o empreendimento como Escola Municipal de Ensino Fundamental Aurora, incompatível com uma unidade de saúde.",
      evidencia: "“Escola Municipal de Ensino Fundamental Aurora”",
      termo_busca: "Escola Municipal de Ensino Fundamental Aurora",
      conflito: "O objeto declarado é uma escola, e o restante do memorial trata de unidade básica de saúde.",
      sugestao_correcao: "Corrigir o nome do empreendimento para a unidade de saúde projetada.",
      confianca: "alta",
      impacto: "critico_documental",
    },
  },
  {
    id: "PLANT-02",
    alcance: "visivel",
    porque: "O município é Criciúma/SC, repetido no rodapé de todas as páginas.",
    achado: {
      arquivo: path.basename(pdfPath),
      origem: "ia",
      prioridade: "Alta",
      pagina: "13",
      capitulo: "1 OBJETO",
      local: "localização",
      tipo: "Município divergente",
      descricao: "O memorial situa a obra em Joinville/SC, divergindo do restante do documento.",
      evidencia: "“a obra localiza-se no município de Joinville, Santa Catarina”",
      termo_busca: "Joinville",
      conflito: "Município incompatível com o órgão contratante.",
      sugestao_correcao: "Corrigir o município.",
      confianca: "alta",
      impacto: "critico_documental",
    },
  },
  {
    id: "PLANT-03",
    alcance: "profundo",
    porque: "A p.101 declara 2 reservatórios de 1.500 L, total de 3.000 L — não 5.000.",
    achado: {
      arquivo: path.basename(pdfPath),
      origem: "ia",
      prioridade: "Media/Alta",
      pagina: "101",
      capitulo: "9 PROJETO HIDROSSANITÁRIO",
      local: "volume do reservatório",
      tipo: "Capacidade de reservação divergente",
      descricao:
        "O memorial declara capacidade total de 5.000 litros para dois reservatórios de 1.500 litros cada, o que soma 3.000 litros.",
      evidencia: "“Capacidade total de 5.000 litros”",
      termo_busca: "Capacidade total de 5.000 litros",
      conflito: "A soma declarada não corresponde às unidades especificadas.",
      sugestao_correcao: "Corrigir a capacidade total para 3.000 litros.",
      confianca: "alta",
      impacto: "tecnico_contratual",
    },
  },
  {
    id: "PLANT-04",
    alcance: "profundo",
    porque: "UBS Porte 1 térrea; não há elevador em lugar nenhum do memorial.",
    achado: {
      arquivo: path.basename(pdfPath),
      origem: "ia",
      prioridade: "Media/Alta",
      pagina: "57",
      capitulo: "7 PROJETO ARQUITETÔNICO",
      local: "circulação vertical",
      tipo: "Elevador previsto sem especificação",
      descricao:
        "O projeto arquitetônico prevê elevador de passageiros para o segundo pavimento, sem especificação de capacidade ou norma aplicável.",
      evidencia: "“o elevador de passageiros atenderá ao segundo pavimento”",
      termo_busca: "elevador de passageiros",
      conflito: "Equipamento previsto sem dimensionamento nem referência normativa.",
      sugestao_correcao: "Especificar o elevador ou retirá-lo do escopo.",
      confianca: "alta",
      impacto: "tecnico_contratual",
    },
  },
];

const candidatos = [...reais, ...PLANTADOS.map((p) => ({ ...p.achado, id: p.id }))];

console.log(`parecer .......... ${path.basename(parecerPath)}`);
console.log(`candidatos ....... ${reais.length} reais + ${PLANTADOS.length} plantados = ${candidatos.length}`);
console.log(`modelo ........... ${modelo}\n`);

console.log(`extraindo ${path.basename(pdfPath)}...`);
const extracted = await extractPdfText(fs.readFileSync(pdfPath));
console.log(`  ${extracted.pageCount} páginas, ${extracted.text.length} chars`);

const prompt = getFindingValidationPrompt({
  auditMode: "memorial",
  userMessage: "Auditar o memorial descritivo.",
  projectName: report.obra ?? "UBS Vila Manaus",
  learningContext: "(nenhum aprendizado ativo)",
  files: [{ file: { name: path.basename(pdfPath) }, fileType: "memorial", extracted }],
  findings: candidatos as Parameters<typeof getFindingValidationPrompt>[0]["findings"],
});
console.log(`prompt ........... ${prompt.length} chars\n`);

/*
 * O contexto que a validação recebe é RECORTADO. Saber se a página de cada
 * planta chegou até ela é o que separa "não julgou" de "não viu" — sem isto o
 * resultado seria atribuído à etapa errada.
 */
for (const p of PLANTADOS) {
  const pagina = extracted.pages.find((x) => String(x.page) === p.achado.pagina);
  const trechoNoPrompt = pagina ? prompt.includes(pagina.text.slice(50, 120)) : false;
  console.log(`  ${p.id} [${p.alcance}] pág. ${p.achado.pagina} no contexto da validação: ${trechoNoPrompt ? "SIM" : "não"}`);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const inicio = Date.now();
const response = await client.responses.create({
  model: modelo,
  instructions: getAuditorPrompt("memorial"),
  reasoning: { effort: "medium" },
  max_output_tokens: Math.min(16000, Math.max(2600, candidatos.length * 260)),
  text: { format: auditValidationResponseFormat },
  input: prompt,
});

const usage = {
  inputTokens: response.usage?.input_tokens ?? 0,
  outputTokens: response.usage?.output_tokens ?? 0,
  cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
};
const custo = estimateOpenAiCostUsd(modelo, usage) ?? 0;
console.log(
  `\nresposta ......... ${((Date.now() - inicio) / 1000).toFixed(1)}s | ` +
    `in ${usage.inputTokens} out ${usage.outputTokens} | $${custo.toFixed(4)}` +
    `${response.status === "incomplete" ? "  *** TRUNCADO ***" : ""}`,
);

const parsed = JSON.parse(response.output_text || "{}") as {
  decisions?: { source_id: string; acao: string; motivo?: string; confianca?: string }[];
};
const decisoes = new Map((parsed.decisions ?? []).map((d) => [String(d.source_id), d]));

console.log(`\n${"=".repeat(72)}\nAS PLANTAS\n${"=".repeat(72)}`);
let pegos = 0;
for (const p of PLANTADOS) {
  const d = decisoes.get(p.id);
  const acao = d?.acao ?? "(sem decisão)";
  const refutou = acao === "remover" || acao === "rebaixar";
  if (refutou) pegos++;
  console.log(`\n${refutou ? "PEGOU " : "PASSOU"} ${p.id} [${p.alcance}] -> ${acao}`);
  console.log(`   falso porque: ${p.porque}`);
  if (d?.motivo) console.log(`   motivo dado : ${String(d.motivo).replace(/\s+/g, " ").slice(0, 180)}`);
}

/*
 * O VEREDITO POR ORIGEM, e não só a contagem.
 *
 * `route.ts` DESCARTA o "remover" quando o achado é de regra: regras não
 * alucinam e citam página e evidência. Sem separar por origem, um "remover=4"
 * pode significar duas coisas opostas — a validação enviesada contra regra (e a
 * proteção nos salvando) ou regra nossa com falso positivo (e a proteção
 * escondendo). São conclusões contrárias com o mesmo número.
 */
console.log(`\n${"=".repeat(72)}\nOS ACHADOS REAIS, POR ORIGEM\n${"=".repeat(72)}`);
const acoesReais = new Map<string, number>();
const porOrigemAcao = new Map<string, number>();
for (const f of reais) {
  const d = decisoes.get(String(f.id));
  const a = d?.acao ?? "(sem decisão)";
  acoesReais.set(a, (acoesReais.get(a) ?? 0) + 1);
  const chave = `${f.origem}/${a}`;
  porOrigemAcao.set(chave, (porOrigemAcao.get(chave) ?? 0) + 1);
  if (a !== "confirmar") {
    console.log(`\n${a.toUpperCase().padEnd(9)} ${f.id} [${f.origem}] ${String(f.tipo).slice(0, 56)}`);
    console.log(`   evid  : ${String(f.evidencia ?? "").replace(/\s+/g, " ").slice(0, 120)}`);
    if (d?.motivo) console.log(`   motivo: ${String(d.motivo).replace(/\s+/g, " ").slice(0, 170)}`);
  }
}
console.log(`\npor origem/ação: ${[...porOrigemAcao].map(([k, n]) => `${k}=${n}`).join(" · ")}`);
console.log(
  `\nNa produção, "remover" em achado de REGRA é ignorado (route.ts) e o achado fica intacto.` +
    `\nEm achado de IA, vira tier "sugestao" com confiança baixa — some da lista principal.`,
);

console.log(`\n${"=".repeat(72)}`);
console.log(`PLANTAS REFUTADAS: ${pegos}/${PLANTADOS.length}`);
console.log(`ACHADOS REAIS: ${[...acoesReais].map(([a, n]) => `${a}=${n}`).join(" · ")}`);
console.log(
  `\nLeitura: planta VISÍVEL que passa = a validação não julga. ` +
    `\nPlanta PROFUNDA que passa com a página FORA do contexto = problema de cobertura, não de juízo.`,
);
