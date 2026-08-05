import { getTemplateRegistry } from "@/server/templates/registry";
import { parseFilename } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";
import { generatePages } from "@/modules/cover-generator/hooks/helpers";
import { formatDisplayCode, tomoLabels } from "@/lib/cover-utils";
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
  /** Título técnico (opcional); default = rótulo da disciplina do template. */
  tituloCapa?: string;
  /** Override opcional; senao vem do parseFilename (arabico). */
  volume?: string;
  /** Tomo ESPECÍFICO (ex.: 4 = "TOMO 04"), para replicar 1 tomo. 0 = usar numTomos. */
  tomoNumero?: number;
  /** Divide em N tomos (uma capa por tomo, "TOMO 0N"). Default 1. */
  numTomos?: number;
  /**
   * A partir de qual tomo CONTAR (default 1). A numeração pertence ao VOLUME:
   * se outra disciplina do mesmo volume já ocupou 01-03, aqui vem 4.
   */
  tomoInicial?: number;
  /**
   * A IDENTIDADE DO PROJETO dita por uma pessoa. Vence o carimbo e o nome do
   * arquivo — quem digitou olhou a prancha; o resto inferiu.
   *
   * Campo vazio/ausente = "use o que o carimbo disse", que é o comportamento de
   * sempre. Ver `modules/nexo/lib/identidade.ts`.
   */
  orgao?: string;
  /** Override da secretaria. Vence o carimbo (antes perdia — ver abaixo). */
  secretaria?: string;
  obra?: string;
  fase?: string;
  codigo?: string;
  revisao?: string;
  /**
   * Bairro da obra, subtítulo da capa. Só sai nos templates que trazem
   * `{{BAIRRO}}`; nos outros é ignorado sem erro.
   */
  bairro?: string;
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
/**
 * O MÊS da capa, sempre por extenso — venha ele como for.
 *
 * A capa imprime "JUNHO"; o chat trafega "6". Os dois formatos existem por bons
 * motivos (o chip do slot manda um número, o campo do editor aceita o nome), e
 * enquanto o campo não chegava até aqui a divergência era invisível. Assim que
 * ele passou a chegar, a capa saiu com um "6" no lugar da data.
 *
 * A conversão mora AQUI, no dono do campo, e não em cada chamador: é o único
 * ponto por onde os dois caminhos (plano em lote e editor do nó) passam.
 *
 * Nome desconhecido volta como veio, em maiúsculas: se alguém escrever
 * "JUN/2026" à mão, imprimir isso é melhor do que descartar em silêncio.
 */
