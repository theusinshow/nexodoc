import { extractPdfText } from "@/lib/pdf-text";
import { classifyDocument } from "@/lib/audit-classify";
import type {
  NexoDossieDraft,
  NexoFileClassification,
} from "@/modules/nexo/types";
import { parseFilename, TIPO_LABEL } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";

export interface ClassifyDocumentsInput {
  fileName: string;
  buffer: Buffer;
  /** Caminho relativo (pastas) quando vier de upload de diretorio — enriquece volume/blocos. */
  relPath?: string;
}

const CONFIANCA_RANK: Record<NexoFileClassification["confianca"], number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

/**
 * Intake do Nexo (Fase 0), FILENAME-FIRST. A convencao de nomes do escritorio
 * carrega os fatos objetivos (codigo, revisao, tipo, disciplinas, folha) — o
 * parser deles e autoritativo. O conteudo do PDF so entra para a IDENTIDADE
 * (obra/orgao/municipio) e contagem de paginas. Orcamento e fora de escopo: nem
 * lemos o conteudo. Determinístico, sem IA.
 */
export async function classifyDocuments(
  files: ClassifyDocumentsInput[],
): Promise<NexoDossieDraft> {
  const arquivos: NexoFileClassification[] = [];

  for (const file of files) {
    const parsed = parseFilename(file.fileName, file.relPath);

    // Orcamento: fora de escopo — registra e nao le o conteudo.
    if (parsed.foraDeEscopo) {
      arquivos.push({
        fileName: file.fileName,
        tipo: parsed.tipo,
        tipoLabel: TIPO_LABEL[parsed.tipo],
        foraDeEscopo: true,
        assinado: parsed.assinado,
        obra: "",
        municipio: "",
        orgao: "",
        codigo: parsed.codigo,
        revisao: parsed.revisao,
        disciplinas: parsed.disciplinas,
        folha: parsed.folha,
        volume: parsed.volume,
        pageCount: 0,
        charCount: 0,
        confianca: "baixa",
        precisaOcr: false,
        sinais: [],
      });
      continue;
    }

    const extracted = await extractPdfText(file.buffer);
    const doc = classifyDocument(file.fileName, extracted, "memorial");

    arquivos.push({
      fileName: file.fileName,
      tipo: parsed.tipo,
      tipoLabel: TIPO_LABEL[parsed.tipo],
      foraDeEscopo: false,
      assinado: parsed.assinado,
      obra: doc.obra,
      municipio: doc.municipio,
      orgao: doc.orgao,
      // filename e autoritativo; conteudo so como fallback.
      codigo: parsed.codigo || doc.codigo,
      revisao: parsed.revisao,
      disciplinas: parsed.disciplinas,
      folha: parsed.folha,
      volume: parsed.volume,
      pageCount: doc.pageCount,
      charCount: doc.charCount,
      confianca: doc.confianca,
      precisaOcr: doc.precisaOcr,
      sinais: doc.sinais,
    });
  }

  return aggregate(arquivos);
}

/** Escolhe o valor do arquivo de maior confianca que tem o campo preenchido. */
function pickByConfidence(
  arquivos: NexoFileClassification[],
  key: "obra" | "municipio" | "codigo" | "orgao" | "revisao",
): string | undefined {
  const withValue = arquivos.filter((a) => !a.foraDeEscopo && a[key]?.trim());
  if (withValue.length === 0) return undefined;
  return [...withValue].sort(
    (a, b) => CONFIANCA_RANK[b.confianca] - CONFIANCA_RANK[a.confianca],
  )[0][key];
}

function aggregate(arquivos: NexoFileClassification[]): NexoDossieDraft {
  // Disciplinas do dossie: rotulos distintos, so de arquivos em escopo.
  const codes = new Set<string>();
  for (const a of arquivos) {
    if (a.foraDeEscopo) continue;
    for (const c of a.disciplinas) codes.add(c);
  }
  const disciplinas = Array.from(codes, (c) => disciplinaLabel(c) ?? c.toUpperCase());

  return {
    obra: pickByConfidence(arquivos, "obra"),
    orgao: pickByConfidence(arquivos, "orgao"),
    municipio: pickByConfidence(arquivos, "municipio"),
    codigo: pickByConfidence(arquivos, "codigo"),
    revisao: pickByConfidence(arquivos, "revisao"),
    disciplinas,
    arquivos,
  };
}
