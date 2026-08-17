/**
 * O BLOCO CABE NA RESPOSTA? — a prova barata que faltou em 17/08/2026.
 *
 * Naquele dia os blocos foram agrupados em 28k caracteres sem ninguém verificar
 * se a resposta fechava dentro do teto de saída. Não fechou: 20 de 25 blocos
 * truncaram, cada um queimando o teto INTEIRO em raciocínio e devolvendo zero.
 * US$ 4,32 de US$ 6,09 da auditoria, medidos no `AiUsageEvent`.
 *
 * Este script faz UMA chamada real por bloco escolhido — centavos — e responde a
 * única pergunta que importa antes de rodar um memorial de 218 páginas: *este
 * tamanho de bloco termina, e com quanta folga?*
 *
 * Ele usa os MESMOS parâmetros do motor (modelo por papel, esforço de raciocínio,
 * teto de saída em função do tamanho). Se divergir do motor, não prova nada — por
 * isso importa `getMaxOutputTokens` de lá em vez de recalcular.
 *
 * Uso:
 *   node scripts/prova-bloco-cabe.ts "<memorial.pdf>" [quantos=2] [tetoChars=10000]
 */
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";

import OpenAI from "openai";

import { agruparBlocosParaLeitura, chunkPdfByChapter, extractPdfText } from "../lib/pdf-text.ts";
import { estimateOpenAiCostUsd } from "../lib/ai-precos.ts";

for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(linha.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const caminho = process.argv[2];
const quantos = Number(process.argv[3] ?? 2);
const tetoChars = Number(process.argv[4] ?? 10000);

if (!caminho) {
  console.error('Informe o PDF: node scripts/prova-bloco-cabe.ts "<memorial.pdf>" [quantos] [tetoChars]');
  process.exit(1);
}

/** Espelha `getMaxOutputTokens` da rota. Mudou lá, muda aqui — e o teste avisa. */
const PISO = 6000;
const LIMITE = 16000;
const tetoDeSaida = (chars: number) => Math.min(LIMITE, Math.max(PISO, Math.ceil(chars / 2)));

const MODELO =
  process.env.NEXODOC_AUDIT_MEMORIAL_DEEP_CHUNK_MODEL ??
  process.env.NEXODOC_AUDIT_DEEP_CHUNK_MODEL ??
  process.env.NEXODOC_AUDIT_MEMORIAL_DEEP_MODEL ??
  "gpt-5.6-sol";
// Memorial no Profundo é `medium` por decisão medida — ver `getReasoningEffort`.
const ESFORCO = process.env.OPENAI_DEEP_REASONING_EFFORT ?? "medium";

const buffer = await readFile(caminho);
const extraido = await extractPdfText(buffer);
const blocos = agruparBlocosParaLeitura(chunkPdfByChapter(extraido), tetoChars);

/*
 * Os MAIORES blocos, e não os primeiros. O começo de um memorial é capa e
 * sumário — texto ralo que cabe em qualquer teto e provaria o caso fácil. Quem
 * trunca é o capítulo denso de especificação, e é ele que precisa passar.
 */
const alvos = [...blocos].sort((a, b) => b.text.length - a.text.length).slice(0, quantos);

console.log(`\nArquivo: ${caminho}`);
console.log(`${extraido.pageCount} páginas · ${extraido.charCount.toLocaleString("pt-BR")} caracteres`);
console.log(`${blocos.length} blocos com teto de ${tetoChars.toLocaleString("pt-BR")} chars`);
console.log(`Modelo dos blocos: ${MODELO} · esforço: ${ESFORCO}`);
console.log(`Testando os ${alvos.length} MAIORES blocos (os que truncam).\n`);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
let gastoTotal = 0;
let truncou = 0;

for (const bloco of alvos) {
  const teto = tetoDeSaida(bloco.text.length);
  process.stdout.write(
    `  ${bloco.title.slice(0, 40).padEnd(42)} ${String(bloco.text.length).padStart(6)} chars, teto ${teto} … `,
  );

  const t0 = Date.now();
  const r = await client.responses.create({
    model: MODELO,
    instructions:
      "Você audita memoriais descritivos de obra pública. Reporte todo defeito real que encontrar. Responda em JSON.",
    reasoning: { effort: ESFORCO as "low" | "medium" | "high" },
    max_output_tokens: teto,
    input: `Audite o trecho abaixo e liste os defeitos encontrados em JSON {"findings":[...]}.\n\n${bloco.text}`,
  });

  const usou = r.usage?.output_tokens ?? 0;
  const entrada = r.usage?.input_tokens ?? 0;
  const usd = estimateOpenAiCostUsd(MODELO, { inputTokens: entrada, outputTokens: usou, cachedTokens: 0 }) ?? 0;
  gastoTotal += usd;

  const incompleto = r.status === "incomplete";
  if (incompleto) truncou++;

  const folga = teto > 0 ? Math.round((1 - usou / teto) * 100) : 0;
  console.log(
    incompleto
      ? `TRUNCOU (${r.incomplete_details?.reason ?? "?"}) — gastou ${usou}/${teto}, US$ ${usd.toFixed(3)}, ${Math.round((Date.now() - t0) / 1000)}s`
      : `ok — usou ${usou}/${teto} (${folga}% de folga), US$ ${usd.toFixed(3)}, ${Math.round((Date.now() - t0) / 1000)}s`,
  );
}

console.log(`\nGasto desta prova: US$ ${gastoTotal.toFixed(3)}`);

if (truncou > 0) {
  console.log(
    `\n${truncou} de ${alvos.length} TRUNCARAM. Não rode o documento inteiro:\n` +
      `baixe o teto de agrupamento (CHUNK_GROUP_CHARS) e prove de novo.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\nTodos couberam. Extrapolando para os ${blocos.length} blocos deste memorial: ` +
      `~US$ ${((gastoTotal / alvos.length) * blocos.length).toFixed(2)} (teto — os blocos\n` +
      `menores custam menos, e a maioria devolve lista vazia).`,
  );
}
