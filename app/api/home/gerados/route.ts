/**
 * O QUE VOCÊ GEROU — capa, volume, LD, parecer.
 *
 * A pergunta que este widget responde é a mais banal do produto e a que mais
 * custa hoje: "onde foi parar o volume que eu montei ontem?". Achá-lo exige
 * lembrar em qual obra foi, abrir o projeto e rolar a lista de artefatos. São
 * três passos para um arquivo que a pessoa gerou há dezoito horas.
 *
 * SEUS, e não do escritório — ao contrário de `/api/home/atividade`.
 *
 * A distinção é de propósito e vale escrever: a atividade responde "o que
 * aconteceu aqui" e por isso é do escritório inteiro; esta responde "onde está
 * o MEU arquivo", e o arquivo de outra pessoa não é resposta para isso. Uma
 * lista misturada teria o mesmo tamanho e responderia pior.
 *
 * O portão de organização continua: `userEmail` sozinho deixaria alguém que
 * mudou de escritório ver o que gerou no anterior.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const LIMITE = 6;

/**
 * O mesmo vocabulário de [[lib/painel.ts]], e é uma cópia CONSCIENTE de três
 * linhas em vez de um import: aquele mapa é interno ao cálculo do painel, e
 * exportá-lo faria duas rotas dependerem do módulo de consulta da Home só para
 * traduzir um enum. Se crescer para uma quarta cópia, vira módulo próprio.
 */
const ROTULO: Record<string, string> = {
  COVER_ODT: "Capa",
  COVER_PDF: "Capa",
  COVER_ZIP: "Capas",
  LD_ODT: "LD",
  LD_PDF: "LD",
  LD_ZIP: "LDs",
  LD_REPORT: "Relatório da LD",
  AUDIT_MARKDOWN: "Parecer",
  AUDIT_PDF: "Parecer",
  VOLUME_PDF: "Volume",
  VOLUME_ZIP: "Volume",
  VOLUME_REPORT: "Relatório do volume",
  OTHER: "Arquivo",
};

export async function GET() {
  try {
    const actor = await requireActor();

    if (!isDatabaseConfigured()) return NextResponse.json({ gerados: [] });

    const linhas = await getPrisma().documentArtifact.findMany({
      where: {
        userEmail: actor.email,
        // AVAILABLE só: um artefato expurgado ainda tem linha no banco, e
        // oferecer o link dele é oferecer um 404 com cara de arquivo.
        status: "AVAILABLE",
        project: { organizationId: actor.organizationId },
      },
      select: {
        id: true,
        kind: true,
        createdAt: true,
        project: { select: { id: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMITE,
    });

    return NextResponse.json({
      gerados: linhas
        // Artefato sem projeto não tem para onde levar, e um item que não
        // navega num widget cuja única função é navegar é ruído.
        .filter((linha) => linha.project)
        .map((linha) => ({
          id: linha.id,
          rotulo: ROTULO[linha.kind] ?? "Arquivo",
          projectId: linha.project!.id,
          codigo: linha.project!.code,
          quando: linha.createdAt.toISOString(),
        })),
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
