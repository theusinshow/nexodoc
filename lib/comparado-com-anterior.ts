/**
 * O QUE MUDOU DESDE A ÚLTIMA AUDITORIA DESTE MEMORIAL — inclusive de outra
 * conversa — calculado no servidor, ao fim da auditoria.
 *
 * A comparação morava só na tela (`PalcoDoNexo`) e só via a auditoria anterior
 * DA MESMA CONVERSA. Quem corrige o memorial e volta num dia seguinte abre
 * conversa nova, e aí não havia com o que comparar. E a tela não tem o texto da
 * versão anterior, que é o que separa "o achado novo está num trecho que você
 * alterou" de "já estava lá e a leitura anterior não viu" — a pergunta de quem
 * corrigiu tudo e viu o número não cair (laço do 040_26_est_md_a, 16/10/2026:
 * 27 → 16 → 18 → 10 → 10).
 *
 * A busca é a MESMA do reuso (`candidatasParaBase`: mesmo projeto, mesma
 * `chaveDoDocumento`, a mais recente primeiro), sem o portão `avaliarBase`:
 * aquele decide se a base serve para HERDAR achado; para comparar, qualquer
 * auditoria concluída do mesmo documento serve.
 *
 * Nunca derruba a auditoria: falhou, devolve `null` e a tela cai na comparação
 * local de sempre.
 */
import { auditWhereForActor } from "./audit-access.ts";
import type { AuditReport } from "./audit-report.ts";
import { candidatasParaBase } from "./base-anterior.ts";
import { getPrisma } from "./db.ts";
import { compararPareceres } from "./diff-de-pareceres.ts";
import { chaveDoDocumento } from "./elegibilidade-da-base.ts";
import { semSugestoesSemCorrecao } from "./sugestao-sem-correcao.ts";

export type ComparadoComAnteriorNoServidor = NonNullable<
  NonNullable<AuditReport["runtime"]>["comparado_com_anterior"]
>;

export async function compararComAnterior(args: {
  projectId: string;
  arquivo: string;
  atual: AuditReport;
  /** O texto do documento auditado agora — separa o corrigido do não reapontado. */
  textoAtual?: string;
  actor: Parameters<typeof auditWhereForActor>[0];
  excetoAuditId?: string | null;
}): Promise<ComparadoComAnteriorNoServidor | null> {
  try {
    const prisma = getPrisma();
    const textos = await prisma.auditText.findMany({
      where: {
        ...(args.excetoAuditId ? { auditId: { not: args.excetoAuditId } } : {}),
        audit: { projectId: args.projectId, status: "COMPLETED", ...auditWhereForActor(args.actor) },
      },
      // Só o que a chave precisa; `pages` só da escolhida, mais abaixo.
      select: { auditId: true, fileName: true, audit: { select: { createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const porAuditoria = new Map<string, { auditId: string; arquivos: string[]; quando: string }>();
    for (const t of textos) {
      const atual = porAuditoria.get(t.auditId);
      if (atual) atual.arquivos.push(t.fileName);
      else porAuditoria.set(t.auditId, { auditId: t.auditId, arquivos: [t.fileName], quando: t.audit.createdAt.toISOString() });
    }

    const [escolhida] = candidatasParaBase([...porAuditoria.values()], args.arquivo);
    if (!escolhida) return null;

    const chave = chaveDoDocumento(args.arquivo);
    const [linha, texto] = await Promise.all([
      prisma.audit.findUnique({ where: { id: escolhida.auditId }, select: { report: true, completedAt: true, createdAt: true } }),
      prisma.auditText.findFirst({
        where: { auditId: escolhida.auditId, fileName: { in: escolhida.arquivos.filter((a) => chaveDoDocumento(a) === chave) } },
        select: { pages: true },
      }),
    ]);
    const relatorio = linha?.report as AuditReport | null | undefined;
    if (!relatorio?.incongruencias) return null;

    /*
     * O parecer anterior passa pela MESMA peneira do atual: gravado antes de
     * `sugestao-sem-correcao.ts`, ele ainda traz "Nenhuma correção necessária",
     * e essas linhas sumiriam agora contadas como "corrigidas".
     */
    const anterior: AuditReport = {
      ...relatorio,
      incongruencias: semSugestoesSemCorrecao(relatorio.incongruencias).mantidos,
    };
    const paginas = (texto?.pages ?? []) as { text?: string }[];
    const textoAnterior = paginas.length > 0 ? paginas.map((p) => p.text ?? "").join("\n") : undefined;

    const d = compararPareceres({ anterior, atual: args.atual, textoAnterior, textoAtual: args.textoAtual });
    return {
      audit_id: escolhida.auditId,
      desde: (linha?.completedAt ?? linha?.createdAt ?? new Date(escolhida.quando)).toISOString(),
      corrigidos: d.corrigidos.map((f) => ({ tipo: f.tipo, pagina: f.pagina, termo_busca: f.termo_busca ?? "" })),
      continuam: d.persistentes.map((f) => f.id),
      novos: d.novos.map((f) => f.id),
      ...(d.saidosComTrechoIgual
        ? { saidos_com_trecho_igual: d.saidosComTrechoIgual.map((f) => ({ tipo: f.tipo, pagina: f.pagina, termo_busca: f.termo_busca ?? "" })) }
        : {}),
      ...(d.novosEmTextoQueJaExistia
        ? {
            novos_em_texto_que_ja_existia: d.novosEmTextoQueJaExistia.map((f) => f.id),
            novos_em_texto_alterado: (d.novosEmTextoAlterado ?? []).map((f) => f.id),
          }
        : {}),
    };
  } catch (err) {
    console.warn(`[audit] comparação com a auditoria anterior falhou: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
