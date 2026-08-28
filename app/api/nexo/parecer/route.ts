import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { AuditReport } from "@/lib/audit-report";
import { isNexoEnabled } from "@/lib/feature-flags";
import { gerarParecerPdf, nomeDoParecer } from "@/server/pdf/parecer";

export const runtime = "nodejs";

/**
 * O PARECER EM PAPEL.
 *
 * O engenheiro entrega papel ao escritório e à prefeitura, e o único caminho
 * até aqui era imprimir a tela — fundo escuro, barra lateral, botões que não
 * fazem nada impressos. O papel é a peça que circula fora do produto, então ele
 * é desenhado como peça: mono onde é dado, chanfro na moldura, selo no rodapé
 * de toda folha.
 *
 * O RELATÓRIO VEM NO CORPO, e não do banco por id. Duas razões, e a segunda é
 * a que decide: o cliente já tem o parecer na mão (é ele que está na tela, vindo
 * do IndexedDB), e nem todo parecer que o engenheiro está lendo tem linha no
 * Postgres — conversa restaurada de outra máquina, parecer antigo. Exigir id
 * transformaria "imprimir o que estou vendo" em "imprimir se o servidor também
 * souber", que é o pior tipo de recusa: a tela mostra e o botão nega.
 *
 * NENHUM TOKEN. É desenho determinístico sobre o que já foi pago.
 */
export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json(
      { error: "Modulo Nexo desativado." },
      { status: 404 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  let report: AuditReport;
  try {
    const body = (await req.json()) as { report?: unknown };
    const bruto = body.report as AuditReport | undefined;
    /*
     * A validação mede o que o desenho USA: sem `incongruencias` em lista, a
     * geração quebraria lá dentro e devolveria 500 para um corpo malformado —
     * erro do cliente contado como falha do servidor.
     */
    if (!bruto || !Array.isArray(bruto.incongruencias)) {
      throw new Error("relatorio ausente");
    }
    report = bruto;
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  const bytes = await gerarParecerPdf(report);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      /*
       * `inline` e não `attachment`: quem clica quer CONFERIR antes de mandar
       * para a prefeitura, e o navegador já sabe abrir PDF. O download continua
       * a um clique de distância, no visualizador.
       */
      "Content-Disposition": `inline; filename="${nomeDoParecer(report)}"`,
      "Cache-Control": "no-store",
    },
  });
}