function normalizarMes(valor: string | undefined): string {
  const bruto = valor?.trim();
  if (!bruto) return "";
  const n = Number(bruto);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return MESES[n - 1];
  return bruto.toUpperCase();
}

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
  /*
   * A correção à mão entra em PRIMEIRO, em cada campo de identidade. É a mesma
   * regra que vale para o nº da folha e para o total de referência: entre o que
   * o parser inferiu e quem olhou a prancha, ganha quem olhou. Vazio = ausente,
   * e aí tudo segue como sempre foi.
   */
  const dito = (valor: string | undefined) => valor?.trim() || "";

  const codigoInterno = dito(input.codigo) || codigoUnderscore || codigoFormatado;
  const codigoExibido = codigoInterno
    ? formatDisplayCode(codigoInterno)
    : codigoFormatado;

  const revisao = dito(input.revisao) || mode(parsedList.map((p) => p.revisao));
  const nomeObra = dito(input.obra) || mode(validos.map((s) => s.obra));

  // FASE (linha proeminente) = FASE DO PROJETO (ex.: "PROJETO EXECUTIVO"), padrão
  // do template. NÃO é a etapa "IMPLANTAÇÃO" (essa faz parte do título).
  const fase = dito(input.fase) || template.defaults.fase;

  // TITULO_CAPA = título da LD com TIPO e ETAPA em linhas separadas: o " - " vira
  // quebra ("PROJETO ESTRUTURAL CONCRETO - IMPLANTAÇÃO" -> 2 linhas). O tomo NÃO
  // entra aqui (vem do campo próprio); removemos qualquer "(TOMO ...)" digitado.
  const tituloRaw = (input.tituloCapa?.trim() || "")
    .replace(/\s*\(\s*tomo[^)]*\)\s*/i, "")
    .trim();
  const tituloCapaFinal =
    (tituloRaw ? tituloRaw.replace(/\s[-–]\s/, "\n") : "") ||
    disciplinaLabel(discCode) ||
    "PROJETO";

  /*
   * SECRETARIA: correção à mão -> CARIMBO -> padrão do template.
   *
   * A ordem estava invertida: o carimbo vinha primeiro, então o override do
   * engenheiro só valia quando o selo não trazia secretaria NENHUMA — ou seja,
   * era ignorado exatamente no caso em que existe para servir, o de o carimbo
   * trazer a secretaria ERRADA. Correção que perde para o parser é pior que
   * correção nenhuma.
   */
  const secretaria =
    dito(input.secretaria) ||
    mode(validos.map((s) => s.secretaria)) ||
    template.defaults.secretaria;

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

  // Tomo ESPECÍFICO (replicar 1 tomo existente, ex.: "TOMO 04") tem prioridade
  // sobre dividir-em-N. Senão, divide em N tomos (uma capa por tomo).
  const tomoNumero = Math.max(0, Math.floor(input.tomoNumero ?? 0));
  const numTomos = tomoNumero > 0 ? 1 : Math.max(1, Math.floor(input.numTomos ?? 1));
  // Onde a contagem COMEÇA. A numeração é do volume, não do documento: se o
  // "Concreto" já ocupou 01-03, o "Concreto Implantação" começa no 04.
  const tomoInicial = Math.max(1, Math.floor(input.tomoInicial ?? 1) || 1);
  // Contagem deslocada precisa da lista explícita — o modo "quantity" sempre
  // começa no 01.
  const tomosExplicitos = tomoInicial > 1 ? tomoLabels(numTomos, tomoInicial) : [];

  // Mês/ano: override do engenheiro (às vezes a capa é de outro mês) -> data atual.
  const now = new Date();
  const mes = normalizarMes(input.mes) || MESES[now.getMonth()];
  const ano = input.ano?.trim() || String(now.getFullYear());

  const generalData: GeneralData = {
    templateId: template.id,
    // O órgão é o único que vem do TEMPLATE, não do carimbo: é a prefeitura
    // escolhida. A correção continua valendo, para o caso do template com o
    // nome desatualizado.
    orgao: dito(input.orgao) || template.defaults.orgao,
    secretaria,
    nomeObra,
    bairro: dito(input.bairro),
    fase,
    mes,
    ano,
    codigoInterno,
    /*
     * A capa imprime o código com TRAÇO ("084-25"), não com underscore.
     *
     * O underscore é a convenção do NOME DE ARQUIVO (`084_25_est_tomo1.pdf`), e
     * `codigoInterno` a carrega por isso. Imprimi-lo assim na capa era vazar
     * nome de arquivo para dentro do documento — e `formatDisplayCode`, que
     * existe exatamente para essa tradução, estava sendo calculado e descartado
     * na linha seguinte.
     */
    codigoExibido,
    siglaArquivo: discCode,
    revisao,
  };

  const group: CoverGroup = {
    id: "nexo-capa",
    // TITULO_CAPA (slot proeminente) = o TIPO do projeto (do título da LD).
    tituloCapa: tituloCapaFinal,
    disciplina: discLabel,
    volume: volumeValue,
    ...(tomosExplicitos.length > 0
      ? { tomoMode: "list" as const, tomoQuantity: 1, tomoList: tomosExplicitos }
      : { tomoMode: "quantity" as const, tomoQuantity: numTomos, tomoList: [] }),
  };

  // Capa usa o tomo SEM parênteses ("TOMO 04"); a LD é que leva "(TOMO 04)".
  const pages = generatePages([group], undefined, template.volumeFormat, "plain-padded");

  // Tomo específico: força "TOMO 0N" na capa única (formatTomo esconde com 1 tomo).
  if (tomoNumero > 0 && pages[0]) {
    pages[0].tomo = `TOMO ${String(tomoNumero).padStart(2, "0")}`;
  }

  // Mesma armadilha do `formatTomo` quando a contagem é deslocada: com UM tomo
  // ele esconde o rótulo, mas "TOMO 04" sozinho tem de aparecer — é o que
  // distingue este documento dos tomos 01-03 do mesmo volume.
  if (tomosExplicitos.length === 1 && pages[0]) {
    pages[0].tomo = `TOMO ${tomosExplicitos[0]}`;
  }

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
