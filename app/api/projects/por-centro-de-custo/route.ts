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
import { decidirCliente } from "@/lib/cliente-do-projeto";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { createProjectEvent } from "@/lib/project-store";
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
      municipio?: unknown;
    } | null;

    const code = normalizarCentroDeCusto(typeof corpo?.code === "string" ? corpo.code : "");
    const client = typeof corpo?.client === "string" ? corpo.client.trim().slice(0, 200) : "";
    const nome = typeof corpo?.name === "string" ? corpo.name.trim().slice(0, 200) : "";
    /*
     * O MUNICÍPIO forma a CHAVE; o órgão forma o texto que se lê.
     *
     * O órgão pode ser uma secretaria de nome longo — "Secretaria de
     * Desenvolvimento Sustentável e Obras Estruturantes" é um caso real do
     * 040-26. O município é o que identifica o cliente. Ver `decidirCliente`.
     */
    const municipio =
      typeof corpo?.municipio === "string" ? corpo.municipio.trim().slice(0, 200) : "";

    if (!code) {
      return NextResponse.json(
        { error: "Sem centro de custo no documento." },
        { status: 400 },
      );
    }

    const prisma = getPrisma();

    /*
     * PRIMEIRO LÊ, DEPOIS DECIDE.
     *
     * O `update: {}` de antes deixava o cliente em branco para sempre: projeto
     * criado sem prefeitura nunca ganhava uma, por mais memoriais daquele
     * centro de custo que passassem por ele. E ninguém digita prefeitura em
     * lugar nenhum do produto — então o campo simplesmente não existia.
     *
     * A decisão agora é de [[lib/cliente-do-projeto.ts]], e ela distingue as
     * duas coisas que o `update: {}` confundia: sobrescrever um cadastro
     * (proibido) e preencher um branco (que é o único jeito de o dado existir).
     */
    const existente = await prisma.project.findUnique({
      where: { organizationId_code: { organizationId: actor.organizationId, code } },
      select: { id: true, client: true, clientKey: true },
    });

    const decisao = decidirCliente({
      atual: existente?.client ?? "",
      atualKey: existente?.clientKey ?? "",
      lido: client,
      municipioLido: municipio,
    });

    /*
     * `upsert`, e não `create`: duas pessoas podem arrastar o mesmo memorial ao
     * mesmo tempo, e o unique `(organizationId, code)` transformaria a segunda
     * num erro de banco que a tela não saberia explicar.
     */
    const project = await prisma.project.upsert({
      where: { organizationId_code: { organizationId: actor.organizationId, code } },
      create: {
        organizationId: actor.organizationId,
        code,
        client: decisao.client,
        clientKey: decisao.clientKey,
        // Sem nome legível, o código serve: uma pasta chamada "099-25" é pior
        // que "Reforma da UBS", e muito melhor que uma sem nome nenhum.
        name: nome || code,
        ownerEmail: actor.email,
        ownerName: actor.name,
        createdById: actor.userId,
      },
      /*
       * Só o que a decisão autorizou. Quando ela manda manter, isto reescreve
       * os mesmos valores — e a chave em branco de um projeto anterior à
       * migração é recalculada de passagem, sem script nenhum.
       *
       * O nome da obra continua FORA: o cadastro de quem o criou vale mais do
       * que a leitura de um PDF qualquer que menciona o mesmo centro de custo.
       */
      update: { client: decisao.client, clientKey: decisao.clientKey },
      select: { id: true, code: true, client: true, clientKey: true },
    });

    /*
     * A DIVERGÊNCIA É REGISTRADA, NÃO PERGUNTADA.
     *
     * Interromper a auditoria porque o PDF escreveu "Pref. Mun. de Criciúma" e
     * o cadastro diz "Prefeitura Municipal de Criciúma" seria atrito por ruído
     * de grafia — e `decidirCliente` já descarta esse caso pela chave. O que
     * chega aqui são clientes de fato diferentes, e isso é coisa para alguém
     * olhar na tela do projeto, não no meio do trabalho de outra pessoa.
     */
    if (decisao.divergencia) {
      await createProjectEvent(prisma, {
        projectId: project.id,
        actor: { id: actor.userId, email: actor.email, name: actor.name },
        type: "PROJECT_UPDATED",
        title: "Cliente do documento difere do cadastro",
        summary: `O cadastro diz "${decisao.divergencia.cadastrado}"; o documento trouxe "${decisao.divergencia.lido}".`,
        details: decisao.divergencia,
      });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
