import { parseFilename } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";
import type { CreateLDInput } from "./tools/create-ld";

/** Um selo lido de uma prancha (subconjunto do StampExtraction que interessa aqui). */
export interface SeloForLd {
  fileName: string;
  disciplina: string | null;
  folha: number | null;
  total: number | null;
  numeroFolha: string | null;
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

/** "1" -> "01/07"; mantém "NN/TT" quando já vier assim. */
function normalizeSheet(numeroFolha: string | null, folha: number | null, total: number | null): string {
  if (numeroFolha && /\d+\s*\/\s*\d+/.test(numeroFolha)) {
    const [n, t] = numeroFolha.split("/").map((s) => s.trim());
    return `${n.padStart(2, "0")}/${t.padStart(2, "0")}`;
  }
  if (folha != null && total != null) {
    return `${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`;
  }
  if (folha != null) return String(folha).padStart(2, "0");
  return "";
}

function sheetOrder(sheet: string): number {
  const n = parseInt(sheet.split("/")[0] ?? "", 10);
  return Number.isNaN(n) ? 9999 : n;
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

/**
 * Monta uma proposta de LD a partir dos selos lidos das pranchas + o nome dos
 * arquivos (parser). Determinístico: o engenheiro revisa/confirma antes de gerar.
 */
export function buildLdProposal(selos: SeloForLd[]): LdProposal {
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

  const rows = validos
    .map((s) => ({
      sheet: normalizeSheet(s.numeroFolha, s.folha, s.total),
      file: s.fileName,
      description: (s.conteudo || s.tituloSecao || "").trim(),
      readDiscipline: (s.disciplina || discCode || "").toUpperCase(),
    }))
    .sort((a, b) => sheetOrder(a.sheet) - sheetOrder(b.sheet));

  const referenceTotal =
    Math.max(0, ...validos.map((s) => s.total ?? 0)) || rows.length || null;

  const input: CreateLDInput = {
    ldData: {
      projectCode: codigo,
      formattedCode: codigo,
      discipline: discLabel,
      revision: revisao,
      sectionTitle: mode(validos.map((s) => s.tituloSecao)) || `PROJETO ${discLabel}`,
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
