/**
 * QUANTO CUSTA O NÍVEL ÚNICO — a medição que vem ANTES de ligar a flag.
 *
 * A decisão de 17/08/2026 foi unificar os dois níveis num só que lê o documento
 * inteiro E examina capítulo a capítulo (`NEXODOC_AUDIT_COBERTURA_TOTAL`). Isso
 * custa mais que qualquer um dos dois de hoje, e o combinado foi: mostrar o
 * número antes de virar padrão.
 *
 * NÃO CHAMA IA. Extrai o PDF de verdade (pdfjs), corta em capítulos com a MESMA
 * função do motor e faz a aritmética de preço com a MESMA tabela do produto
 * (`lib/ai-precos.ts`). O que ele estima é o CUSTO, não a qualidade — quantos
 * achados a mais aparecem só uma corrida real responde.
 *
 * A estimativa de tokens é a aproximação padrão de 1 token ≈ 4 caracteres para
 * português. Ela erra para mais em texto técnico com muita numeração, então o
 * número que sai daqui é TETO, não piso — que é o lado certo para errar quando
 * se está decidindo gastar.
 *
 * Uso:
 *   node scripts/mede-cobertura-total.ts "C:\\caminho\\memorial.pdf"
 */
import { readFile } from "node:fs/promises";

import { estimateOpenAiCostUsd } from "../lib/ai-precos.ts";
import { chunkPdfByChapter, extractPdfText } from "../lib/pdf-text.ts";

const caminho = process.argv[2];

if (!caminho) {
  console.error('Informe o PDF: node scripts/mede-cobertura-total.ts "<memorial.pdf>"');
  process.exit(1);
}

/** Os modelos que o `.env.example` fixa para memorial. Sobrescritos por env. */
const MODELO_GLOBAL = process.env.NEXODOC_AUDIT_MEMORIAL_DEEP_GLOBAL_MODEL ?? "gpt-5.6-sol";
const MODELO_BLOCO = process.env.NEXODOC_AUDIT_MEMORIAL_DEEP_MODEL ?? "gpt-5.6-sol";
const MODELO_PADRAO = process.env.NEXODOC_AUDIT_MEMORIAL_STANDARD_MODEL ?? "gpt-5.6-terra";

/** Os mesmos tetos do motor (`audit-validation-prompt.ts`, `route.ts`). */
const JANELA_GLOBAL_PROFUNDO = 700_000;
const JANELA_GLOBAL_PADRAO = 90_000;
const BLOCOS_PADRAO = 8;
/** `DEFAULT_CHUNK_MAX_OUTPUT_TOKENS` — teto de saída por bloco. */
const SAIDA_POR_BLOCO = 6_000;
/** A leitura global devolve o mapa por capítulo + achados; sai mais que um bloco. */
const SAIDA_GLOBAL = 12_000;
/** O prompt do auditor + o gabarito, que acompanham TODA chamada. */
const PROMPT_FIXO_CHARS = 6_000;

const CHARS_POR_TOKEN = 4;
const tok = (chars: number) => Math.ceil(chars / CHARS_POR_TOKEN);

function custo(modelo: string, inputTokens: number, outputTokens: number) {
  // `cachedTokens: 0` de propósito: o cache medido em 13/08/2026 vem de REPETIR a
  // mesma chamada, não de reordenar prompt — numa auditoria nova ele não existe.
  return estimateOpenAiCostUsd(modelo, { inputTokens, outputTokens, cachedTokens: 0 });
}

const buffer = await readFile(caminho);
const extraido = await extractPdfText(buffer);
const capitulos = chunkPdfByChapter(extraido);

const charsDoc = extraido.charCount;
const charsGlobalProfundo = Math.min(charsDoc, JANELA_GLOBAL_PROFUNDO);
const charsGlobalPadrao = Math.min(charsDoc, JANELA_GLOBAL_PADRAO);

type Cenario = {
  nome: string;
  chamadas: number;
  entrada: number;
  saida: number;
  usd: number | null;
  cobertura: string;
};

function bloco(modelo: string, quantos: number) {
  const usados = capitulos.slice(0, quantos);
  const entrada = usados.reduce((n, c) => n + tok(c.text.length + PROMPT_FIXO_CHARS), 0);
  const saida = usados.length * SAIDA_POR_BLOCO;
  return { usados: usados.length, entrada, saida, usd: custo(modelo, entrada, saida) ?? 0 };
}

const globalProfundo = {
  entrada: tok(charsGlobalProfundo + PROMPT_FIXO_CHARS),
  saida: SAIDA_GLOBAL,
};
const globalPadrao = {
  entrada: tok(charsGlobalPadrao + PROMPT_FIXO_CHARS),
  saida: SAIDA_GLOBAL,
};

/*
 * OS CAPÍTULOS AGRUPADOS — a variante que torna a cobertura total pagável.
 *
 * `chunkPdfByChapter` corta em TODO cabeçalho de capítulo, sem piso de tamanho:
 * um memorial de 361k caracteres vira 72 blocos de ~5k. Como cada bloco carrega
 * o prompt fixo do auditor e tem teto de saída próprio (6k tokens), 72 blocos
 * cobram 72 prompts e 72 tetos de saída para ler o mesmo documento. É a SAÍDA
 * que domina o custo, não a entrada — e ela é função do NÚMERO de blocos, não
 * do tamanho do texto.
 *
 * Agrupar capítulos vizinhos até o teto de 28k que a própria função já usa não
 * perde nada: o bloco continua sendo um recorte contíguo com fronteira de
 * capítulo, só que cheio em vez de quase vazio.
 */
