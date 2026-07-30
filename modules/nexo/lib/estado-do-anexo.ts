/**
 * O estado de leitura de CADA anexo, derivado do que já foi lido.
 *
 * O progresso existia só em agregado ("6 de 24 folhas"), acima do composer. Com
 * oito PDFs na fila, isso não responde a pergunta que o engenheiro faz olhando
 * a tela: *este* arquivo aqui já foi lido? deu certo? Ele ficava esperando sem
 * saber se um arquivo específico tinha travado.
 *
 * Nada de novo precisou ser guardado: os selos lidos já trazem o `fileName`, e
 * é isso que amarra resultado e anexo.
 *
 * PURO e sem imports: roda no node cru.
 */

export type EstadoDoAnexo =
  | { tipo: "na-fila" }
  | { tipo: "lendo" }
  | { tipo: "lido"; sigla: string; folha: string }
  | { tipo: "ilegivel" }
  | { tipo: "nenhum" };

export interface SeloLido {
  fileName: string;
  extraction: { disciplina?: string | null; numeroFolha?: string | null } | null;
}

/**
 * `lendo` é o estado GLOBAL da leitura: sem ele, um arquivo ainda não lido
 * ficaria indistinguível de um arquivo que ninguém vai ler (o memorial, por
 * exemplo, que não passa pelo OCR de selo).
 */
export function estadoDoAnexo(
  fileName: string,
  selos: readonly SeloLido[],
  lendo: boolean,
  siglaDe: (disciplina: string | null | undefined) => string,
): EstadoDoAnexo {
  const doArquivo = selos.filter((s) => s.fileName === fileName);

  if (doArquivo.length === 0) return lendo ? { tipo: "na-fila" } : { tipo: "nenhum" };

  const comLeitura = doArquivo.filter((s) => s.extraction);
  if (comLeitura.length === 0) return { tipo: "ilegivel" };

  const primeiro = comLeitura[0].extraction!;
  return {
    tipo: "lido",
    sigla: siglaDe(primeiro.disciplina),
    // O número vem do carimbo como "05/24"; sem ele, o total ainda informa.
    folha: (primeiro.numeroFolha ?? "").trim(),
  };
}
