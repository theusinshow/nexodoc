import {
  parseFilename,
  sheetNumberFromFilename,
  sheetNumberFromSelo,
} from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";
import type { CreateLDInput } from "./tools/create-ld";

/** Um selo lido de uma prancha (subconjunto do StampExtraction que interessa aqui). */
export interface SeloForLd {
  fileName: string;
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
  /** Valor do campo ARQUIVO do selo (código da prancha) — vai na coluna ARQUIVOS. */
  arquivo: string | null;
  conteudo: string | null;
  cliente: string | null;
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

/** Todos os números (>0) que um selo carrega — base para o total de referência. */
function seloNumbers(s: SeloForLd): number[] {
  const out: number[] = [];
  if (typeof s.total === "number") out.push(s.total);
  if (typeof s.folha === "number") out.push(s.folha);
  const fromArquivo = s.arquivo ? sheetNumberFromFilename(s.arquivo) : null;
  if (fromArquivo != null) out.push(fromArquivo);
  const fromName = sheetNumberFromFilename(s.fileName);
  if (fromName != null) out.push(fromName);
  if (s.numeroFolha) {
    for (const m of s.numeroFolha.matchAll(/\d+/g)) out.push(parseInt(m[0], 10));
  }
  return out.filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * "NN/TT" com o TOTAL fixado no total de referência da LD (todas as folhas de uma
 * LD compartilham o mesmo total — regra do escritório). A folha vem do campo
 * dedicado `folha` (mais confiável) e, na falta, do 1º número de `numeroFolha`.
 * NÃO adivinha inversão folha↔total (isso perdia folhas quando o OCR lia o total
 * baixo, ex.: "16/15" para a folha 16); a ambiguidade residual fica visível na
 * pré-visualização para o engenheiro corrigir antes de gerar.
 */
function normalizeSheet(
  numeroFolha: string | null,
  folha: number | null,
  referenceTotal: number,
): string {
  let n: number | null = folha != null && Number.isFinite(folha) ? folha : null;
  if (n == null && numeroFolha) {
    const m = /(\d+)/.exec(numeroFolha);
    if (m) n = parseInt(m[1], 10);
  }
  if (n == null || Number.isNaN(n)) return "";
  if (referenceTotal > 0) {
    return `${String(n).padStart(2, "0")}/${String(referenceTotal).padStart(2, "0")}`;
  }
  return String(n).padStart(2, "0");
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

/** Escolhe o valor mais frequente (não-vazio) entre os selos. */
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

export interface BuildLdOptions {
  /** Tomo ESPECÍFICO desta LD (ex.: 6 -> título "... (TOMO 06)"); 0 = sem tomo. */
  tomo?: number;
  /** Título da seção (decisão do engenheiro). Vazio = palpite do selo. */
  tituloLd?: string;
}

/**
 * Monta uma proposta de LD a partir dos selos lidos das pranchas + o nome dos
 * arquivos (parser). Determinístico: o engenheiro revisa/confirma antes de gerar.
 * `tomo` (opcional) rotula a LD como um tomo específico (o engenheiro gera um por vez).
 */
export function buildLdProposal(
  selos: SeloForLd[],
  opts: BuildLdOptions = {},
): LdProposal {
  const tomo = Math.max(0, Math.floor(opts.tomo ?? 0));
  const validos = selos.filter((s) => s.fileName);

  // Identidade: filename (código/revisão) + selo (obra/cliente/fase/disciplina).
  const parsedList = validos.map((s) => parseFilename(s.fileName));
  const codigo = mode(parsedList.map((p) => p.codigo)) || "";
  const revisao = mode(parsedList.map((p) => p.revisao)) || "a";

  // Disciplina: preferir o código do nome (autoritativo); rótulo p/ exibição.
  const discCode =
    mode(parsedList.flatMap((p) => p.disciplinas)) ||
    mode(validos.map((s) => s.disciplina)).toLowerCase();
  const discLabel = (disciplinaLabel(discCode) ?? (discCode || "GERAL")).toUpperCase();

  const obra = mode(validos.map((s) => s.obra));
  const cliente = mode(validos.map((s) => s.cliente));
  const fase = mode(validos.map((s) => s.fase)) || "PROJETO EXECUTIVO";

  // Total de referência: o MAIOR número visto entre todos os selos (a folha nunca
  // excede o total, então o máximo global é o total da LD). Resiste ao total lido
  // baixo em folhas isoladas; a pré-visualização mostra o resultado ao engenheiro.
  const allNums = validos.flatMap(seloNumbers);
  const referenceTotal = allNums.length ? Math.max(...allNums) : validos.length;

  const rows = validos
    .map((s) => ({
      // Folha: ARQUIVO do carimbo -> nome do upload -> OCR (fonte única).
      sheet: normalizeSheet(
        s.numeroFolha,
        sheetNumberFromSelo({ arquivo: s.arquivo, fileName: s.fileName, folha: s.folha }),
        referenceTotal,
      ),
      // Coluna ARQUIVOS = campo ARQUIVO do selo (código da prancha); só cai no
      // nome do PDF quando o selo não trouxe (ex.: PDF combinado sem esse campo).
      file: s.arquivo?.trim() || s.fileName,
      description: (s.conteudo || s.tituloSecao || "").trim(),
      readDiscipline: (s.disciplina || discCode || "").toUpperCase(),
    }))
    .sort((a, b) => sheetOrder(a.sheet) - sheetOrder(b.sheet));

  // Título da seção: manual (decisão do engenheiro) OU palpite do selo (descarta
  // captura de órgão/secretaria) OU "PROJETO <disciplina>". O "(TOMO 0N)" é
  // anexado quando é um tomo específico.
  const tituloBase =
    opts.tituloLd?.trim() ||
    mode(
      validos.map((s) =>
        s.tituloSecao && !isOrgaoLike(s.tituloSecao) ? s.tituloSecao : null,
      ),
    ) ||
    `PROJETO ${discLabel}`;
  const sectionTitle =
    tomo > 0 ? `${tituloBase} (TOMO ${String(tomo).padStart(2, "0")})` : tituloBase;

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
    tomos: [],
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
