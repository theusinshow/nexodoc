/**
 * A PASTA NASCE DO DOCUMENTO.
 *
 * `POST /api/projects` exige `ADMIN` da organização, e continua exigindo: lá
 * alguém INVENTA um código, digitando numa tela. Aqui o código foi EXTRAÍDO do
 * PDF pela classificação, e por isso qualquer membro pode criar. A diferença
 * entre inventar e extrair é o que justifica as duas regras conviverem — não é
 * exceção esquecida.
 *
 * O RISCO ACEITO, escrito para não virar surpresa: documento ruim pode render um
 * código torto (`O63-26` com letra O) e um projeto paralelo, e os achados vão
 * para a pasta errada. Ele fica visível na lista com quem o criou, e é apagável.
 * O mantenedor preferiu isso ao atrito de confirmar cada pasta nova.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { normalizarCentroDeCusto } from "@/lib/resolucao-de-projeto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }

    const corpo = (await request.json().catch(() => null)) as {
      code?: unknown;
      client?: unknown;
      name?: unknown;
    } | null;

    const code = normalizarCentroDeCusto(typeof corpo?.code === "string" ? corpo.code : "");
    const client = typeof corpo?.client === "string" ? corpo.client.trim().slice(0, 200) : "";
    const nome = typeof corpo?.name === "string" ? corpo.name.trim().slice(0, 200) : "";

    if (!code) {
      return NextResponse.json(
        { error: "Sem centro de custo no documento." },
        { status: 400 },
      );
    }

    /*
     * `upsert`, e não `create`: duas pessoas podem arrastar o mesmo memorial ao
     * mesmo tempo, e o unique `(organizationId, code)` transformaria a segunda
     * num erro de banco que a tela não saberia explicar.
     */
    const project = await getPrisma().project.upsert({
      where: { organizationId_code: { organizationId: actor.organizationId, code } },
      create: {
        organizationId: actor.organizationId,
        code,
        client,
        // Sem nome legível, o código serve: uma pasta chamada "099-25" é pior
        // que "Reforma da UBS", e muito melhor que uma sem nome nenhum.
        name: nome || code,
        ownerEmail: actor.email,
        ownerName: actor.name,
        createdById: actor.userId,
      },
      /*
       * Projeto que já existe NÃO é reescrito pelo que a IA leu agora. O
       * cadastro de quem o criou — possivelmente à mão, com o nome certo da
       * obra — vale mais do que a leitura de um PDF qualquer que menciona o
       * mesmo centro de custo.
       */
      update: {},
      select: { id: true, code: true, client: true },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
