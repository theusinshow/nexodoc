/**
 * TRANSCREVER UMA PÁGINA MUDA — a folha que tem conteúdo e não entrega texto.
 *
 * O cliente rasteriza (ver `modules/nexo/lib/pagina-muda-render.ts`) porque não
 * há canvas no Node aqui; esta rota faz a parte que é do servidor: portão,
 * teto de fatura, chamada e telemetria. Uma página por chamada, de propósito —
 * o cliente controla a concorrência e pode parar no meio sem perder o que já
 * pagou, que é o que o cache guarda folha a folha.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import { getAiConfiguration } from "@/lib/ai-providers";
import { transcreverPagina, VERSAO_DO_TRANSCRITOR } from "@/lib/transcricao-por-visao";

/**
 * ~8 MB de data URL. Uma A4 a 150 dpi em PNG dá ~1,5 MB; o teto existe para o
 * caso de alguém subir a resolução do render sem medir, não para apertar o uso
 * normal.
 */
const TETO_DA_IMAGEM = 8 * 1024 * 1024;

function imagemValida(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= TETO_DA_IMAGEM &&
    /^data:image\/(png|jpeg|webp);base64,/.test(value)
  );
}

export async function POST(request: Request) {
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  await refreshAiModelOverrideCache();

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  /*
   * O TETO. Esta rota é cobrada por FOLHA, e um volume escaneado inteiro passa
   * por aqui de uma vez — é exatamente a forma de gasto que o teto mensal
   * existe para conter.
   */
  const teto = await verificarTetoMensal({
    userId: session.user.id ?? null,
    userEmail: session.user.email ?? null,
  });
  if (teto.estourou) {
    return NextResponse.json({ error: mensagemDeTetoEstourado(teto) }, { status: 402 });
  }

  const body = (await request.json()) as {
    imagemDataUrl?: unknown;
    pagina?: unknown;
    conversationId?: unknown;
  };

  if (!imagemValida(body.imagemDataUrl)) {
    return NextResponse.json(
      { error: "Imagem da página ausente, inválida ou grande demais." },
      { status: 400 },
    );
  }

  const pagina = Number(body.pagina);
  if (!Number.isInteger(pagina) || pagina < 1) {
    return NextResponse.json({ error: "Número de página inválido." }, { status: 400 });
  }

  const conversationId =
    typeof body.conversationId === "string" && body.conversationId.trim()
      ? body.conversationId.trim()
      : undefined;

  const { model } = getAiConfiguration().auditTranscricao;

  try {
    const transcricao = await transcreverPagina({
      imagemDataUrl: body.imagemDataUrl,
      pagina,
      model,
      userEmail: session.user.email ?? undefined,
      conversationId,
    });

    /*
     * O CONSUMO E A FALHA NÃO SÃO GRAVADOS AQUI. `executeOpenAiResponse` já faz
     * os dois — `recordAiUsage` no sucesso, `classifyProviderFailure` +
     * `recordProviderFailure` no erro. Repetir aqui contaria o token duas vezes
     * na fatura de um fluxo cobrado por FOLHA, onde o erro se multiplica por 25.
     */
    return NextResponse.json({
      pagina,
      texto: transcricao.texto,
      versaoDoTranscritor: VERSAO_DO_TRANSCRITOR,
    });
  } catch (err) {
    /*
     * A FALHA NÃO É FATAL PARA A AUDITORIA, e o cliente precisa poder seguir.
     * Uma folha que não transcreveu continua muda, e é assim que ela chega ao
     * parecer: contada em `paginas_mudas` e não em `paginas_transcritas`, o que
     * derruba a cobertura para parcial. Um erro aqui degrada a leitura; ele não
     * pode apagar o registro de que a folha ficou por ler.
     */
    const motivo = err instanceof Error ? err.message : "Falha ao transcrever a página.";
    console.warn(`[audit-transcricao] pagina ${pagina}: ${motivo}`);
    return NextResponse.json({ error: motivo, pagina }, { status: 502 });
  }
}
