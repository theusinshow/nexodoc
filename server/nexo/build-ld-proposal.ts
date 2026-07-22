import { parseFilename } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";
import { buildBalancedTomos } from "@/lib/ld/ld-rules";
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

/**
 * "1" -> "01/07"; mantém "NN/TT" quando já vier assim. Corrige a INVERSÃO folha↔total
 * (o OCR às vezes devolve "16/05" para a folha 5 de 16): a folha nunca excede o total,
 * então se n > t o par é desfeito. `numeroFolha` (formato PRANCHA) tem prioridade;
 * senão usa folha/total.
 */
function normalizeSheet(numeroFolha: string | null, folha: number | null, total: number | null): string {
  let n: number | null = null;
  let t: number | null = null;
  const m = numeroFolha ? /(\d+)\s*\/\s*(\d+)/.exec(numeroFolha) : null;
  if (m) {
    n = parseInt(m[1], 10);
    t = parseInt(m[2], 10);
  } else if (folha != null) {
    n = folha;
    t = total;
  }
  if (n == null || Number.isNaN(n)) return "";
  // Folha > total => veio invertido; desfaz.
  if (t != null && !Number.isNaN(t) && t > 0 && n > t) [n, t] = [t, n];
  if (t == null || Number.isNaN(t)) return String(n).padStart(2, "0");
  return `${String(n).padStart(2, "0")}/${String(t).padStart(2, "0")}`;
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

/**
 * Monta uma proposta de LD a partir dos selos lidos das pranchas + o nome dos
 * arquivos (parser). Determinístico: o engenheiro revisa/confirma antes de gerar.
 * `numTomos` (decisão do engenheiro) divide as folhas em tomos balanceados.
 */
export function buildLdProposal(selos: SeloForLd[], numTomos = 1): LdProposal {
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
      // Coluna ARQUIVOS = campo ARQUIVO do selo (código da prancha); só cai no
      // nome do PDF quando o selo não trouxe (ex.: PDF combinado sem esse campo).
      file: s.arquivo?.trim() || s.fileName,
      description: (s.conteudo || s.tituloSecao || "").trim(),
      readDiscipline: (s.disciplina || discCode || "").toUpperCase(),
    }))
    .sort((a, b) => sheetOrder(a.sheet) - sheetOrder(b.sheet));

  const referenceTotal =
    Math.max(0, ...validos.map((s) => s.total ?? 0)) || rows.length || null;

  // Tomos: decisão do engenheiro. >1 divide as folhas em faixas balanceadas.
  const total = referenceTotal ?? rows.length;
  const tomos =
    numTomos > 1 && total > 0 ? buildBalancedTomos(total, numTomos) : [];

  const input: CreateLDInput = {
    ldData: {
      projectCode: codigo,
      formattedCode: codigo,
      discipline: discLabel,
      revision: revisao,
      // Título técnico da seção; descarta captura de órgão/secretaria pelo OCR.
      sectionTitle:
        mode(
          validos.map((s) =>
            s.tituloSecao && !isOrgaoLike(s.tituloSecao) ? s.tituloSecao : null,
          ),
        ) || `PROJETO ${discLabel}`,
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
