/**
 * O LINK QUE VAI ATÉ O ACHADO.
 *
 * O e-mail levava a `/nexo?auditoria=<id>` e entregava o parecer inteiro — com
 * quarenta achados, o link cumpria metade da promessa: dizia onde, não o quê.
 *
 * Montar e ler moram no MESMO arquivo de propósito: são as duas pontas do mesmo
 * contrato, e separá-las é como o formato de um lado passa a divergir do outro
 * sem que nenhum teste perceba.
 *
 * PURO e sem imports → roda em node cru (`npm run test:link-achado`).
 */

/**
 * O formato dos dois ids. `auditId` é uuid ou cuid; `findingId` é `INC-014`.
 *
 * Fechar o formato importa na LEITURA: o `findingId` vira seletor em
 * `[data-achado="..."]` (ver `audit-result.tsx`), e o `auditId` vira caminho de
 * requisição. Um valor livre em qualquer um dos dois é chance de quebrar a
 * consulta ou a rota — e o formato real é conhecido e estreito.
 */
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function linkDoAchado(args: {
  base: string;
  auditId: string;
  findingId?: string | null;
}): string {
  const base = args.base.replace(/\/+$/, "");
  const achado = (args.findingId ?? "").trim();
  const query = `auditoria=${encodeURIComponent(args.auditId)}`;

  return achado
    ? `${base}/nexo?${query}&achado=${encodeURIComponent(achado)}`
    : `${base}/nexo?${query}`;
}

export function lerLinkDoAchado(args: {
  auditoria: string | null;
  achado: string | null;
}): { auditId: string | null; findingId: string | null } {
  const auditoria = (args.auditoria ?? "").trim();
  const achado = (args.achado ?? "").trim();

  const auditId = ID.test(auditoria) ? auditoria : null;

  /*
   * SEM AUDITORIA NÃO HÁ ACHADO. Focar um achado exige saber de qual parecer ele
   * é; aceitá-lo sozinho faria a tela procurar um id numa auditoria que nunca
   * abriu — e não achar nada, sem dizer por quê.
   */
  if (!auditId) return { auditId: null, findingId: null };

  return { auditId, findingId: ID.test(achado) ? achado : null };
}
