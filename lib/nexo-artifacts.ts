import type { DocumentArtifactKind, Prisma } from "@prisma/client";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { createStoredDocumentArtifact } from "@/lib/project-files";
import { getUserActor } from "@/lib/project-store";

/**
 * Registro no servidor do que o Nexo GEROU (capa, volume, separatriz).
 *
 * Até aqui só a LD entrava no Postgres (`LdDraft`, via `saveLdDraft`); capa,
 * volume e separatriz viviam só no IndexedDB do navegador. As telas standalone
 * gravavam `DocumentArtifact` — mas SÓ quando abertas de dentro de um projeto,
 * que é o único caminho que lhes passa `projectId`. O Nexo ainda não tem
 * projeto, e é por isso que este registrador não exige um: `DocumentArtifact`
 * aceita `projectId` nulo, e um artefato sem projeto continua sendo histórico
 * real — quem produziu, quando, com que identidade, com que tamanho e checksum.
 *
 * O que NÃO fazemos aqui: guardar os bytes. Com `NEXODOC_STORAGE_PROVIDER`
 * ausente (o padrão), `describeStoredFile` grava provedor "none" e só o
 * tamanho + sha256 — exatamente como o módulo de capas já fazia. Registrar é
 * contabilidade, não arquivo morto.
 *
 * NUNCA lança: falhar em registrar não pode derrubar a geração. O engenheiro já
 * tem o documento em mãos, e perder o download por causa da contabilidade seria
 * trocar o produto pelo registro dele.
 */

export interface NexoArtifactFile {
  kind: DocumentArtifactKind;
  fileName: string;
  mimeType: string;
  data: Buffer | Uint8Array | string;
}

export interface RecordNexoArtifactsInput {
  user: { email?: string | null; name?: string | null };
  /** Módulo de origem, no vocabulário já usado pelas telas: "capas" | "volumes" | "separatrizes". */
  module: string;
  files: NexoArtifactFile[];
  /** Fatos que identificam o documento (obra, código, disciplina, tomo...). */
  metadata?: Record<string, unknown>;
}

/** Grava os artefatos gerados e devolve quantos entraram. Zero = não registrou. */
export async function recordNexoArtifacts(
  input: RecordNexoArtifactsInput,
): Promise<number> {
  const files = input.files.filter((file) => Boolean(file));

  if (files.length === 0 || !isDatabaseConfigured()) {
    return 0;
  }

  const email = input.user.email?.trim().toLocaleLowerCase("pt-BR");

  if (!email) {
    return 0;
  }

  try {
    const actor = await getUserActor(email, input.user.name ?? null);
    // `origem` distingue o que saiu do Nexo do que saiu das telas standalone —
    // é o que vai permitir medir a migração antes de remover as telas.
    const metadata = {
      origem: "nexo",
      ...(input.metadata ?? {}),
    } as Prisma.InputJsonValue;

    await getPrisma().$transaction(async (tx) => {
      for (const file of files) {
        await createStoredDocumentArtifact(tx, {
          data: file.data,
          actor,
          module: input.module,
          kind: file.kind,
          fileName: file.fileName,
          mimeType: file.mimeType,
          metadata,
        });
      }
    });

    return files.length;
  } catch (err) {
    console.error(
      `[nexo/${input.module}] artefato gerado mas NAO registrado no historico: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return 0;
  }
}
