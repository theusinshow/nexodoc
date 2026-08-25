/**
 * AVISAR OS ENVOLVIDOS por e-mail.
 *
 * Rota SEPARADA da atribuição, e não um parâmetro dela. `POST /atribuir` grava
 * quem está com o quê e é chamado muitas vezes enquanto o parecer é
 * distribuído; este é chamado UMA vez, quando a distribuição terminou. Fundir
 * os dois obrigaria cada envio a carregar um `avisar: false` que existiria só
 * para desligar o efeito -- e o dia em que alguém esquecesse o parâmetro,
 * cinco e-mails sairiam sem ninguém ter pedido.
 *
 * GET diz quem está esperando aviso; POST manda.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { AvisoRecusado, avisarEnvolvidos, quemFaltaAvisar } from "@/lib/aviso-de-achados";
import { isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function recusa(err: unknown) {
  const negado = accessDeniedResponse(err);
  if (negado) return negado;

  if (err instanceof AvisoRecusado) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ pendentes: [] });
    }

    return NextResponse.json({
      pendentes: await quemFaltaAvisar(id, actor.organizationId),
    });
  } catch (err) {
    const resposta = recusa(err);
    if (resposta) return resposta;
    throw err;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }

    const resultado = await avisarEnvolvidos({
      auditId: id,
      organizationId: actor.organizationId,
      avisadoPor: { nome: actor.name, email: actor.email },
    });

    /*
     * 200 SEMPRE que a rota chegou até aqui, inclusive quando nenhum e-mail
     * saiu. O `estado` é a resposta, e a tela tem texto diferente para cada um
     * -- ver `avisarEnvolvidos`. Devolver 500 em "correio não configurado"
     * faria a tela dizer "erro ao avisar", que é a leitura errada: não houve
     * erro, houve um ambiente sem correio, e quem clicou precisa saber
     * exatamente isso para ir configurar.
     */
    return NextResponse.json(resultado);
  } catch (err) {
    const resposta = recusa(err);
    if (resposta) return resposta;
    throw err;
  }
}
