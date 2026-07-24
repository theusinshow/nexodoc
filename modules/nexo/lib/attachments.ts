/**
 * Classificação de anexos do chat: distinguir o MEMORIAL das PRANCHAS de forma
 * determinística (filename-first, sem IA), para o composer rotear cada PDF ao
 * fluxo certo — pranchas viram selos; o memorial alimenta a auditoria.
 */
import { parseFilename } from "@/server/nexo/parse-filename";

import { partitionAttachments, type Partitioned } from "./attachments-core";

export type { Partitioned } from "./attachments-core";

/** true quando o nome bate a convenção de memorial (ex.: `040_26_md_geral_a.pdf`). */
export function isMemorialFile(fileName: string): boolean {
  return parseFilename(fileName).tipo === "memorial";
}

/** Parte uma lista de arquivos em { memorials, pranchas } (memorial = tipo do nome). */
export function partitionByRole<T extends { name: string }>(
  files: T[],
): Partitioned<T> {
  return partitionAttachments(files, isMemorialFile);
}
