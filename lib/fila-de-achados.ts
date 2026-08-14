/**
 * QUEM está com qual achado.
 *
 * NÃO HÁ TABELA DE TAREFA. A atribuição faz `upsert` na linha de
 * `AuditFeedback` que já é única por `(auditId, targetKey)` — a mesma linha em
 * que a tela grava veredito e "corrigido". Uma chave própria faria o mesmo
 * achado ter duas linhas, e as duas discordariam na primeira vez que alguém
 * marcasse corrigido por um dos caminhos.
 *
 * O FINGERPRINT É CALCULADO AQUI, do relatório gravado, e nunca aceito do
 * cliente. Ele é a identidade do achado entre versões; um valor errado só
 * apareceria muitos meses depois, quando a reauditoria não reencontrasse a
 * pendência — tarde demais para descobrir de onde veio.
 */
import type { AuditReport } from "@/lib/audit-report";
import { getPrisma } from "@/lib/db";
import { chaveEntreVersoes } from "@/lib/diff-de-pareceres";

export class FilaRecusada extends Error {
  readonly status: 400 | 404;

  constructor(status: 400 | 404, message: string) {
    super(message);
    this.name = "FilaRecusada";
    this.status = status;
  }
}

export async function atribuirAchados(args: {
  auditId: string;
  findingIds: string[];
  assigneeEmail: string;
  atribuidoPor: { id: string | null; email: string };
  organizationId: string;
}): Promise<{ atribuidos: number }> {
  const prisma = getPrisma();

  /*
   * A auditoria é buscada COM o escopo do escritório. Sem isso, alguém com um
   * id de outra organização criaria pendências dentro dela — e elas apareceriam
   * na home de gente que nunca deveria vê-las.
   */
  const audit = await prisma.audit.findFirst({
    where: { id: args.auditId, project: { organizationId: args.organizationId } },
    select: { id: true, report: true, projectId: true },
  });

  if (!audit) {
    throw new FilaRecusada(404, "Auditoria não encontrada.");
  }

  /*
   * SEM PROJETO NÃO HÁ FILA. A home agrupa por projeto, e auditoria legada do
   * Nexo não tem um. Deixar atribuir criaria pendência que não aparece em lugar
   * nenhum — pior do que recusar, porque quem enviou acharia que enviou.
   */
  if (!audit.projectId) {
    throw new FilaRecusada(400, "Esta auditoria não pertence a um projeto.");
  }

  const membro = await prisma.organizationMember.findFirst({
    where: { organizationId: args.organizationId, email: args.assigneeEmail },
    select: { email: true },
  });

  if (!membro) {
    throw new FilaRecusada(400, "Essa pessoa não faz parte do escritório.");
  }

  const report = audit.report as AuditReport | null;
  const achados = report?.incongruencias ?? [];
  const agora = new Date();
  let atribuidos = 0;

  for (const findingId of args.findingIds) {
    const achado = achados.find((item) => item.id === findingId);

    /*
     * Achado que não está no relatório é ignorado em silêncio, e não recusa o
     * lote inteiro: a contagem devolvida diz quantos entraram, e recusar cinco
     * envios por causa de um id velho seria punir quem fez tudo certo.
     */
    if (!achado) continue;

    const targetKey = `finding:${findingId}`;
    const dados = {
      fingerprint: chaveEntreVersoes(achado),
      assigneeEmail: membro.email,
      assignedById: args.atribuidoPor.id,
      assignedAt: agora,
    };

    await prisma.auditFeedback.upsert({
      where: { auditId_targetKey: { auditId: audit.id, targetKey } },
      create: {
        auditId: audit.id,
        targetKey,
        findingId,
        findingLabel: achado.tipo.slice(0, 160),
        page: achado.pagina ? achado.pagina.slice(0, 80) : null,
        ...dados,
      },
      /*
       * Reatribuir NÃO limpa o que já foi decidido: o veredito e a nota de quem
       * olhou antes continuam valendo. O achado só muda de mãos.
       */
      update: dados,
    });

    atribuidos += 1;
  }

  return { atribuidos };
}
