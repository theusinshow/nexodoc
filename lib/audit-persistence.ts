/**
 * A GRAVAÇÃO da auditoria, fora da rota.
 *
 * É AQUI que a materialização dos achados vai se pendurar quando a revisão
 * colaborativa começar: o `FindingOccurrence` nasce do relatório no instante em
 * que a auditoria fecha, e esse instante é `persistCompletedAudit`. Está escrito
 * porque `app/api/audit/route.ts` tem 3.849 linhas e é o pior lugar do
 * repositório para plantar domínio novo — a tentação de fazê-lo lá é real, e
 * quem chegar depois merece encontrar o endereço certo antes de escolher errado.
 *
 * Ver `docs/superpowers/specs/2026-08-13-substrato-de-escritorio-design.md`,
 * Parte C.3, e a Fase 0 de `docs/arquitetura-revisao-colaborativa.md`.
 */
import type { Prisma } from "@prisma/client";

import type { AnalysisLevel } from "@/lib/analysis-level";
import type { AuditMode } from "@/lib/audit-mode";
import type { AuditReport } from "@/lib/audit-report";
import {
  INTERVALO_DE_BATIMENTO_MS,
  MOTIVO_SEM_SINAL,
} from "@/lib/batimento-da-auditoria";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { linhasDeAuditText, memoriasDosArquivos } from "@/lib/memoria-do-documento";
import type { ExtractedPdf } from "@/lib/pdf-text";
import {
  createStoredDocumentArtifact,
  createStoredProjectUpload,
} from "@/lib/project-files";
import {
  createProjectEvent,
  getChecksumSha256,
  type ActorIdentity,
} from "@/lib/project-store";

export type UploadedAuditFile = {
  file: File;
  fileType: string;
  buffer: Buffer;
  extracted: ExtractedPdf;
};

export async function createPendingAudit(args: {
  auditId: string;
  auditMode: AuditMode;
  analysisLevel: AnalysisLevel;
  auditTitle: string;
  projectName: string;
  auditDescription: string;
  projectId?: string | null;
  actor?: ActorIdentity | null;
  files: File[];
  fileTypes: string[];
}) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    const prisma = getPrisma();
    const audit = await prisma.audit.create({
      data: {
        id: args.auditId,
        projectId: args.projectId ?? undefined,
        userId: args.actor?.id ?? undefined,
        title: args.auditTitle || "Auditoria sem identificação",
        projectName: args.projectName || "Projeto não informado",
        description: args.auditDescription,
        auditMode: args.auditMode,
        analysisLevel: args.analysisLevel,
        status: "PROCESSING",
        /*
         * O PRIMEIRO BATIMENTO nasce junto com a linha, e não trinta segundos
         * depois. `auditoriaSemSinal` já trata o nulo caindo para `createdAt`,
         * mas deixar a coluna nula no começo faria a única diferença entre "vai
         * nascer" e "morreu há três dias" ser a IDADE da linha — e é exatamente
         * essa ambiguidade que o batimento existe para remover.
         */
        heartbeatAt: new Date(),
        files: {
          create: args.files.map((file, index) => ({
            fileName: file.name,
            documentType: args.fileTypes[index] ?? "não informado",
            sizeBytes: file.size,
          })),
        },
      },
      select: { id: true },
    });

    if (args.projectId && args.actor) {
      await createProjectEvent(prisma, {
        projectId: args.projectId,
        actor: args.actor,
        type: "AUDIT_CREATED",
        title: "Auditoria criada",
        summary: args.auditTitle || args.projectName || "Auditoria documental",
        details: {
          auditId: audit.id,
          auditMode: args.auditMode,
          analysisLevel: args.analysisLevel,
          fileCount: args.files.length,
        },
      });
    }

    return audit.id;
  } catch (error) {
    console.error("[audit] falha ao iniciar persistência da auditoria", error);
    return null;
  }
}

