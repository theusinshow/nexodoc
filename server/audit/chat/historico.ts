/**
 * O QUE JÁ SE SABE DESTA OBRA.
 *
 * Sem acervo, o chat só consegue falar do documento que está na frente dele — e
 * "esse mesmo erro foi apontado na revisão anterior e continua aqui" é
 * justamente a frase que o engenheiro precisa ouvir, e que nenhuma leitura de
 * página sozinha produz.
 *
 * A ferramenta entrega FATOS: quais pareceres existem, quando, com que veredito
 * e quantos achados. Concluir que um defeito se repete é trabalho do modelo, e
 * ele tem `ler_achado` e `buscar_no_memorial` para sustentar a conclusão. Uma
 * ferramenta que já afirmasse a repetição estaria julgando sem ler.
 */
import type { FunctionTool } from "openai/resources/responses/responses";

import { listAuditLearnings } from "../../../lib/audit-learnings.ts";
import type { AuditReport } from "../../../lib/audit-report.ts";
import { getPrisma, isDatabaseConfigured } from "../../../lib/db.ts";

export type ParecerAnterior = {
  auditId: string;
  quando: string;
  veredito: string;
  totalAchados: number;
  criticos: number;
  arquivo: string;
};

export type Acervo = {
  anteriores: ParecerAnterior[];
  aprendizados: { title: string; content: string }[];
};

export function redigirHistorico(acervo: Acervo): string {
  const partes: string[] = [];

  if (acervo.anteriores.length === 0) {
    partes.push(
      "Não há parecer anterior desta obra no acervo: esta é a primeira auditoria registrada.",
    );
  } else {
    partes.push(
      `Pareceres anteriores desta obra (${acervo.anteriores.length}), do mais recente ao mais antigo:`,
    );
    for (const p of acervo.anteriores) {
      partes.push(
        `  ${p.quando} · ${p.arquivo} · ${p.veredito} · ${p.totalAchados} achado(s), ${p.criticos} crítico(s) · id ${p.auditId}`,
      );
    }
  }

  if (acervo.aprendizados.length > 0) {
    partes.push("");
    partes.push("Aprendizados ativos do escritório:");
    for (const a of acervo.aprendizados) {
      partes.push(`  ${a.title}: ${a.content}`);
    }
  }

  return partes.join("\n");
}

/** Quantos achados de prioridade Alta o parecer gravado tinha. */
function criticosDe(report: unknown): number {
  const achados = (report as AuditReport | null)?.incongruencias ?? [];
  return achados.filter((f) => f.prioridade === "Alta").length;
}

export async function historicoDaObra(args: {
  auditId: string;
  projectId?: string | null;
}): Promise<string> {
  const aprendizados = await listAuditLearnings({ activeOnly: true })
    .then((lista) => lista.map((a) => ({ title: a.title, content: a.content })))
    .catch(() => []);

  /*
   * SEM OBRA não há acervo a consultar, e isso não é falha: auditoria avulsa
   * existe. Os aprendizados do escritório continuam valendo, e vão junto.
   */
  if (!args.projectId || !isDatabaseConfigured()) {
    return redigirHistorico({ anteriores: [], aprendizados });
  }

  try {
    const prisma = getPrisma();
    const linhas = await prisma.audit.findMany({
      where: {
        projectId: args.projectId,
        status: "COMPLETED",
        id: { not: args.auditId },
      },
      orderBy: { completedAt: "desc" },
      /*
       * Dez basta: o acervo serve de CONTEXTO, não de segunda leitura. Sem
       * teto, uma obra com trinta revisões encheria o turno de tabela e
       * empurraria para fora o que o engenheiro perguntou.
       */
      take: 10,
      select: {
        id: true,
        completedAt: true,
        createdAt: true,
        report: true,
        totalFindings: true,
        files: { select: { fileName: true }, take: 1 },
      },
    });

    const anteriores: ParecerAnterior[] = linhas.map((linha) => ({
      auditId: linha.id,
      quando: (linha.completedAt ?? linha.createdAt).toISOString().slice(0, 10),
      veredito: (linha.report as AuditReport | null)?.status_geral ?? "sem veredito registrado",
      totalAchados: linha.totalFindings,
      criticos: criticosDe(linha.report),
      arquivo: linha.files[0]?.fileName ?? "arquivo não registrado",
    }));

    return redigirHistorico({ anteriores, aprendizados });
  } catch (error) {
    // Falhar aqui não derruba o turno: o chat segue com o parecer e o documento.
    console.error("[audit-chat] falha ao consultar o histórico da obra", error);
    return redigirHistorico({ anteriores: [], aprendizados });
  }
}

export const FERRAMENTA_HISTORICO: FunctionTool = {
  type: "function",
  name: "historico_da_obra",
  description:
    "Os pareceres anteriores desta MESMA obra (data, veredito, nº de achados e de críticos) " +
    "e os aprendizados ativos do escritório. Use para saber se um defeito já foi apontado antes.",
  strict: false,
  parameters: { type: "object", properties: {}, required: [] },
};
