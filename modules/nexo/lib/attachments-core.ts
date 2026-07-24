/**
 * Núcleo PURO da partição de anexos por papel (memorial vs prancha). SEM imports
 * (testável com `node` cru). O classificador (`isMemorial`) é INJETADO — a regra
 * de "o que é memorial" (filename-first via parseFilename) mora no wrapper, que
 * tem imports; aqui só ordenamos, que é o contrato que precisa ficar travado.
 */

export interface Partitioned<T> {
  memorials: T[];
  pranchas: T[];
}

/** Separa os arquivos em memoriais e pranchas segundo o classificador dado. */
export function partitionAttachments<T extends { name: string }>(
  files: T[],
  isMemorial: (name: string) => boolean,
): Partitioned<T> {
  const memorials: T[] = [];
  const pranchas: T[] = [];
  for (const f of files) {
    (isMemorial(f.name) ? memorials : pranchas).push(f);
  }
  return { memorials, pranchas };
}
