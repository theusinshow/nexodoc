/**
 * A ATIVIDADE DO ESCRITÓRIO — o que as OUTRAS pessoas fizeram.
 *
 * É a única fonte de "o que aconteceu enquanto eu não estava" que o produto já
 * grava: `ProjectEvent` existe desde o começo, tem índice por data e é
 * alimentado por auditoria, volume, capa, LD e upload. O widget que a consome
 * não inventa nada — ele lê uma tabela que já estava sendo escrita e ninguém
 * lia.
 *
 * QUEM APARECE: todo mundo do escritório, VOCÊ INCLUSIVE.
 *
 * A tentação era filtrar `actorEmail != você` — o widget se chama "atividade do
 * escritório", e o que você fez você já sabe. Só que o registro serve de
 * ÂNCORA: uma lista em que a última linha é sua diz "é este o fio de onde você
 * saiu"; uma lista em que você nunca aparece parece o mural de outra equipe. O
 * nome de quem agiu está em cada linha, então quem quiser separar, separa.
 *
 * SEM PAGINAÇÃO e sem parâmetro: o widget mostra as últimas linhas e ponto. Um
 * cursor aqui seria a arquitetura de uma tela que este widget não é — quem
 * quer o histórico de um projeto abre o projeto.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

/**
 * CINCO, e não mais oito.
 *
 * O widget deixou de ser `largo` (duas colunas) e voltou a uma coluna: oito
 * linhas ali dentro faziam dele a peça mais alta de "Seu espaço", numa seção
 * cujo nome diz que ela é SUA. Da sexta linha para baixo também deixa de ser "o
 * que aconteceu" e vira histórico — e histórico tem tela, que é a do projeto.
 */
const LIMITE = 5;

/**
 * O VERBO de cada tipo, na terceira pessoa e no passado.
 *
 * O `type` do banco é `AUDIT_COMPLETED`; a linha precisa dizer "auditou". A
 * tradução mora aqui e não no cliente porque é vocabulário de produto — a
 * mesma razão pela qual `ROTULO_ARTEFATO` mora em [[lib/painel.ts]].
 *
 * Tipo desconhecido NÃO some da lista: cai em "mexeu em". Sumir com a linha
 * esconderia atividade real por causa de um enum que cresceu, e o widget
 * passaria a mentir sobre o que aconteceu.
 */
const VERBO: Record<string, string> = {
  PROJECT_CREATED: "criou o projeto",
  PROJECT_UPDATED: "atualizou",
  STATUS_CHANGED: "mudou o status de",
  PROJECT_ARCHIVED: "arquivou",
  PROJECT_DELETED: "removeu",
  DOCUMENT_ADDED: "anexou documento em",
  DOCUMENT_ARCHIVED: "arquivou documento de",
  INPUT_UPLOADED: "enviou arquivo para",
  AUDIT_CREATED: "começou auditoria em",
  AUDIT_COMPLETED: "auditou",
  LD_DRAFT_CREATED: "abriu LD em",
  LD_GENERATED: "gerou a LD de",
  COVER_GENERATED: "gerou capa de",
  VOLUME_GENERATED: "montou volume de",
  ARTIFACT_CREATED: "gerou arquivo em",
  NOTE_ADDED: "anotou em",
};

export async function GET() {
  try {
    const actor = await requireActor();

    // Sem banco, lista VAZIA e não erro — mesma decisão de `/api/painel`: um
    // widget não pode derrubar a tela que o hospeda.
    if (!isDatabaseConfigured()) return NextResponse.json({ eventos: [] });

    const prisma = getPrisma();

    const linhas = await prisma.projectEvent.findMany({
      // O portão é a ORGANIZAÇÃO do projeto, e não o e-mail de quem agiu: o
      // widget mostra o escritório, e quem não é do escritório não entra.
      where: { project: { organizationId: actor.organizationId } },
      select: {
        id: true,
        type: true,
        actorEmail: true,
        actorName: true,
        createdAt: true,
        project: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMITE,
    });

    return NextResponse.json({
      eventos: linhas.map((linha) => ({
        id: linha.id,
        // O nome quando existe; o e-mail quando a pessoa foi convidada e ainda
        // não entrou. Mesma regra do resto do módulo de achados.
        quem: linha.actorName?.trim() || linha.actorEmail,
        souEu: linha.actorEmail.toLowerCase() === actor.email.toLowerCase(),
        verbo: VERBO[linha.type] ?? "mexeu em",
        projectId: linha.project?.id ?? null,
        // O CÓDIGO, e não o nome da obra: a linha da atividade é curta e o
        // código é o que a pessoa reconhece de relance. Sem projeto (evento de
        // projeto apagado), o traço — a linha continua contando o que houve.
        onde: linha.project?.code || "—",
        quando: linha.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
