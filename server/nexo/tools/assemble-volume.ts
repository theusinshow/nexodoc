import { PDFDocument } from "pdf-lib";

import { paginasDaParte } from "@/server/nexo/volume-plano";
import { buildRowPdf } from "@/modules/volume-builder/lib/volume/assembly-builder";
import type {
  AssemblyRow,
  AssemblyBlock,
} from "@/modules/volume-builder/lib/volume/volume-types";

/**
 * Ferramenta headless do Nexo: "montar o volume". Recebe as partes ja geradas /
 * coletadas (capa + separatrizes + pranchas + LD) como PDFs em Buffer, com um
 * rotulo de papel cada, e as funde EM ORDEM num unico PDF de volume — reusando o
 * motor de montagem existente do modulo Volume (`buildRowPdf`, pdf-lib). Nao ha
 * reimplementacao de merge aqui; adaptamos as partes ao modelo do motor.
 *
 * Assim como as demais ferramentas do Nexo: entrada tipada -> saida tipada,
 * retorna Buffer cru (base64 e responsabilidade da camada HTTP) e nunca chama
 * auth() — o chamador entrega tudo pronto. Falhas (parte invalida, motor
 * indisponivel) voltam como { pdf: null, error } sem lancar excecao.
 */

export type VolumePartRole = "capa" | "separatriz" | "prancha" | "ld";

export interface VolumePart {
  role: VolumePartRole;
  name: string;
  buffer: Buffer;
  /**
   * Intervalo de páginas (1-based) a incluir. Usado quando o PDF é COMBINADO
   * (capa/separatriz/LD + pranchas no mesmo arquivo): passa só as páginas de
   * prancha, evitando duplicar a capa/LD que já estão dentro. Ausente = arquivo
   * inteiro.
   */
  startPage?: number;
  endPage?: number;
}

export interface AssembleVolumeInput {
  parts: VolumePart[];
  fileName?: string;
  /**
   * Quando true, ignora a ordem recebida e reordena pelas regras canonicas
   * (capa -> separatrizes -> pranchas -> ld). Por padrao a ordem explicita da
   * lista `parts` e respeitada.
   */
  reorder?: boolean;
}

export interface GeneratedFile {
  name: string;
  buffer: Buffer;
}

/**
 * Quantas páginas cada parte contribuiu para o PDF final, na ordem em que
 * entraram. É o que permite dizer, depois, QUAL página do volume deveria ser
 * qual folha — a conferência do volume montado se apoia inteira nisto.
 *
 * Calculado aqui porque a montagem já carrega toda parte com pdf-lib para
 * validar: contar é de graça neste ponto, e refazer a conta no cliente
 * significaria pdf-lib no bundle do browser para reproduzir um número que o
 * servidor já tinha em mãos.
 */
export interface PartePaginada {
  role: VolumePartRole;
  name: string;
  paginas: number;
}

export interface AssembleVolumeOutput {
  pdf: GeneratedFile | null;
  error?: string;
  pageCount?: number;
  partes?: PartePaginada[];
}

/** Peso de cada papel na ordem canonica do volume: capa -> separatriz -> LD ->
 *  pranchas (a LD e o indice, vem ANTES das pranchas). */
const CANONICAL_ROLE_ORDER: Record<VolumePartRole, number> = {
  capa: 0,
  separatriz: 1,
  ld: 2,
  prancha: 3,
};

/**
 * Decide a ordem canonica (capa -> separatrizes -> pranchas -> ld) para uma
 * lista de partes potencialmente desordenada. Estavel: dentro do mesmo papel a
 * ordem original e preservada. Exportada para o chamador poder ordenar antes de
 * montar quando nao tiver uma ordem explicita propria.
 */
export function orderVolumeParts(parts: VolumePart[]): VolumePart[] {
  return parts
    .map((part, index) => ({ part, index }))
    .sort((a, b) => {
      const roleDelta =
        CANONICAL_ROLE_ORDER[a.part.role] - CANONICAL_ROLE_ORDER[b.part.role];
      return roleDelta !== 0 ? roleDelta : a.index - b.index;
    })
    .map((entry) => entry.part);
}

/**
 * Constroi uma AssemblyRow em que cada parte vira um bloco de slot unico,
 * ocupando o `separator` do bloco com uma selecao de arquivo inteiro. Como todo
 * bloco ja possui `separator.selection`, `buildRowPdf` nao injeta separatrizes
 * geradas: o resultado e a concatenacao exata das partes, na ordem dos blocos.
 */
