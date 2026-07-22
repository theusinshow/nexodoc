import { getTemplateRegistry } from "@/server/templates/registry";
import { parseFilename } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";
import { generatePages } from "@/modules/cover-generator/hooks/helpers";
import { formatDisplayCode } from "@/lib/cover-utils";
import { MESES } from "@/modules/cover-generator/constants";
import type { SeloForLd } from "./build-ld-proposal";
import type {
  GeneralData,
  CoverGroup,
  CoverPage,
} from "@/modules/cover-generator/types";

/**
 * Monta a proposta de capa (Nexo) a partir dos selos ja lidos das pranchas + o
 * template da prefeitura escolhida. Deterministico: converte os fatos objetivos
 * (codigo, revisao, disciplina, volume, obra, fase) no input que o `generateCovers`
 * ja espera. O engenheiro revisa/edita antes de gerar. Uma unica capa (um grupo).
 */

export interface BuildCapaInput {
  selos: SeloForLd[];
  templateId: string;
  /** Decisao editavel; default = rotulo da disciplina. */
  tituloCapa?: string;
  /** Override opcional; senao vem do parseFilename (arabico). */
  volume?: string;
  /** Decisao do engenheiro: projeto grande dividido em N tomos. Default 1. */
  numTomos?: number;
  /** Mes da capa (ex.: "JUNHO"); as vezes difere do mes atual. Default = mes atual. */
  mes?: string;
  /** Ano da capa (ex.: "2026"). Default = ano atual. */
  ano?: string;
}

export interface CapaProposal {
  generalData: GeneralData;
  pages: CoverPage[];
  resumo: {
    prefeitura: string;
    disciplina: string;
    codigo: string;
    volume: string;
    tomos: number;
    totalCapas: number;
  };
}

/** Escolhe o valor mais frequente (nao-vazio) entre os candidatos. */
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
 * Arabico -> romano, alinhado ao que VOLUME_OPTIONS_ROMAN codifica ("I".."X") e ao
 * que formatVolume espera (o valor cru, sem o prefixo "Vol. ", que o formatVolume
 * adiciona). Cobre alem de 10 para robustez; casos reais ficam em 1-10.
 */
/** "II"/"iv" -> 2/4. 0 se não for romano válido. Tolerante a lixo em volta. */
function romanToArabic(value: string): number {
  const up = value.toUpperCase().replace(/[^IVXLCDM]/g, "");
  if (!up) return 0;
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let prev = 0;
  for (let i = up.length - 1; i >= 0; i--) {
    const val = map[up[i]];
    if (val < prev) total -= val;
    else {
      total += val;
      prev = val;
    }
  }
  return total;
}

/**
 * Normaliza QUALQUER forma de volume para o número arábico cru: "3"/"vol 3"/
 * "Volume 3"/"III" -> "3"; vazio -> "". Blinda contra o antigo colapso silencioso
 * pra "I" quando chegava algo não-arábico. Dígito no texto vence (mais direto);
 * senão tenta romano.
 */
function toArabicVolume(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const digits = s.match(/\d+/);
  if (digits) return String(parseInt(digits[0], 10));
  const roman = romanToArabic(s);
  return roman > 0 ? String(roman) : "";
}

function arabicToRoman(arabic: string): string {
  const n = parseInt(arabic, 10);
  if (!Number.isFinite(n) || n <= 0) return "I";
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [value, symbol] of table) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export async function buildCapaProposal(
  input: BuildCapaInput,
): Promise<CapaProposal> {
  const registry = await getTemplateRegistry();
  const template = registry.find((t) => t.id === input.templateId);
  if (!template) {
    throw new Error(
      `Template de capa nao encontrado: "${input.templateId}". Verifique templates/capas/*/config.json.`,
    );
  }

  const validos = input.selos.filter((s) => s.fileName);
  const parsedList = validos.map((s) => parseFilename(s.fileName));

  // Disciplina: preferir o codigo do nome (autoritativo); rotulo p/ exibicao.
  const discCode =
    mode(parsedList.flatMap((p) => p.disciplinas)) ||
    mode(validos.map((s) => s.disciplina)).toLowerCase();
  const discLabel = disciplinaLabel(discCode) ?? "";

  // Codigo: manter a forma com underscore do proprio arquivo quando existir
  // (ex.: "040_26"); senao a forma normalizada do parser (ex.: "040-26").
  const codigoFormatado = mode(parsedList.map((p) => p.codigo));
  const codigoUnderscore = mode(
    validos.map((s) => {
      const m = /^(\d{2,4})_(\d{2})(?!\d)/.exec(s.fileName.trim());
      return m ? `${m[1]}_${m[2]}` : "";
    }),
  );
  const codigoInterno = codigoUnderscore || codigoFormatado;
  const codigoExibido = codigoInterno
    ? formatDisplayCode(codigoInterno)
    : codigoFormatado;

  const revisao = mode(parsedList.map((p) => p.revisao));
  const nomeObra = mode(validos.map((s) => s.obra));
  const fase = mode(validos.map((s) => s.fase)) || template.defaults.fase;

  // Volume: override -> parseFilename (arabico) -> default. Converte p/ romano
  // quando o template pede; formatVolume so adiciona "Vol. ", nao converte.
  // Override do engenheiro -> nome do arquivo; qualquer forma vira arábico cru.
  const volumeArabic = toArabicVolume(
    input.volume ?? mode(parsedList.map((p) => p.volume)),
  );
  let volumeValue: string;
  if (template.volumeFormat === "numeric") {
    volumeValue = volumeArabic || "1";
  } else {
    // roman (default do formatVolume/generatePages)
    volumeValue = volumeArabic ? arabicToRoman(volumeArabic) : "I";
  }

  // Tomos: decisao do engenheiro (projeto grande -> divide). Default 1.
  const numTomos = Math.max(1, Math.floor(input.numTomos ?? 1));

  // Mês/ano: override do engenheiro (às vezes a capa é de outro mês) -> data atual.
  const now = new Date();
  const mes = input.mes?.trim() || MESES[now.getMonth()];
  const ano = input.ano?.trim() || String(now.getFullYear());

  const generalData: GeneralData = {
    templateId: template.id,
    orgao: template.defaults.orgao,
    secretaria: template.defaults.secretaria,
    nomeObra,
    fase,
    mes,
    ano,
    codigoInterno,
    codigoExibido,
    siglaArquivo: discCode,
    revisao,
  };

  const group: CoverGroup = {
    id: "nexo-capa",
    tituloCapa: input.tituloCapa ?? disciplinaLabel(discCode) ?? "PROJETO",
    disciplina: discLabel,
    volume: volumeValue,
    tomoMode: "quantity",
    tomoQuantity: numTomos,
    tomoList: [],
  };

  const pages = generatePages(
    [group],
    undefined,
    template.volumeFormat,
    template.tomoFormat,
  );

  return {
    generalData,
    pages,
    resumo: {
      prefeitura: template.grupo ?? template.nome,
      disciplina: discLabel,
      codigo: codigoExibido,
      volume: volumeValue,
      tomos: numTomos,
      totalCapas: pages.length,
    },
  };
}
