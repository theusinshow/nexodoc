import { extractPdfText } from "@/lib/pdf-text";
import { classifyDocument } from "@/lib/audit-classify";
import { classifyPageAsset } from "@/modules/volume-builder/lib/volume/page-classification";
import type {
  NexoDossieDraft,
  NexoFileClassification,
} from "@/modules/nexo/types";

export interface ClassifyDocumentsInput {
  fileName: string;
  buffer: Buffer;
  /** Tipo declarado pelo usuario (dica p/ classifyDocument), opcional. */
  declaredType?: string;
}

const CONFIANCA_RANK: Record<NexoFileClassification["confianca"], number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

/**
 * Intake deterministico do Nexo (Fase 0). Para cada PDF: extrai texto,
 * classifica tipo + identidade (`classifyDocument`) e disciplina
 * (`classifyPageAsset`), e agrega num Dossie parcial. SEM IA — sao fatos
 * objetivos que o assistente vai *afirmar* e pedir confirmacao.
 */
export async function classifyDocuments(
  files: ClassifyDocumentsInput[],
): Promise<NexoDossieDraft> {
  const arquivos: NexoFileClassification[] = [];

  for (const file of files) {
    const extracted = await extractPdfText(file.buffer);
    const doc = classifyDocument(
      file.fileName,
      extracted,
      file.declaredType ?? "memorial",
    );
    const page = classifyPageAsset({
      fileName: file.fileName,
      pageNumber: 1,
      summary: extracted.pages[0]?.text?.slice(0, 4000),
    });

    arquivos.push({
      fileName: file.fileName,
      tipo: doc.tipo,
      tipoLabel: doc.tipoLabel,
      obra: doc.obra,
      municipio: doc.municipio,
      codigo: doc.codigo,
      orgao: doc.orgao,
      revisao: doc.revisao,
      disciplinaCode: page.disciplineCode,
      disciplinaName: page.disciplineName,
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
  const withValue = arquivos.filter((a) => a[key]?.trim());
  if (withValue.length === 0) return undefined;
  return [...withValue].sort(
    (a, b) => CONFIANCA_RANK[b.confianca] - CONFIANCA_RANK[a.confianca],
  )[0][key];
}

function aggregate(arquivos: NexoFileClassification[]): NexoDossieDraft {
  const disciplinas = Array.from(
    new Set(
      arquivos
        .map((a) => a.disciplinaName)
        .filter((name): name is string => Boolean(name)),
    ),
  );

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
