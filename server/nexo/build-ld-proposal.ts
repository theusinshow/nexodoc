import { parseFilename, resolveSheetNumbers } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";
import { formatSheet, buildBalancedTomos, type Tomo } from "@/lib/ld/ld-rules";
import { cleanStampDescription } from "@/lib/ld/stamp-parsing";
import type { CreateLDInput } from "./tools/create-ld";

/** Um selo lido de uma prancha (subconjunto do StampExtraction que interessa aqui). */
export interface SeloForLd {
  fileName: string;
  /** Página do selo dentro do PDF (p/ reconciliar folha em PDF combinado). */
  pageNumber?: number | null;
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  /** Valor do campo ARQUIVO do selo (código da prancha) — vai na coluna ARQUIVOS. */
  arquivo: string | null;
  conteudo: string | null;
  cliente: string | null;
  /** Secretaria/órgão emissor lido no cabeçalho do carimbo (p/ a capa). */
  secretaria: string | null;
  obra: string | null;
  fase: string | null;
  tituloSecao: string | null;
}

export interface LdProposal {
  input: CreateLDInput;
  /** Diagnóstico p/ a UI: o que foi inferido e de onde. */
  resumo: {
    disciplina: string;
    codigo: string;
    revisao: string;
    obra: string;
    totalFolhas: number;
  };
}

/** Parse do nome, preferindo o código do CARIMBO (per-prancha) ao nome do upload
 *  (que num PDF combinado é o do tomo/volume, sem folha/revisão por prancha). */
function parseSelo(s: SeloForLd) {
  return parseFilename(s.arquivo?.trim() || s.fileName);
}

function sheetOrder(sheet: string): number {
  const n = parseInt(sheet.split("/")[0] ?? "", 10);
  return Number.isNaN(n) ? 9999 : n;
}

/**
 * Detecta texto de órgão/secretaria que o OCR às vezes captura no campo de título
 * ("SECRETARIA DE DESENVOLVIMENTO... SEDES"). Não serve como título da LD — o
 * título é técnico ("PROJETO ESTRUTURAL"). Usado para descartar esses valores.
 */
function isOrgaoLike(value: string): boolean {
  return /\b(secretaria|prefeitura|municipal|munic[íi]pio|departamento|sedes|gabinete|funda[çc][ãa]o|governo)\b/i.test(
    value,
  );
}

/** Só pranchas: exclui capa/memorial/separatriz/orçamento/volume lidos por engano. */
function isPranchaSelo(s: SeloForLd): boolean {
  const t = parseSelo(s).tipo;
  return t !== "capa" && t !== "memorial" && t !== "separatriz" && t !== "orcamento" && t !== "volume";
}

