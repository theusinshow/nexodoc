/**
 * DE ONDE VEM O PDF do memorial — e o que dizer quando não vem de lugar nenhum.
 *
 * O `podeVerNoDocumento` do palco era `Boolean(report && memorialPdf)`, e
 * `memorialPdf` vinha só do IndexedDB DESTA máquina. Quem chegava pelo link do
 * e-mail não tinha memorial nenhum, e o botão simplesmente não existia — para a
 * pessoa para quem a funcionalidade foi pedida.
 *
 * A ORDEM É DELIBERADA. O local vem primeiro por ser instantâneo e não gastar
 * rede: quem rodou a auditoria não perde nada, e quem chegou de fora ganha o que
 * não tinha.
 *
 * PURO e sem imports → roda em node cru (`npm run test:fonte-documento`).
 */

/** 64 hexadecimais. O valor vira caminho de URL — ver `fonteDoDocumento`. */
const CHECKSUM = /^[a-f0-9]{64}$/i;

export type FonteDoDocumento =
  | { tipo: "local"; url: string }
  | { tipo: "servidor"; url: string }
  | { tipo: "ausente"; motivo: string };

export function fonteDoDocumento(args: {
  urlLocal: string | null;
  checksum: string | null;
}): FonteDoDocumento {
  const local = (args.urlLocal ?? "").trim();
  if (local) return { tipo: "local", url: local };

  const checksum = (args.checksum ?? "").trim();

  /*
   * O FORMATO É FECHADO, e não escapado.
   *
   * O valor entra num caminho de URL. Um `../` sairia do endpoint, e confiar
   * apenas em `encodeURIComponent` seria confiar que ninguém troque a montagem
   * depois. Recusar o que não é checksum não custa nada e não depende de quem
   * monta a string.
   */
  if (!CHECKSUM.test(checksum)) {
    return {
      tipo: "ausente",
      motivo: "Este documento foi auditado antes de o sistema passar a guardá-lo.",
    };
  }

  return { tipo: "servidor", url: `/api/arquivos/${checksum}` };
}
