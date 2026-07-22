import { DISCIPLINA_LEXICON } from "./disciplinas";

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
    .replace(/vol[_ ]?\d+/g, ""); // tira "vol10" (raro em prancha)
  const nums = [...afterCode.matchAll(/\d{1,3}/g)].map((m) => parseInt(m[0], 10));
  return nums.length ? nums[nums.length - 1] : null;
}

/**
 * Codigo do projeto: NNN_NN / NNN-NN no INICIO do nome (nao o rodape da prancha).
 * Sem `\b` no fim: underscore e word-char, entao "040_26_vol" nunca casaria \b.
 */
function parseCodigo(fileName: string): string {
  const m = /^(\d{2,4})[_-](\d{2})(?!\d)/.exec(fileName.trim());
  return m ? `${m[1]}-${m[2]}` : "";
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

  return { codigo, revisao, assinado, tipo, foraDeEscopo, disciplinas, folha, volume };
}
