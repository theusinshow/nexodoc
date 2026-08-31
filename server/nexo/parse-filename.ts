/*
 * COM EXTENSÃO `.ts`, e é isso que torna este módulo provável em node cru.
 *
 * O bundler do Next resolve com ou sem; o `node` com type-stripping só resolve
 * COM. É o mesmo arranjo de `lib/audit-report.ts`, e sem ele a precedência do
 * número da folha — a regra mais consequente deste arquivo — só poderia ser
 * conferida abrindo o navegador.
 */
import { DISCIPLINA_LEXICON } from "./disciplinas.ts";
import { aplicarFolhaManual, reconcileByPageOrder } from "./reconcile-sheets.ts";

/**
 * Parser filename-first do intake do Nexo (Fase 0). A convencao de nomes do
 * escritorio e altamente estruturada e carrega quase todos os fatos objetivos
 * (codigo, revisao, tipo, disciplinas, folha). Determinístico, sem PDF, sem IA.
 *
 * Exemplos reais:
 *   040_26_md_geral_a.pdf                     -> memorial, cod 040-26, rev a
 *   040_26_capa_vol10_his_inc_spd_a.pdf       -> capa, vol 10, disc [his,inc,spd]
 *   040_26_separatriz_his_a.pdf               -> separatriz, disc [his]
 *   040_26_his_001_a.pdf                      -> prancha, disc [his], folha 001
 *   156_25_vol_6_his_inc_cli.pdf              -> volume, vol 6, disc [his,inc,cli]
 *   113_22_arq_a-R00 - 01 - PLANTA ... .pdf   -> prancha, disc [arq], rev a
 */

export type NexoDocTipo =
  | "memorial"
  | "capa"
  | "separatriz"
  | "prancha"
  | "volume"
  | "orcamento"
  | "outro";

export const TIPO_LABEL: Record<NexoDocTipo, string> = {
  memorial: "Memorial",
  capa: "Capa",
  separatriz: "Separatriz",
  prancha: "Prancha",
  volume: "Volume",
  orcamento: "Orcamento (fora de escopo)",
  outro: "Nao identificado",
};

export interface ParsedFilename {
  codigo: string;
  /**
   * O código com o separador ORIGINAL (`040_26`), para o que vai IMPRESSO.
   * `codigo` continua normalizado — ele é identidade, este é grafia.
   */
  codigoComoEscrito: string;
  revisao: string;
  assinado: boolean;
  tipo: NexoDocTipo;
  /** true quando o documento esta fora do escopo do Nexo (orcamento). */
  foraDeEscopo: boolean;
  disciplinas: string[]; // codigos, em ordem de aparicao
  folha?: string;
  volume?: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Número da prancha a partir do NOME do arquivo — AUTORITATIVO na convenção do
 * escritório (<cod>_<disc>_<NNN>_<rev>, ex.: 040_26_est_imp_005_a -> 5). Mais
 * confiável que o OCR do selo (que erra folha/total). É o último grupo de dígitos
 * depois de descartar o código do projeto e um eventual "vol N". null se não houver.
 */
export function sheetNumberFromFilename(fileName: string): number | null {
  const stem = normalize(fileName)
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_ -]?assinado/g, "");
  const afterCode = stem
    .replace(/^\d{2,4}[_-]\d{2}(?!\d)/, "") // tira "040_26"
    .replace(/vol[_ ]?\d+/g, "") // tira "vol10" (raro em prancha)
    .replace(/tomo[_ ]?\d+/g, ""); // tira "tomo1" (PDF combinado por tomo)
  const nums = [...afterCode.matchAll(/\d{1,3}/g)].map((m) => parseInt(m[0], 10));
  return nums.length ? nums[nums.length - 1] : null;
}

/**
 * FONTE ÚNICA da folha de uma prancha, na ordem de confiança correta:
 *   1) campo ARQUIVO do CARIMBO (ex.: "040_26_est_imp_005_a") — carrega o número
 *      da prancha mesmo quando o upload é um PDF COMBINADO por tomo/volume;
 *   2) nome do arquivo enviado (quando as pranchas vêm como arquivos separados);
 *   3) folha do OCR (último recurso, menos confiável).
 * Espelha a lógica provada do módulo LD original (extractSheetNumberFromFileCode).
 */
/**
 * DE ONDE VEIO O VALOR — o vocabulário que a tela usa para dizer proveniência.
 *
 * `carimbo` cobre os dois campos que saem do selo (o código em ARQUIVO e o
 * número da folha lido): para quem confere, os dois são "o que a máquina leu do
 * desenho", e separá-los na tela seria detalhe de implementação. `ordem` é o
 * palpite por posição da página — não é leitura de nada, e é justamente por
 * isso que ele precisa aparecer.
 */
export type OrigemDoNumero = "mao" | "nome" | "carimbo" | "ordem";