/** Valor mais frequente (não-vazio) entre os selos — para strings. */
function mode(values: (string | null | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = v?.trim();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** Valor mais frequente (>0) — para números (total dominante). */
function modeNumber(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) if (Number.isFinite(v) && v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/** Rótulo da disciplina desta prancha (LABEL), para casar com o LABEL da LD e
 *  não disparar falso "disciplina divergente" (o validador compara rótulos). */
function rowDisciplineLabel(s: SeloForLd): string {
  const parsed = parseSelo(s);
  const code = parsed.disciplinas[0] || (s.disciplina ? s.disciplina.toLowerCase() : "");
  return (disciplinaLabel(code) ?? s.disciplina ?? "").toUpperCase();
}

export interface BuildLdOptions {
  /** Divide as folhas em N tomos balanceados (decisão do engenheiro). Default 1. */
  numTomos?: number;
  /** Tomo ESPECÍFICO (ex.: 4): a seção vira "... (TOMO 04)". 0 = usar numTomos. */
  tomoNumero?: number;
  /**
   * A partir de qual tomo CONTAR (default 1). A numeração pertence ao VOLUME:
   * se outra disciplina do mesmo volume já ocupou 01-03, aqui vem 4. Precisa
   * casar com o `tomoInicial` da capa, senão LD e capa discordam no volume.
   */
  tomoInicial?: number;
  /** Título da seção (decisão do engenheiro). Vazio = palpite do selo. */
  tituloLd?: string;
}

/**
 * Monta uma proposta de LD a partir dos selos lidos das pranchas. Determinístico:
 * o engenheiro revisa/confirma antes de gerar. `numTomos` > 1 divide as folhas em
 * tomos balanceados (o motor `ld-generation` cria uma seção "(TOMO N)" por tomo).
 * A folha vem do CARIMBO (ARQUIVO), o total é o DOMINANTE (resiste a OCR ruim), a
 * descrição é limpa dos rótulos do carimbo, e não-pranchas são filtradas.
 */
export function buildLdProposal(
  selos: SeloForLd[],
  opts: BuildLdOptions = {},
): LdProposal {
  // Tomo específico (replicar 1 tomo) tem prioridade sobre dividir-em-N.
  const tomoNumero = Math.max(0, Math.floor(opts.tomoNumero ?? 0));
  const numTomos = tomoNumero > 0 ? 1 : Math.max(1, Math.floor(opts.numTomos ?? 1));
  const tomoInicial = Math.max(1, Math.floor(opts.tomoInicial ?? 1) || 1);
  const validos = selos.filter((s) => (s.fileName || s.arquivo) && isPranchaSelo(s));

  // Identidade: preferir o código do CARIMBO (per-prancha).
  const parsedList = validos.map(parseSelo);
  const codigo = mode(parsedList.map((p) => p.codigo)) || "";
  const revisao = mode(parsedList.map((p) => p.revisao)) || "a";

  const discCode =
    mode(parsedList.flatMap((p) => p.disciplinas)) ||
    mode(validos.map((s) => s.disciplina)).toLowerCase();
  const discLabel = (disciplinaLabel(discCode) ?? (discCode || "GERAL")).toUpperCase();

  const obra = mode(validos.map((s) => s.obra));
  const cliente = mode(validos.map((s) => s.cliente));
  const fase = mode(validos.map((s) => s.fase)) || "PROJETO EXECUTIVO";

  // Total de referência ROBUSTO: total DOMINANTE (o /TT mais frequente — resiste a
  // um total mal-lido isolado) OU a maior folha real OU a contagem. NÃO é o max de
  // números soltos (que inflava e inventava folhas faltando).
  const dominantTotal = modeNumber(
    validos.map((s) => s.total).filter((t): t is number => typeof t === "number"),
  );
  // Folha RESOLVIDA (reconciliação por ordem de página em PDF combinado).
  const resolvedSheets = resolveSheetNumbers(validos);
  const sheets = resolvedSheets.filter((n): n is number => n != null && n > 0);
  const maxSheet = sheets.length ? Math.max(...sheets) : 0;
  const referenceTotal = Math.max(dominantTotal, maxSheet, validos.length);

  const rows = validos
    .map((s, i) => {
      const n = resolvedSheets[i];
      const sheet =
        n != null && n > 0
          ? referenceTotal > 0
            ? formatSheet(n, referenceTotal) // padding largura-do-total
            : String(n).padStart(2, "0")
          : "";
      return {
        sheet,
        // Coluna ARQUIVOS = campo ARQUIVO do carimbo (código da prancha).
        file: s.arquivo?.trim() || s.fileName,
        // Descrição limpa dos rótulos do carimbo (IMP/DATA/REV...) — motor provado
        // do módulo LD original, agora compartilhado em lib/ld/stamp-parsing.
        description: cleanStampDescription(s.conteudo || s.tituloSecao || ""),
        readDiscipline: rowDisciplineLabel(s),
      };
    })
    .sort((a, b) => sheetOrder(a.sheet) - sheetOrder(b.sheet));

  // Título da seção: manual (decisão) OU palpite do selo (descarta órgão/secretaria)
  // OU "PROJETO <disciplina>". Remove "(TOMO ...)" digitado; o tomo é anexado a
  // seguir (específico) ou por faixa pelo ld-generation (dividir-em-N).
  const tituloBase = (
    opts.tituloLd?.trim() ||
    mode(
      validos.map((s) =>
        s.tituloSecao && !isOrgaoLike(s.tituloSecao) ? s.tituloSecao : null,
      ),
    ) ||
    `PROJETO ${discLabel}`
  )
    .replace(/\s*\(\s*tomo[^)]*\)\s*$/i, "")
    .trim();
  // Tomo único, mas numerado: seja por tomo específico, seja por contagem
  // deslocada (1 tomo começando no 04), a seção precisa dizer qual tomo é.
  const tomoUnicoRotulado =
    tomoNumero > 0 ? tomoNumero : numTomos === 1 && tomoInicial > 1 ? tomoInicial : 0;
  const sectionTitle =
    tomoUnicoRotulado > 0
      ? `${tituloBase} (TOMO ${String(tomoUnicoRotulado).padStart(2, "0")})`
      : tituloBase;

  // Tomos: divide as folhas em N faixas balanceadas (motor provado do módulo LD).
  const tomosBase: Tomo[] =
    numTomos > 1 && referenceTotal > 0
      ? buildBalancedTomos(referenceTotal, numTomos)
      : [];
  // Contagem deslocada: as FAIXAS de folhas não mudam — só os rótulos avançam,
  // porque a numeração é do volume. O motor do módulo LD sempre rotula a partir
  // de 1, e não é mexido aqui (ele é compartilhado com a tela de LD).
  const tomos: Tomo[] =
    tomoInicial > 1
      ? tomosBase.map((t, i) => ({
          ...t,
          id: tomoInicial + i,
          title: `TOMO ${tomoInicial + i}`,
        }))
      : tomosBase;

  const input: CreateLDInput = {
    ldData: {
      projectCode: codigo,
      formattedCode: codigo,
      discipline: discLabel,
      revision: revisao,
      sectionTitle,
      client: cliente,
      workName: obra,
      phase: fase,
    },
    rows,
    tomos,
    referenceTotal,
    // Proposta: não bloqueia na geração; a UI mostra os avisos e o engenheiro decide.
    enforceValidation: false,
  };

  return {
    input,
    resumo: {
      disciplina: discLabel,
      codigo,
      revisao,
      obra,
      totalFolhas: rows.length,
    },
  };
}