function agrupar(chunks: typeof capitulos, tetoChars = 28_000) {
  const grupos: { text: string; titulos: number }[] = [];

  for (const c of chunks) {
    const ultimo = grupos[grupos.length - 1];

    if (ultimo && ultimo.text.length + c.text.length <= tetoChars) {
      ultimo.text += `\n${c.text}`;
      ultimo.titulos += 1;
      continue;
    }

    grupos.push({ text: c.text, titulos: 1 });
  }

  return grupos;
}

const agrupados = agrupar(capitulos);

function blocoAgrupado(modelo: string) {
  const entrada = agrupados.reduce((n, g) => n + tok(g.text.length + PROMPT_FIXO_CHARS), 0);
  const saida = agrupados.length * SAIDA_POR_BLOCO;
  return { usados: agrupados.length, entrada, saida, usd: custo(modelo, entrada, saida) ?? 0 };
}

const bPadrao = bloco(MODELO_PADRAO, BLOCOS_PADRAO);
const bTotal = bloco(MODELO_BLOCO, capitulos.length);
const bAgrupadoSol = blocoAgrupado(MODELO_BLOCO);
const bAgrupadoTerra = blocoAgrupado(MODELO_PADRAO);

const cenarios: Cenario[] = [
  {
    nome: "Padrão (hoje)",
    chamadas: 1 + bPadrao.usados,
    entrada: globalPadrao.entrada + bPadrao.entrada,
    saida: globalPadrao.saida + bPadrao.saida,
    usd:
      (custo(MODELO_PADRAO, globalPadrao.entrada, globalPadrao.saida) ?? 0) + bPadrao.usd,
    cobertura: `${Math.round((charsGlobalPadrao / charsDoc) * 100)}% amostrado + ${bPadrao.usados}/${capitulos.length} capítulos`,
  },
  {
    nome: "Profundo (hoje)",
    chamadas: 1,
    entrada: globalProfundo.entrada,
    saida: globalProfundo.saida,
    usd: custo(MODELO_GLOBAL, globalProfundo.entrada, globalProfundo.saida),
    cobertura: `${Math.round((charsGlobalProfundo / charsDoc) * 100)}% numa leitura só + 0/${capitulos.length} capítulos`,
  },
  {
    nome: "Cobertura total (proposta)",
    chamadas: 1 + bTotal.usados,
    entrada: globalProfundo.entrada + bTotal.entrada,
    saida: globalProfundo.saida + bTotal.saida,
    usd:
      (custo(MODELO_GLOBAL, globalProfundo.entrada, globalProfundo.saida) ?? 0) + bTotal.usd,
    cobertura: `${Math.round((charsGlobalProfundo / charsDoc) * 100)}% numa leitura só + ${bTotal.usados}/${capitulos.length} capítulos`,
  },
  {
    nome: "Cobertura total, blocos AGRUPADOS até 28k",
    chamadas: 1 + bAgrupadoSol.usados,
    entrada: globalProfundo.entrada + bAgrupadoSol.entrada,
    saida: globalProfundo.saida + bAgrupadoSol.saida,
    usd:
      (custo(MODELO_GLOBAL, globalProfundo.entrada, globalProfundo.saida) ?? 0) +
      bAgrupadoSol.usd,
    cobertura: `100% numa leitura só + ${capitulos.length}/${capitulos.length} capítulos em ${bAgrupadoSol.usados} blocos`,
  },
  {
    nome: `Cobertura total, agrupados + blocos no ${MODELO_PADRAO}`,
    chamadas: 1 + bAgrupadoTerra.usados,
    entrada: globalProfundo.entrada + bAgrupadoTerra.entrada,
    saida: globalProfundo.saida + bAgrupadoTerra.saida,
    usd:
      (custo(MODELO_GLOBAL, globalProfundo.entrada, globalProfundo.saida) ?? 0) +
      bAgrupadoTerra.usd,
    cobertura: `100% numa leitura só + ${capitulos.length}/${capitulos.length} capítulos em ${bAgrupadoTerra.usados} blocos`,
  },
];

const usd = (v: number | null) => (v === null ? "sem preço" : `US$ ${v.toFixed(3)}`);
const n = (v: number) => v.toLocaleString("pt-BR");

console.log(`\nArquivo: ${caminho}`);
console.log(
  `${extraido.pageCount} páginas · ${n(charsDoc)} caracteres · ${capitulos.length} capítulos`,
);
console.log(`Modelos: global/bloco ${MODELO_GLOBAL} · padrão ${MODELO_PADRAO}\n`);

for (const c of cenarios) {
  console.log(`  ${c.nome}`);
  console.log(`    chamadas de IA : ${c.chamadas}`);
  console.log(`    tokens entrada : ~${n(c.entrada)}`);
  console.log(`    tokens saída   : ~${n(c.saida)} (teto)`);
  console.log(`    custo estimado : ${usd(c.usd)}`);
  console.log(`    cobertura      : ${c.cobertura}\n`);
}

const profundo = cenarios[1].usd ?? 0;
const total = cenarios[cenarios.length - 1].usd ?? 0;

if (profundo > 0) {
  console.log(
    `A opção mais barata com cobertura completa custa ${(total / profundo).toFixed(2)}× o Profundo de hoje ` +
      `(+${usd(total - profundo)} por auditoria deste memorial).`,
  );
}
console.log(
  "\nSaída é TETO: conta o limite de tokens por bloco, não o que o modelo devolve.\n" +
    "O custo real fica abaixo disto — quanto, só a primeira corrida com a flag ligada diz.",
);