function buildRowFromParts(parts: VolumePart[]): {
  row: AssemblyRow;
  fileBuffers: Map<string, ArrayBuffer>;
} {
  const fileBuffers = new Map<string, ArrayBuffer>();

  const blocks: AssemblyBlock[] = parts.map((part, index) => {
    const sourceFileId = `nexo-part-${index}`;
    // Buffer -> ArrayBuffer via copia isolada (Node Buffers compartilham um pool
    // e seu .buffer pode ser SharedArrayBuffer; copiamos para um ArrayBuffer puro).
    const copy = new Uint8Array(part.buffer.byteLength);
    copy.set(part.buffer);
    fileBuffers.set(sourceFileId, copy.buffer);

    const usaIntervalo =
      typeof part.startPage === "number" &&
      typeof part.endPage === "number" &&
      part.startPage >= 1 &&
      part.endPage >= part.startPage;
    const selection = usaIntervalo
      ? ({
          sourceFileId,
          sourceFileName: part.name,
          mode: "page_range" as const,
          startPage: part.startPage,
          endPage: part.endPage,
        })
      : ({
          sourceFileId,
          sourceFileName: part.name,
          mode: "entire_file" as const,
        });

    return {
      id: `nexo-block-${index}`,
      title: part.name,
      disciplineCode: "",
      separatorTitle: part.name,
      separator: {
        id: `nexo-slot-${index}`,
        type: "separator",
        label: part.name,
        selection,
        warnings: [],
      },
      documents: [],
      status: "sem_problemas",
      warnings: [],
    };
  });

  const row: AssemblyRow = {
    id: "nexo-volume",
    order: 1,
    title: "Volume",
    blocks,
    outputFileName: "",
    status: "sem_problemas",
    warnings: [],
    requiresManualConfirmation: false,
  };

  return { row, fileBuffers };
}

export async function assembleVolume(
  input: AssembleVolumeInput,
): Promise<AssembleVolumeOutput> {
  const parts = Array.isArray(input.parts) ? input.parts : [];

  if (parts.length === 0) {
    return { pdf: null, error: "Nenhuma parte informada para montar o volume." };
  }

  // Valida cada parte como PDF antes de fundir, para reportar QUAL parte falhou
  // (buildRowPdf lancaria sem identificar a parte). De carona, conta quantas
  // paginas cada uma contribui: o documento ja esta carregado aqui, e essa
  // contagem e o alicerce da conferencia do volume montado.
  const paginasPorParte = new Map<VolumePart, number>();
  for (const part of parts) {
    if (!part || !Buffer.isBuffer(part.buffer) || part.buffer.byteLength === 0) {
      const label = part?.name ? `"${part.name}"` : "sem nome";
      return { pdf: null, error: `Parte ${label} nao contem um PDF valido.` };
    }
    try {
      const doc = await PDFDocument.load(part.buffer);
      paginasPorParte.set(
        part,
        paginasDaParte(doc.getPageCount(), part.startPage, part.endPage),
      );
    } catch {
      return {
        pdf: null,
        error: `Parte "${part.name}" nao e um PDF valido ou esta corrompida.`,
      };
    }
  }

  const orderedParts = input.reorder ? orderVolumeParts(parts) : parts;

  if (typeof buildRowPdf !== "function") {
    return {
      pdf: null,
      error: "Motor de montagem de volume indisponivel (buildRowPdf).",
    };
  }

  try {
    const { row, fileBuffers } = buildRowFromParts(orderedParts);
    const mergedBytes = await buildRowPdf(row, fileBuffers);
    const buffer = Buffer.from(mergedBytes);

    let pageCount: number | undefined;
    try {
      const merged = await PDFDocument.load(buffer);
      pageCount = merged.getPageCount();
    } catch {
      pageCount = undefined;
    }

    const rawName = input.fileName?.trim() || "volume.pdf";
    const name = rawName.toLowerCase().endsWith(".pdf")
      ? rawName
      : `${rawName}.pdf`;

    const partes: PartePaginada[] = orderedParts.map((part) => ({
      role: part.role,
      name: part.name,
      paginas: paginasPorParte.get(part) ?? 0,
    }));

    return { pdf: { name, buffer }, pageCount, partes };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido na montagem.";
    return { pdf: null, error: `Falha ao montar o volume: ${message}` };
  }
}
