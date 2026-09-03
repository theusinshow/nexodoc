/**
 * OS CONTROLES DA PLATAFORMA, pelo painel.
 *
 * Oito números e um interruptor que só existiam em variável de ambiente. Mudar
 * qualquer um exigia deploy — e "exigia deploy" era, na prática, a única guarda
 * contra um valor absurdo. Tirar o deploy do caminho obrigou a pôr a guarda no
 * código: a faixa de cada controle mora em [[lib/controles-da-plataforma.ts]] e
 * é conferida AQUI, não só na tela.
 */
import { NextResponse } from "next/server";

import { checkAdminRequest } from "@/lib/admin-gate";
import { escreverFreio, type FreioDoCadastro } from "@/lib/controles-da-plataforma";
import {
  esquecerControle,
  lerControlesParaOPainel,
  salvarControle,
  salvarFreio,
} from "@/lib/configuracao-da-plataforma";
import { registrarAcao, type AcaoDoPainel } from "@/lib/trilha-administrativa";

export const runtime = "nodejs";

/** Que ação da trilha um controle representa — para a linha dizer o que mudou. */
function acaoDaChave(chave: string): AcaoDoPainel {
  if (chave.startsWith("teto.")) return "teto";
  if (chave.startsWith("vazao.")) return "vazao";
  return "limites";
}

export async function GET(request: Request) {
  const portao = await checkAdminRequest(request);

  if (!portao.ok) {
    return NextResponse.json({ error: portao.message }, { status: portao.status });
  }

  return NextResponse.json(await lerControlesParaOPainel());
}

export async function PATCH(request: Request) {
  const portao = await checkAdminRequest(request);

  if (!portao.ok) {
    return NextResponse.json({ error: portao.message }, { status: portao.status });
  }

  const corpo = (await request.json().catch(() => null)) as {
    acao?: unknown;
    chave?: unknown;
    valor?: unknown;
    estado?: unknown;
    organizationId?: unknown;
  } | null;

  try {
    if (corpo?.acao === "freio") {
      const estado = corpo.estado as FreioDoCadastro;

      if (estado !== "prosul" && estado !== "convite" && estado !== "outra") {
        return NextResponse.json({ error: "Estado do freio inválido." }, { status: 400 });
      }

      const valor = escreverFreio(
        estado,
        typeof corpo.organizationId === "string" ? corpo.organizationId : null,
      );

      if (estado === "outra" && valor === null) {
        return NextResponse.json(
          { error: "Informe o id do escritório." },
          { status: 400 },
        );
      }

      await salvarFreio(valor, portao.email);
      await registrarAcao({
        quem: portao.email,
        acao: "escritorio-padrao",
        alcance: estado,
        resumo: { estado, organizationId: valor },
      });

      return NextResponse.json(await lerControlesParaOPainel());
    }

    const chave = typeof corpo?.chave === "string" ? corpo.chave : "";

    if (!chave) {
      return NextResponse.json({ error: "Controle não informado." }, { status: 400 });
    }

    if (corpo?.acao === "esquecer") {
      /*
       * "Voltar ao ambiente" APAGA a linha, e não grava o valor atual. Gravá-lo
       * congelaria no banco o que hoje vem da variável, e mudar a variável
       * depois não teria efeito nenhum — sem ninguém entender por quê.
       */
      await esquecerControle(chave);
      await registrarAcao({
        quem: portao.email,
        acao: acaoDaChave(chave),
        alcance: chave,
        resumo: { voltouAoAmbiente: true },
      });

      return NextResponse.json(await lerControlesParaOPainel());
    }

    const valor = await salvarControle(chave, corpo?.valor, portao.email);
    await registrarAcao({
      quem: portao.email,
      acao: acaoDaChave(chave),
      alcance: chave,
      resumo: { valor },
    });

    return NextResponse.json(await lerControlesParaOPainel());
  } catch (erro) {
    return NextResponse.json(
      { error: erro instanceof Error ? erro.message : "Não foi possível salvar." },
      { status: 400 },
    );
  }
}