/**
 * O número da folha COM a origem — e é esta a implementação, não uma segunda.
 *
 * `sheetNumberFromSelo` passou a ser uma vista desta função. Escrever a
 * precedência duas vezes (uma para decidir, outra para explicar) daria duas
 * verdades sobre a mesma coisa, e a explicação passaria a mentir na primeira
 * regra nova — que é exatamente o defeito que a proveniência existe para
 * impedir.
 */
export function sheetNumberFromSeloComOrigem(selo: {
  arquivo?: string | null;
  fileName?: string | null;
  folha?: number | null;
}): { numero: number | null; origem: OrigemDoNumero | null } {
  if (selo.arquivo) {
    const n = sheetNumberFromFilename(selo.arquivo);
    if (n != null) return { numero: n, origem: "carimbo" };
  }
  if (selo.fileName) {
    const n = sheetNumberFromFilename(selo.fileName);
    if (n != null) return { numero: n, origem: "nome" };
  }
  if (typeof selo.folha === "number" && Number.isFinite(selo.folha) && selo.folha > 0) {
    return { numero: selo.folha, origem: "carimbo" };
  }
  return { numero: null, origem: null };
}

export function sheetNumberFromSelo(selo: {
  arquivo?: string | null;
  fileName?: string | null;
  folha?: number | null;
}): number | null {
  return sheetNumberFromSeloComOrigem(selo).numero;
}

export interface SeloSheetInput {
  fileName: string;
  pageNumber?: number | null;
  arquivo?: string | null;
  folha?: number | null;
  /**
   * Número posto À MÃO pelo engenheiro. VENCE tudo — o código do carimbo, o
   * nome do arquivo, o OCR e a reconciliação por ordem de página.
   *
   * Sem esse canal, corrigir o número não teria efeito: a resolução prefere o
   * campo ARQUIVO do carimbo, e é justamente quando ele está errado que alguém
   * corrige. Uma correção que perde para o parser é pior que não existir — o
   * engenheiro digita, vê o valor voltar, e para de confiar na tela.
   */
  folhaManual?: number | null;
}

/**
 * FOLHA RESOLVIDA de cada selo, com reconciliação por ordem de página. Agrupa por
 * arquivo; num PDF combinado (várias páginas do mesmo arquivo) onde o OCR duplica
 * a folha (ex.: "16" repetido), reatribui pela ORDEM DA PÁGINA (`reconcileByPageOrder`).
 * Arquivos separados (1 página) mantêm a folha do carimbo/nome. É a FONTE ÚNICA da
 * folha para a leitura, a LD e a conferência.
 */
/**
 * A RESOLUÇÃO COM A ORIGEM DE CADA NÚMERO.
 *
 * A origem não é recalculada por uma segunda regra: ela é DEDUZIDA das etapas
 * que já existem, comparando o que cada uma devolveu.
 *
 *   · o candidato traz a sua origem de `sheetNumberFromSeloComOrigem`;
 *   · se a reconciliação por ordem de página MUDOU o valor, a origem passa a
 *     ser `ordem` — o número deixou de ser leitura e virou posição;
 *   · a correção à mão entra por último e vence tudo, como sempre venceu.
 *
 * Deduzir em vez de reimplementar é o que garante que a explicação não possa
 * discordar da decisão.
 */
export function resolveSheetNumbersComOrigem(
  selos: SeloSheetInput[],
): { numero: number | null; origem: OrigemDoNumero | null }[] {
  const comOrigem = selos.map((s) =>
    sheetNumberFromSeloComOrigem({ arquivo: s.arquivo, fileName: s.fileName, folha: s.folha }),
  );
  const resolvidas = resolveSheetNumbers(selos);

  return resolvidas.map((numero, i) => {
    const manual = selos[i].folhaManual;
    if (typeof manual === "number" && Number.isFinite(manual) && manual > 0) {
      return { numero, origem: "mao" };
    }
    // Valor diferente do candidato = a reconciliação por ordem entrou. Cobre
    // também o caso em que ela INVENTA um número onde não havia leitura nenhuma.
    if (numero !== comOrigem[i].numero) return { numero, origem: "ordem" };
    return { numero, origem: comOrigem[i].origem };
  });
}

export function resolveSheetNumbers(selos: SeloSheetInput[]): (number | null)[] {
  const candidates = selos.map((s) =>
    sheetNumberFromSelo({ arquivo: s.arquivo, fileName: s.fileName, folha: s.folha }),
  );
  const byFile = new Map<string, number[]>();
  selos.forEach((s, i) => {
    const key = s.fileName || "";
    const arr = byFile.get(key);
    if (arr) arr.push(i);
    else byFile.set(key, [i]);
  });

  const result: (number | null)[] = [...candidates];
  for (const idxs of byFile.values()) {
    const items = idxs.map((i) => ({
      pageNumber: selos[i].pageNumber ?? 1,
      candidate: candidates[i],
    }));
    const resolved = reconcileByPageOrder(items);
    idxs.forEach((i, k) => {
      result[i] = resolved[k];
    });
  }

  // A correção à mão entra POR ÚLTIMO, por cima de tudo. A regra (e o porquê)
  // mora no núcleo puro, que é onde ela pode ser testada com node cru.
  return aplicarFolhaManual(
    result,
    selos.map((s) => s.folhaManual),
  );
}

