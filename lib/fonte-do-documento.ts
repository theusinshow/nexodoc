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

/**
 * QUANDO PERGUNTAR AO SERVIDOR pelos arquivos da auditoria — o auditId, ou null.
 *
 * O parecer gravado pelo fluxo da auditoria traz só `report`, `texto` e
 * `auditId`: os `arquivos` com checksum vêm apenas da consulta de retomada. A
 * premissa era que quem rodou a auditoria tem o PDF no IndexedDB. Não tem em
 * outra máquina, noutro navegador ou com o cache limpo — e no 027_24
 * (17/09/2026) a aba "No documento" sumiu com o arquivo guardado no banco, e a
 * tela ainda culpava o sistema por não tê-lo guardado.
 *
 * Só consulta quando falta tudo: sem local e sem checksum no parecer.
 */
export function auditoriaParaBuscarArquivos(args: {
  urlLocal: string | null;
  arquivos: readonly { checksumSha256: string | null }[] | undefined;
  auditId: string | null | undefined;
}): string | null {
  if ((args.urlLocal ?? "").trim()) return null;
  if (args.arquivos?.some((a) => (a.checksumSha256 ?? "").trim())) return null;
  return (args.auditId ?? "").trim() || null;
}
