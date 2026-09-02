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
import { acharPorNomeOuChave, avaliarBase } from "@/lib/elegibilidade-da-base";
import { candidatasParaBase } from "@/lib/base-anterior";
import { versaoDoAuditorDaCorrida } from "@/lib/configuracao-do-auditor";
import { auditWhereForActor } from "@/lib/audit-access";
import type { Actor } from "@/lib/actor";

export const runtime = "nodejs";

/**
 * A ÚLTIMA AUDITORIA DESTE MEMORIAL NO PROJETO — inclusive de outra conversa.
 *
 * Duas etapas, e a divisão é o que segura o custo. `Audit.report` é um JSON
 * grande (achados, síntese); carregar vinte deles para ler um nome de arquivo
 * seria caro. `AuditText` já guarda `fileName` por auditoria, então a primeira
 * consulta pede SÓ isso — nunca `pages` nem `capitulos`, que são o volume do
 * registro — e só as candidatas que sobrevivem à chave têm o parecer lido.
 *
 * O PORTÃO É APLICADO AQUI. Devolver uma base que `avaliarBase` depois recusa
 * faria o cartão prometer economia que a auditoria não entrega — o mesmo defeito
 * que `ae5d47f` acabou de fechar do outro lado. Candidata reprovada é
 * descartada e a busca segue para a próxima.
 */
async function procurarBaseNoProjeto(args: {
  projectId: string;
  actor: Actor;
  arquivo: string;
  versaoAtual: string;
}) {
  const prisma = getPrisma();

  const textos = await prisma.auditText.findMany({
    where: {
      audit: {
        projectId: args.projectId,
        status: "COMPLETED",
        ...auditWhereForActor(args.actor),
      },
    },
    // SÓ o que a chave precisa. `pages` e `capitulos` ficam de fora de propósito.
    select: { auditId: true, fileName: true, audit: { select: { createdAt: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Uma auditoria pode ter vários arquivos: agrupa antes de casar a chave.
  const porAuditoria = new Map<string, { auditId: string; arquivos: string[]; quando: string }>();
  for (const t of textos) {
    const atual = porAuditoria.get(t.auditId);
    if (atual) atual.arquivos.push(t.fileName);
    else
      porAuditoria.set(t.auditId, {
        auditId: t.auditId,
        arquivos: [t.fileName],
        quando: t.audit.createdAt.toISOString(),
      });
  }

  const candidatas = candidatasParaBase([...porAuditoria.values()], args.arquivo);
  if (candidatas.length === 0) return null;

  const parecerDe = await prisma.audit.findMany({
    where: { id: { in: candidatas.map((c) => c.auditId) } },
    select: {
      id: true,
      report: true,
      completedAt: true,
      createdAt: true,
      status: true,
      user: { select: { name: true, email: true } },
    },
  });
  const porId = new Map(parecerDe.map((a) => [a.id, a]));

  for (const candidata of candidatas) {
    const linha = porId.get(candidata.auditId);
    if (!linha) continue;

    const elegivel = avaliarBase({
      base: { auditId: linha.id, status: linha.status, report: linha.report as AuditReport | null },
      arquivo: args.arquivo,
      versaoAtual: args.versaoAtual,
    });
    if (elegivel.serve) return linha;
  }

  return null;
}

/** O nome de quem rodou a base, quando ele veio na consulta. */
function autorDaBase(linha: { user?: { name: string | null; email: string } | null }): string {
  return linha.user?.name?.trim() || linha.user?.email || "";
}

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
  /*
   * O PROJETO abre a busca por conta própria. Sem `auditIdAnterior`, é por ele
   * que se procura a base — e ele também é o escopo: base de OUTRO centro de
   * custo herdaria achado para a fila de um projeto alheio.
   */
  const projectId = String(form.get("projectId") ?? "").trim();
  if (!(arquivo instanceof File) || (!auditIdAnterior && !projectId)) {
    return NextResponse.json(
      { error: "Envie o memorial e o id da auditoria anterior ou o projeto." },
      { status: 400 },
    );
  }

  // Mesma distinção da rota de reconexão: "este ambiente não guarda auditoria"
  // não é "não achei a auditoria".
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ comparavel: false, motivo: "sem-banco" });
  }

  const versaoAtual = versaoDoAuditorDaCorrida();

  /*
   * A BASE: a que veio pelo id, ou a que a busca achar no PROJETO.
   *
   * A busca é o que faz o reuso sobreviver à troca de conversa — corrigir os
   * erros e voltar numa conversa nova era reler 100% do memorial em silêncio.
   * Ela só devolve base que o PORTÃO aceita: oferecer uma que `avaliarBase`
   * depois recusa é recriar, pela porta ao lado, o defeito de `ae5d47f` — o
   * cartão prometendo economia que a auditoria não entrega.
   */
  const anterior = auditIdAnterior
    ? await getPrisma().audit.findFirst({
        where: auditByIdWhereForActor(auditIdAnterior, actor),
        // O MESMO `select` dos dois lados: a resposta é uma só, e um campo que
        // existisse num caminho e não no outro faria a tela mostrar o autor da
        // base só às vezes, sem regra que alguém consiga explicar.
        select: {
          id: true,
          report: true,
          completedAt: true,
          createdAt: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
      })
    : await procurarBaseNoProjeto({
        projectId,
        actor,
        arquivo: arquivo.name,
        versaoAtual,
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
      /*
       * DE ONDE VEIO A BASE. Verdadeiro só quando ela saiu da BUSCA, e não do id
       * que o cliente mandou — ou seja, quando ela é de outra conversa.
       *
       * A tela precisa disso porque as duas situações pedem frases diferentes:
       * dentro da conversa, "comparado à auditoria de hoje de manhã" é óbvio;
       * vindo de outro lugar, o engenheiro tem de saber QUAL parecer vai
       * emprestar achado ao dele, e de quem ele é, antes de mandar rodar.
       */
      deOutraConversa: !auditIdAnterior,
      /*
       * Quem rodou a base. Auditoria ligada a projeto pertence ao ESCRITÓRIO
       * (ver `auditWhereForActor`), então a base legítima pode ser de um colega
       * — e nesse caso o nome é metade da informação que decide se ela serve.
       */
      autor: autorDaBase(anterior),
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
