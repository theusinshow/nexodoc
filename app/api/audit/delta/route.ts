/**
 * O QUE MUDOU no memorial desde a última auditoria — sem gastar um token.
 *
 * Recebe o PDF novo e o id da auditoria anterior; extrai o texto, fatia por
 * capítulo, e compara com a impressão digital gravada naquele parecer. Devolve
 * o que ficou igual, o que mudou, o que entrou e o que saiu.
 *
 * ZERO chamadas de modelo, de propósito: isto é a tela que aparece ANTES de
 * decidir gastar. Uma auditoria profunda do 063-26 são 173 mil caracteres numa
 * chamada só, 258s medidos — a pergunta "vale reauditar tudo?" precisa de
 * resposta barata.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { extractPdfText, chunkPdfByChapter } from "@/lib/pdf-text";
import {
  compararImpressoes,
  fracaoJaLida,
  impressaoDosCapitulos,
  resumoDoDelta,
} from "@/lib/audit-fingerprint";
import type { AuditReport, ImpressaoDoArquivo } from "@/lib/audit-report";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

export async function POST(request: Request) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  const sessao = await auth();
  const userEmail = sessao?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  }

  const form = await request.formData();
  const arquivo = form.get("file");
  const auditIdAnterior = String(form.get("auditIdAnterior") ?? "").trim();
  if (!(arquivo instanceof File) || !auditIdAnterior) {
    return NextResponse.json(
      { error: "Envie o memorial e o id da auditoria anterior." },
      { status: 400 },
    );
  }

  // Mesma distinção da rota de reconexão: "este ambiente não guarda auditoria"
  // não é "não achei a auditoria".
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ comparavel: false, motivo: "sem-banco" });
  }

  const anterior = await getPrisma().audit.findFirst({
    where: { id: auditIdAnterior },
    select: { id: true, report: true, completedAt: true, createdAt: true, status: true },
  });
  if (!anterior || anterior.status !== "COMPLETED") {
    return NextResponse.json({ comparavel: false, motivo: "sem-auditoria-anterior" });
  }

  const relatorio = anterior.report as AuditReport | null;
  const impressaoAnterior: ImpressaoDoArquivo[] = relatorio?.runtime?.impressao ?? [];
  if (impressaoAnterior.length === 0) {
    /*
     * Parecer gravado antes de 12/08/2026 não tem impressão. Dizer "nada mudou"
     * aqui seria o pior erro possível — a auditoria seguinte pularia o
     * documento inteiro. Falta de dado é falta de dado.
     */
    return NextResponse.json({ comparavel: false, motivo: "sem-impressao" });
  }

  const extraido = await extractPdfText(Buffer.from(await arquivo.arrayBuffer()));
  const capitulosAgora = impressaoDosCapitulos(chunkPdfByChapter(extraido));

  /*
   * Compara com o arquivo de MESMO NOME quando ele existe; senão, com o
   * primeiro. Auditoria de memorial tem um arquivo só — a busca por nome existe
   * para o dia em que tiver mais.
   */
  const base =
    impressaoAnterior.find((i) => i.arquivo === arquivo.name) ?? impressaoAnterior[0];
  const delta = compararImpressoes(base.capitulos, capitulosAgora);

  return NextResponse.json({
    comparavel: true,
    base: {
      auditId: anterior.id,
      arquivo: base.arquivo,
      quando: (anterior.completedAt ?? anterior.createdAt).toISOString(),
    },
    resumo: resumoDoDelta(delta),
    fracaoJaLida: fracaoJaLida(delta),
    paginas: extraido.pageCount,
    caracteres: extraido.charCount,
    delta: {
      iguais: delta.iguais.length,
      alterados: delta.alterados.length,
      novos: delta.novos.length,
      sumidos: delta.sumidos.length,
      /* Os títulos do que mudou: é o que a tela mostra para a pessoa reconhecer
         o volume que ela mesma acrescentou. */
      titulosAlterados: delta.alterados.map((c) => c.agora.titulo).filter(Boolean),
      titulosNovos: delta.novos.map((c) => c.titulo).filter(Boolean),
      titulosSumidos: delta.sumidos.map((c) => c.titulo).filter(Boolean),
    },
  });
}
