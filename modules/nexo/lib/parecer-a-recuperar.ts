/**
 * QUAL PARECER PEDIR DE VOLTA AO SERVIDOR.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru do
 * `test:parecer-a-recuperar`.
 *
 * A auditoria é registrada na conversa quando COMEÇA, não quando termina. Essa
 * é a peça toda: o `auditId` só vivia dentro do `payload` do artefato — o mesmo
 * artefato que se perde. Registrar na largada põe o id fora do caminho da falha.
 *
 * Se, depois de restaurar a conversa, o artefato de uma auditoria registrada não
 * está na lista, o trabalho pago existe no Postgres (`persistCompletedAudit`
 * grava pelo backend, sem passar por gravação nenhuma do cliente) e pode ser
 * buscado de volta.
 */

export type AuditoriaRegistrada = { auditId: string; artifactId: string };

export type RegistroParaRecuperar = {
  results: { artifactId: string; kind: string }[];
  auditorias?: AuditoriaRegistrada[];
  /** Artefatos que o usuário apagou DE PROPÓSITO. */
  artefatosApagados?: string[];
};

export function parecerARecuperar(
  rec: RegistroParaRecuperar,
): AuditoriaRegistrada | null {
  const apagados = new Set(rec.artefatosApagados ?? []);
  const presentes = new Set(
    rec.results.filter((r) => r.kind === "auditoria").map((r) => r.artifactId),
  );
  for (const a of rec.auditorias ?? []) {
    if (presentes.has(a.artifactId)) continue;
    /*
     * APAGAR CONTINUA SENDO APAGAR. Sem esta linha, o parecer que a pessoa
     * excluiu voltaria em toda abertura — e um produto que desfaz a exclusão do
     * usuário é pior que um que perde o arquivo, porque o primeiro faz isso
     * para sempre. É a diferença entre recuperar e teimar.
     */
    if (apagados.has(a.artifactId)) continue;
    return a;
  }
  return null;
}