export async function persistCompletedAudit(args: {
  auditId: string | null;
  uploadedFiles: UploadedAuditFile[];
  report: AuditReport;
  result: string;
  elapsedMs: number;
  projectId?: string | null;
  /** O escritório dono dos bytes. Sem ele o memorial não é guardado. */
  organizationId?: string | null;
  actor?: ActorIdentity | null;
}) {
  if (!args.auditId || !isDatabaseConfigured()) {
    return;
  }

  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.audit.updateMany({
        where: {
          id: args.auditId!,
          status: "PROCESSING",
        },
        data: {
          status: "COMPLETED",
          result: args.result,
          report: args.report as Prisma.InputJsonValue,
          elapsedMs: args.elapsedMs,
          totalFindings: args.report.total_incongruencias,
          completedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        return;
      }

      await transaction.auditFile.deleteMany({ where: { auditId: args.auditId! } });
      await transaction.auditFile.createMany({
        data: args.uploadedFiles.map((file) => ({
          auditId: args.auditId!,
          fileName: file.file.name,
          documentType: file.fileType,
          pageCount: file.extracted.pageCount,
          extractedCharCount: file.extracted.charCount,
          sizeBytes: file.file.size,
          /*
           * O checksum sai do MESMO buffer que vai para `StoredFile`, e não de
           * uma segunda leitura: dois cálculos são duas chances de divergir, e a
           * divergência aqui daria um botão que aponta para um arquivo que não
           * existe.
           */
          checksumSha256: getChecksumSha256(file.buffer),
        })),
      });

      /*
       * O TEXTO, para o chat poder reler.
       *
       * Na mesma transação e a partir do `extracted` que JÁ está na mão: a
       * corrida acabou de extrair o documento inteiro e o descartava. Não é
       * preciso mexer na rota de auditoria nem re-extrair nada.
       *
       * Reauditar SUBSTITUI a memória junto com o parecer — as duas coisas
       * descrevem a MESMA corrida, e uma memória de outra revisão faria o chat
       * citar a página de um documento que não é mais o auditado.
       */
      await transaction.auditText.deleteMany({ where: { auditId: args.auditId! } });
      const memorias = memoriasDosArquivos(args.uploadedFiles);
      if (memorias.length > 0) {
        await transaction.auditText.createMany({
          data: linhasDeAuditText(args.auditId!, memorias),
        });
      }

      if (args.projectId && args.actor) {
        for (const file of args.uploadedFiles) {
          await createStoredProjectUpload(transaction, {
            data: file.buffer,
            projectId: args.projectId,
            organizationId: args.organizationId,
            actor: args.actor,
            module: "audit",
            source: "audit-input",
            fileName: file.file.name,
            mimeType: file.file.type || "application/pdf",
            pageCount: file.extracted.pageCount,
            metadata: {
              auditId: args.auditId,
              documentType: file.fileType,
              extractedCharCount: file.extracted.charCount,
            },
          });
        }

        await createStoredDocumentArtifact(transaction, {
          data: args.result,
          projectId: args.projectId,
          auditId: args.auditId,
          actor: args.actor,
          module: "audit",
          kind: "AUDIT_MARKDOWN",
          fileName: `${args.auditId}-relatorio-auditoria.md`,
          mimeType: "text/markdown",
          metadata: {
            auditMode: args.report.tipo_auditoria,
            analysisLevel: args.report.runtime?.nivel_analise,
            totalFindings: args.report.total_incongruencias,
          },
        });
      }
    });
  } catch (error) {
    console.error("[audit] falha ao persistir auditoria", error);
  }
}

export async function persistFailedAudit(
  auditId: string | null,
  error: unknown,
  elapsedMs: number,
) {
  if (!auditId || !isDatabaseConfigured()) {
    return;
  }

  try {
    const prisma = getPrisma();
    await prisma.audit.updateMany({
      where: { id: auditId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Não foi possível concluir a auditoria documental.",
        elapsedMs,
        completedAt: new Date(),
      },
    });
  } catch (persistenceError) {
    console.error("[audit] falha ao persistir erro da auditoria", persistenceError);
  }
}

/**
 * MANTÉM O BATIMENTO enquanto a auditoria roda.
 *
 * Chamado logo depois de `createPendingAudit` e desligado no `finally` da rota,
 * junto da devolução da vaga. Enquanto este intervalo estiver de pé, existe um
 * processo do outro lado; quando o container morre, o intervalo morre com ele —
 * e é a AUSÊNCIA de escrita, não uma mensagem de erro, que conta a verdade.
 *
 * O porquê do desenho (teto de silêncio, e não teto de duração) está em
 * [[lib/batimento-da-auditoria.ts]].
 *
 * FALHA DE ESCRITA É ENGOLIDA, de propósito. O banco piscando não pode derrubar
 * uma análise de seis minutos que já foi paga ao modelo: o pior que acontece é
 * um batimento perdido, e a tolerância existe para cobrir exatamente isso.
 *
 * `unref()` para o intervalo não segurar o processo de pé sozinho — num script
 * ou num teste, um timer vivo faria o node nunca sair.
 */
export function manterBatimento(auditId: string | null): { parar: () => void } {
  if (!auditId || !isDatabaseConfigured()) {
    return { parar: () => {} };
  }

  const bater = () => {
    void getPrisma()
      .audit.updateMany({
        // Só bate no que ainda está rodando: cancelada por outra aba não revive.
        where: { id: auditId, status: "PROCESSING" },
        data: { heartbeatAt: new Date() },
      })
      .catch(() => {});
  };

  /*
   * O PRIMEIRO BATIMENTO SAI JÁ, sem esperar os trinta segundos.
   *
   * `createPendingAudit` acabou de carimbar a linha, então em produção esta
   * escrita é redundante — e é o preço de a função ser verdadeira sozinha:
   * quem chamar `manterBatimento` sobre uma auditoria parada tem o direito de
   * ver o sinal voltar imediatamente, e é assim que `prova:batimento` prova
   * que o intervalo escreve de verdade, sem esperar meio minuto por teste.
   */
  bater();

  const timer = setInterval(bater, INTERVALO_DE_BATIMENTO_MS);

  timer.unref?.();

  return {
    parar: () => {
      clearInterval(timer);
    },
  };
}

/**
 * FECHA a auditoria que perdeu o processo — o que ninguém fez até agora.
 *
 * `updateMany` com `status: "PROCESSING"` na condição, e não `update` por id:
 * duas abas podem consultar a mesma auditoria órfã no mesmo segundo, e a
 * segunda não pode sobrescrever nada. Quem chegar depois encontra a linha já
 * FAILED e lê o mesmo motivo.
 */
export async function marcarAuditoriaSemSinal(auditId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;

  try {
    await getPrisma().audit.updateMany({
      where: { id: auditId, status: "PROCESSING" },
      data: {
        status: "FAILED",
        error: MOTIVO_SEM_SINAL,
        completedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[audit] falha ao fechar auditoria sem sinal", error);
  }
}
