import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { recordNexoArtifacts } from "@/lib/nexo-artifacts";
import {
  assembleVolume,
  type MetadadosDoVolume,
  type VolumePart,
  type VolumePartRole,
} from "@/server/nexo/tools/assemble-volume";

export const runtime = "nodejs";

/**
 * Monta o volume final: recebe as partes ja geradas (capa + separatrizes +
 * pranchas + LD) como PDFs em base64, decoda para Buffer, funde EM ORDEM num
 * unico PDF reusando o motor do modulo Volume e devolve o PDF em base64. A ordem
 * enviada e respeitada; passe `reorder: true` para reordenar canonicamente
 * (capa -> separatrizes -> pranchas -> ld).
 */

const VALID_ROLES: readonly VolumePartRole[] = [
  "capa",
  "separatriz",
  "prancha",
  "ld",
];

export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let parts: VolumePart[];
  let fileName: string | undefined;
  let reorder = false;
  /** Propriedades do PDF final — sem elas, o documento sai assinado pela lib. */
  let metadados: MetadadosDoVolume | undefined;
  try {
    const body = (await req.json()) as {
      parts?: unknown;
      fileName?: unknown;
      reorder?: unknown;
      metadados?: unknown;
    };
    if (!Array.isArray(body.parts)) throw new Error("parts ausente");

    parts = body.parts.map((raw, index) => {
      const part = raw as {
        role?: unknown;
        name?: unknown;
        data?: unknown;
        startPage?: unknown;
        endPage?: unknown;
      };
      if (
        typeof part.role !== "string" ||
        !VALID_ROLES.includes(part.role as VolumePartRole)
      ) {
        throw new Error(`parts[${index}].role invalido`);
      }
      if (typeof part.name !== "string" || !part.name.trim()) {
        throw new Error(`parts[${index}].name ausente`);
      }
      if (typeof part.data !== "string" || !part.data) {
        throw new Error(`parts[${index}].data ausente`);
      }
      return {
        role: part.role as VolumePartRole,
        name: part.name,
        buffer: Buffer.from(part.data, "base64"),
        startPage: typeof part.startPage === "number" ? part.startPage : undefined,
        endPage: typeof part.endPage === "number" ? part.endPage : undefined,
      };
    });

    if (typeof body.fileName === "string" && body.fileName.trim()) {
      fileName = body.fileName.trim();
    }
    if (body.metadados && typeof body.metadados === "object") {
      const m = body.metadados as Record<string, unknown>;
      const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
      metadados = {
        titulo: texto(m.titulo),
        autor: texto(m.autor),
        assunto: texto(m.assunto),
        palavrasChave: Array.isArray(m.palavrasChave)
          ? m.palavrasChave.map((k) => String(k).trim()).filter(Boolean)
          : undefined,
      };
    }
    if (typeof body.reorder === "boolean") {
      reorder = body.reorder;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Corpo invalido." },
      { status: 400 },
    );
  }

  if (parts.length === 0) {
    return NextResponse.json({ error: "Nenhuma parte informada." }, { status: 400 });
  }

  const result = await assembleVolume({ parts, fileName, reorder, metadados });

  /*
   * O volume montado entra no HISTÓRICO DO SERVIDOR. Só quando a fusão deu
   * certo: um volume registrado sem PDF seria registro de coisa que não
   * aconteceu. As partes viram contagem por papel — é o que permite olhar a
   * linha depois e saber se aquele volume levou capa e LD ou só pranchas.
   */
  if (result.pdf) {
    await recordNexoArtifacts({
      user: { email: session.user.email, name: session.user.name },
      module: "volumes",
      metadata: {
        artifactRole: "assembled-volume",
        pageCount: result.pageCount ?? null,
        totalPartes: parts.length,
        partes: VALID_ROLES.reduce<Record<string, number>>((acc, role) => {
          acc[role] = parts.filter((part) => part.role === role).length;
          return acc;
        }, {}),
      },
      files: [
        {
          kind: "VOLUME_PDF",
          fileName: result.pdf.name,
          mimeType: "application/pdf",
          data: result.pdf.buffer,
        },
      ],
    });
  }

  return NextResponse.json({
    pdf: result.pdf
      ? { name: result.pdf.name, data: result.pdf.buffer.toString("base64") }
      : null,
    error: result.error,
    pageCount: result.pageCount,
    // Quantas páginas cada parte contribuiu — é o alicerce da conferência do
    // volume montado, que precisa saber QUAL página deveria ser qual folha.
    partes: result.partes,
  });
}
