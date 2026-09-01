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
