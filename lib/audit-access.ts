/**
 * O ESCOPO DE UMA AUDITORIA.
 *
 * Auditoria ligada a projeto pertence ao escritório dono do projeto. O ramo
 * legado existe somente para auditorias antigas sem projeto e exige o `userId`
 * de quem as criou. Centralizar esta expressão evita que uma rota valide apenas
 * a sessão e depois consulte um `auditId` global.
 */
import type { Prisma } from "@prisma/client";

import type { Actor } from "./actor.ts";

type AuditActor = Pick<Actor, "organizationId" | "userId">;

export function auditWhereForActor(actor: AuditActor): Prisma.AuditWhereInput {
  const scope: Prisma.AuditWhereInput[] = [
    { project: { organizationId: actor.organizationId } },
  ];

  if (actor.userId) {
    scope.push({ projectId: null, userId: actor.userId });
  }

  return { OR: scope };
}

export function auditByIdWhereForActor(
  id: string,
  actor: AuditActor,
): Prisma.AuditWhereInput {
  return { id, ...auditWhereForActor(actor) };
}
