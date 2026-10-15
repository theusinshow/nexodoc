/**
 * A FILEIRA DO CANVAS NA ORDEM DO VOLUME (15/10/2026).
 *
 * O PDF sempre saiu por bloco — capa, e depois separatriz → LD → pranchas de
 * cada disciplina (`assemble-volume.ts`). O canvas, não: ordenava a fileira por
 * TIPO, então um volume EST + HID aparecia como capa, as duas separatrizes, as
 * duas LDs e as pranchas todas numa grade só. Quem olhava via o volume montado
 * errado, e não tinha como dizer ao canvas que uma prancha é de outro bloco.
 *
 * Aqui a fileira é desenhada como o volume é montado: os documentos de cada
 * bloco seguidos das pranchas DELE. Um bloco só (ou nenhuma folha com
 * disciplina) é o caso degenerado — um segmento sem código, como sempre foi.
 *
 * PURO: só `import type`. `node scripts/test-nexo-fileira-por-blocos.ts`.
 */
import type { Folha } from "./folhas.ts";

/**
 * O código do bloco de uma LD ou separatriz, pelo id do artefato. `null` quando
 * o documento é do volume inteiro (volume de uma disciplina só) ou não é LD nem
 * separatriz.
 *
 * Formatos (ConfirmationCard): `ld:<obra>:<rev>[:<cod>][:tNN]` e
 * `separatriz:<obra>[:<cod>][:tNN]`. O bloco sem disciplina grava `sem`.
 */
export function codigoDoBlocoDoArtefato(id: string): string | null {
  const partes = id.replace(/:t\d{2}$/, "").split(":");
  const posicao = partes[0] === "ld" ? 3 : partes[0] === "separatriz" ? 2 : -1;
  if (posicao < 0 || partes.length !== posicao + 1) return null;
  const codigo = partes[posicao].trim().toLowerCase();
  return codigo === "sem" ? "" : codigo;
}

export interface SegmentoDoBloco<T> {
  /**
   * Código do bloco (`est`, `hid`), `""` para o de folhas sem disciplina, e
   * `null` quando a fileira tem um bloco só — aí não há disciplina a gravar
   * quando uma folha é solta nele.
   */
  codigo: string | null;
  /** Separatriz e LD deste bloco, na ordem em que entram. */
  documentos: T[];
  folhas: Folha[];
}

export interface FileiraPorBlocos<T> {
  /** Capa e documentos do volume inteiro, antes do primeiro bloco. */
  antes: T[];
  blocos: SegmentoDoBloco<T>[];
  /** Volume, conferência, auditoria — o que vem depois de tudo. */
  depois: T[];
}

/**
 * Reparte os itens já ordenados (capa → separatriz → LD → … → volume) e as
 * folhas da fileira em blocos.
 *
 * `codigoDe` deve ser o do VOLUME (com o par juntado já reduzido ao primeiro):
 * é o mesmo agrupamento que `blocosDoVolume` faz na montagem — por ordem de
 * aparição, com as folhas sem disciplina por último.
 */
export function fileiraPorBlocos<T extends { id: string; rank: number }>(
  itens: readonly T[],
  folhas: readonly Folha[],
  codigoDe: (f: Folha) => string,
  rankDasPranchas: number,
): FileiraPorBlocos<T> {
  const porCodigo = new Map<string, Folha[]>();
  for (const f of folhas) {
    const c = codigoDe(f).trim().toLowerCase();
    const lista = porCodigo.get(c);
    if (lista) lista.push(f);
    else porCodigo.set(c, [f]);
  }
  /*
   * Os blocos: os das folhas, por ordem de aparição, e os de documentos cujo
   * bloco ficou SEM folha nesta fileira (todas arrastadas para outro). Esses
   * continuam existindo — escondê-los faria o canvas mentir — e o segmento vazio
   * vira destino de arrasto, para a folha poder voltar. Sem disciplina, por último.
   */
  const codigos = [...porCodigo.keys()].filter((c) => c !== "");
  for (const it of itens) {
    const c = it.rank > rankDasPranchas ? null : codigoDoBlocoDoArtefato(it.id);
    if (c && !codigos.includes(c)) codigos.push(c);
    if (c === "" && !porCodigo.has("")) porCodigo.set("", []);
  }
  if (porCodigo.has("")) codigos.push("");

  // Com um bloco só, a separatriz e a LD do volume inteiro SÃO as dele.
  const umSo = codigos.length <= 1;
  const documentosDoBloco = new Map<string, T[]>();
  const antes: T[] = [];
  const depois: T[] = [];
  for (const it of itens) {
    if (it.rank > rankDasPranchas) {
      depois.push(it);
      continue;
    }
    const codigo = codigoDoBlocoDoArtefato(it.id);
    // A capa (rank 0) abre o volume; documento sem bloco num volume misto é
    // sobra de antes da divisão, e fica com ela.
    const chave = it.rank === 0 ? null : umSo ? (codigos[0] ?? "") : codigo;
    if (chave === null) {
      antes.push(it);
      continue;
    }
    const lista = documentosDoBloco.get(chave) ?? [];
    lista.push(it);
    documentosDoBloco.set(chave, lista);
  }

  const blocos: SegmentoDoBloco<T>[] = codigos.map((c) => ({
    codigo: umSo ? null : c,
    documentos: documentosDoBloco.get(c) ?? [],
    folhas: porCodigo.get(c) ?? [],
  }));
  if (blocos.length === 0) blocos.push({ codigo: null, documentos: documentosDoBloco.get("") ?? [], folhas: [] });
  return { antes, blocos, depois };
}
