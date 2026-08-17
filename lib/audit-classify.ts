import type { ExtractedPdf } from "@/lib/pdf-text";
import {
  lerCaracterizacaoDaObra,
  type CaracterizacaoDaObra,
} from "@/lib/caracterizacao-obra";
import { nomeDaObra } from "@/lib/nome-da-obra";
import { extractIdentityFingerprint } from "./cross-document-audit";

export type DocumentKind =
  | "memorial"
  | "ld"
  | "capa"
  | "prancha"
  | "orcamento"
  | "desconhecido";

export type DocumentClassification = {
  fileName: string;
  tipo: DocumentKind;
  tipoLabel: string;
  obra: string;
  municipio: string;
  codigo: string;
  orgao: string;
  revisao: string;
  /**
   * A caracterização da obra do memorial: endereço, bairro, áreas.
   *
   * O ENDEREÇO é o que distingue duas obras de mesmo nome — e o programa de
   * UBS gera exatamente isso: várias "Unidade Básica de Saúde" por município.
   * Nome de obra não serve de gabarito nesses casos; endereço serve.
   */
  caracterizacao?: CaracterizacaoDaObra;
  confianca: "alta" | "media" | "baixa";
  /** modo/nivel sugeridos para a auditoria (o operador pode sobrescrever) */
  auditMode: "memorial" | "volume";
  analysisLevel: "standard" | "deep";
  pageCount: number;
  charCount: number;
  /** PDF só de imagem, sem texto pesquisável — precisa de OCR para ler */
  precisaOcr: boolean;
  /** por que foi classificado assim (transparência para o operador) */
  sinais: string[];
};

const TIPO_LABEL: Record<DocumentKind, string> = {
  memorial: "Memorial Descritivo",
  ld: "Lista de Documentos",
  capa: "Capa / Volume",
  prancha: "Prancha",
  orcamento: "Orçamento / Planilha",
  desconhecido: "Não identificado",
};

const MIN_TEXT_CHARS = 300; // mesmo limiar do pipeline de auditoria

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function titleCase(value: string) {
  const minor = new Set(["de", "da", "do", "das", "dos", "e"]);
  return value
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && minor.has(stripAccents(word))
        ? word
        : word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1),
    )
    .join(" ");
}

/** identidade limpa para o cartão de confirmação (obra/código/município/órgão/revisão) */
function extractIdentity(source: { fileName: string; fileType: string; extracted: ExtractedPdf }) {
  const text = source.extracted.text;
  const fingerprint = extractIdentityFingerprint(source);

  /*
   * A obra sai de [[nome-da-obra.ts]] — rodapé primeiro, campo "Obra:" depois.
   *
   * As duas expressões viviam aqui e truncavam o gabarito do 084_25: a do campo
   * parava na quebra de linha (que só passou a existir dentro de uma página
   * quando a extração deixou de achatar tudo, no mesmo dia) e a do rodapé não
   * aceitava parêntese. O nome saía sem "Rubens de Arruda Ramos", e a regra de
   * identidade acusava de divergentes justamente as páginas que citavam a obra
   * pelo nome certo.
   */
  const obraRaw = (nomeDaObra(text) || fingerprint.fields.obra?.display || "").trim();
  const obra = obraRaw ? titleCase(obraRaw) : "";

  const codigo = /\b\d{2,4}[_-]\d{2}\b/.exec(text)?.[0]?.replace("_", "-") ?? "";

  const municipioFp = fingerprint.fields.municipio?.display;
  const municipio =
    (municipioFp ? titleCase(municipioFp) : "") ||
    /Munic[ií]pio\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40})/i
      .exec(text)?.[1]
      ?.trim() ||
    "";

  const orgao =
    /Prefeitura\s+Municipal\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40})/i
      .exec(text)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ?? "";

  const revisao = fingerprint.fields.revisao?.display ?? "";

  return { obra, codigo, municipio, orgao, revisao };
}