/**
 * Codigo do projeto: NNN_NN / NNN-NN no INICIO do nome (nao o rodape da prancha).
 * Sem `\b` no fim: underscore e word-char, entao "040_26_vol" nunca casaria \b.
 */
function parseCodigo(fileName: string): string {
  const m = /^(\d{2,4})[_-](\d{2})(?!\d)/.exec(fileName.trim());
  return m ? `${m[1]}-${m[2]}` : "";
}

/**
 * O código COMO O DOCUMENTO O ESCREVE — com o separador original.
 *
 * `parseCodigo` normaliza para hífen, e tem de continuar normalizando: é ele
 * que agrupa a pasta do projeto, e `040_26` e `040-26` precisam cair no mesmo
 * lugar. Mas o que vai IMPRESSO no rodapé segue o documento.
 *
 * Medido em 31/08/2026 nas 55 LDs de `docs/samples`: o separador do rodapé
 * segue o do nome do arquivo em **54 de 55**. O Nexo imprimia `088-25` num
 * projeto cujos arquivos são `088_25_met_*`, e o escritório entrega `088_25`.
 */
function parseCodigoComoEscrito(fileName: string): string {
  const m = /^(\d{2,4})([_-])(\d{2})(?!\d)/.exec(fileName.trim());
  return m ? `${m[1]}${m[2]}${m[3]}` : "";
}

/** Revisao: ultima letra isolada antes da extensao/_assinado/descritivo. */
function parseRevisao(stem: string): string {
  const head = stem.split(/\s+-\s+/)[0]; // descarta " - 01 - PLANTA ..."
  const matches = [...head.matchAll(/[_ -]([a-z])(?=-r\d|[-_ .]|$)/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  return matches.length ? matches[matches.length - 1] : "";
}

function parseVolume(tokens: string[], fileName: string, relPath?: string): string | undefined {
  const volTok = /vol[_ ]?(\d{1,2})/i.exec(fileName);
  if (volTok) return volTok[1];
  // "vol_6" vira tokens ["vol","6"]
  const idx = tokens.indexOf("vol");
  if (idx >= 0 && /^\d{1,2}$/.test(tokens[idx + 1] ?? "")) return tokens[idx + 1];
  // pasta do volume: "10_his_inc_spd" -> 10
  const folder = relPath?.split(/[\\/]/).find((seg) => /^\d{1,2}_/.test(seg));
  const fm = folder && /^(\d{1,2})_/.exec(folder);
  return fm ? fm[1] : undefined;
}

export function parseFilename(fileName: string, relPath?: string): ParsedFilename {
  const norm = normalize(fileName);
  const stem = norm.replace(/\.[a-z0-9]+$/, "");
  const assinado = /assinado/.test(stem);
  const clean = stem.replace(/[_ -]?assinado/g, "");

  const nameTokens = clean.split(/[^a-z0-9]+/).filter(Boolean);
  const pathTokens = normalize(relPath ?? "")
    .split(/[\\/]/)
    .join("_")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const codigo = parseCodigo(fileName);
  const codigoComoEscrito = parseCodigoComoEscrito(fileName);
  const revisao = parseRevisao(clean);
  const volume = parseVolume(nameTokens, norm, relPath);

  // Disciplinas do NOME sao autoritativas (a prancha carrega a sua). A pasta so
  // entra como fallback quando o nome nao tem nenhuma (evita o volume his_inc_spd
  // contaminar uma prancha que e so "his").
  const pick = (toks: string[]) => {
    const out: string[] = [];
    for (const t of toks) if (DISCIPLINA_LEXICON[t] && !out.includes(t)) out.push(t);
    return out;
  };
  const fromName = pick(nameTokens);
  const disciplinas = fromName.length > 0 ? fromName : pick(pathTokens);

  const folhaMatch = /(?:^|[_ -])(\d{3})(?=[_ -]|$)/.exec(clean);
  const folha = folhaMatch ? folhaMatch[1] : undefined;

  const has = (re: RegExp) => re.test(clean);

  let tipo: NexoDocTipo;
  let foraDeEscopo = false;
  if (has(/orcamento/)) {
    tipo = "orcamento";
    foraDeEscopo = true;
  } else if (has(/\b(md|memorial)\b/) || /(^|_)md(_|$)/.test(clean)) {
    tipo = "memorial";
  } else if (has(/separatriz/)) {
    tipo = "separatriz";
  } else if (has(/capas?\b/) || /(^|_)capas?(_|$)/.test(clean)) {
    tipo = "capa";
  } else if (has(/(^|_)vol[_ ]?\d/)) {
    tipo = "volume";
  } else if (folha || disciplinas.length > 0) {
    tipo = "prancha";
  } else {
    tipo = "outro";
  }

  return {
    codigo,
    codigoComoEscrito,
    revisao,
    assinado,
    tipo,
    foraDeEscopo,
    disciplinas,
    folha,
    volume,
  };
}
