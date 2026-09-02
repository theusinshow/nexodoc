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
import { auditByIdWhereForActor } from "@/lib/audit-access";
import { acharPorNomeOuChave } from "@/lib/elegibilidade-da-base";
import type { Actor } from "@/lib/actor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  /*
   * O PORTAO. Esta rota nao pedia NADA -- nem sessao.
   */
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
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
    where: auditByIdWhereForActor(auditIdAnterior, actor),
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
   * A MESMA BUSCA QUE A AUDITORIA VAI FAZER — `acharPorNomeOuChave`.
   *
   * Aqui a regra era própria e mais frouxa: nome exato, senão
   * `impressaoAnterior[0]`. Numa revisão renomeada (`_a` -> `_b`, ou a via
   * assinada) o delta caía no `[0]`, acertava, e o cartão anunciava "86% já foi
   * lido" — enquanto `avaliarBase`, casando só por nome exato, recusava a base
   * por `outro-arquivo` e relia o documento inteiro. A promessa e a entrega
   * discordando sobre a mesma dupla de arquivos, e quem paga só descobre depois.
   *
   * O `[0]` sobrevive como último recurso e SÓ com um arquivo na base: é o caso
   * que ele sempre atendeu — auditoria de memorial tem um arquivo só — e com
   * dois ou mais escolher o primeiro é escolher no escuro.
   */
  const base =
    acharPorNomeOuChave(impressaoAnterior, arquivo.name) ??
    (impressaoAnterior.length === 1 ? impressaoAnterior[0] : undefined);

  if (!base) {
    return NextResponse.json({ comparavel: false, motivo: "outro-arquivo" });
  }

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