export function classifyDocument(
  fileName: string,
  extracted: ExtractedPdf,
  fileType = "memorial",
): DocumentClassification {
  const text = extracted.text;
  const pageCount = extracted.pageCount;
  const charCount = extracted.charCount;
  const density = pageCount > 0 ? charCount / pageCount : charCount;
  const precisaOcr = charCount < MIN_TEXT_CHARS;

  const identity = extractIdentity({ fileName, fileType, extracted });
  const sinais: string[] = [];

  const hasMemorial = /memorial\s+descritivo/i.test(text);
  const hasSumario = /\bsum[áa]rio\b/i.test(text);
  const hasLd =
    /lista\s+de\s+documentos|lista\s+de\s+desenhos|rela[çc][aã]o\s+de\s+documentos/i.test(text);
  const hasOrcamento =
    /planilha\s+or[çc]ament[áa]ria|or[çc]amento\s+anal[íi]tico|composi[çc][aã]o\s+de\s+custos/i.test(
      text,
    );
  const hasPrancha =
    /\bprancha\b|escala\s*1\s*[:/]|folha\s*\d+\s*\/\s*\d+|carimbo|\bselo\b/i.test(text);
  const hasCapaVolume = /volume\s+\d+\s*[–-]\s*(?:memorial|projeto)|\bcapa\b/i.test(text);

  let tipo: DocumentKind = "desconhecido";

  if (hasMemorial && (pageCount >= 4 || hasSumario)) {
    tipo = "memorial";
    sinais.push(`contém "Memorial Descritivo"${hasSumario ? " e sumário" : ""}, ${pageCount} páginas`);
  } else if (hasLd) {
    tipo = "ld";
    sinais.push('contém "Lista de Documentos"');
  } else if (hasOrcamento) {
    tipo = "orcamento";
    sinais.push("contém planilha orçamentária / composição de custos");
  } else if (pageCount === 1 && hasCapaVolume && charCount < 1500) {
    tipo = "capa";
    sinais.push('página única com "Volume/Capa"');
  } else if (pageCount <= 2 && (hasPrancha || density < 400)) {
    tipo = "prancha";
    sinais.push(hasPrancha ? "sinais de prancha (escala/folha/carimbo)" : "poucas páginas e baixa densidade de texto");
  } else if (hasMemorial) {
    tipo = "memorial";
    sinais.push('contém "Memorial Descritivo"');
  } else if (precisaOcr) {
    tipo = "desconhecido";
    sinais.push("PDF sem texto pesquisável (provável imagem) — requer OCR");
  } else if (identity.obra || identity.codigo) {
    tipo = "desconhecido";
    sinais.push("identidade extraída, mas tipo de documento não reconhecido");
  }

  // confiança
  let confianca: DocumentClassification["confianca"] = "baixa";
  if (tipo !== "desconhecido" && identity.obra && identity.municipio) {
    confianca = "alta";
  } else if (tipo !== "desconhecido" || (identity.obra && identity.municipio)) {
    confianca = "media";
  }
  if (precisaOcr) {
    confianca = "baixa";
  }

  const auditMode: "memorial" | "volume" = tipo === "memorial" ? "memorial" : "volume";
  const analysisLevel: "standard" | "deep" = tipo === "memorial" ? "deep" : "standard";

  /*
   * Só no memorial: é o único documento que traz a seção "Caracterização da
   * obra". Rodar em prancha ou orçamento seria gastar regex à toa e, pior,
   * arriscar casar um trecho parecido fora de contexto.
   */
  const caracterizacao = tipo === "memorial" ? lerCaracterizacaoDaObra(text) : undefined;
  if (caracterizacao?.endereco) {
    sinais.push(`endereço lido da caracterização da obra: ${caracterizacao.endereco}`);
  }

  return {
    fileName,
    tipo,
    tipoLabel: TIPO_LABEL[tipo],
    obra: identity.obra,
    // O município da caracterização é mais confiável que o do timbre: o timbre
    // diz quem CONTRATOU, a caracterização diz onde a obra FICA — e nem sempre
    // são o mesmo município.
    municipio: caracterizacao?.municipio || identity.municipio,
    codigo: identity.codigo,
    orgao: identity.orgao,
    revisao: identity.revisao,
    ...(caracterizacao?.trecho ? { caracterizacao } : {}),
    confianca,
    auditMode,
    analysisLevel,
    pageCount,
    charCount,
    precisaOcr,
    sinais,
  };
}
