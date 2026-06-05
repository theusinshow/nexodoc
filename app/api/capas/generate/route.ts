import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  assertProjectAccess,
  createDocumentArtifact,
  getUserActor,
  normalizeEmail,
} from "@/lib/project-store";
import { describeStoredFile } from "@/lib/file-storage";
import { generateOdtBuffer } from "@/server/odt";
import { convertOdtToPdf } from "@/server/pdf";
import { getFileName } from "@/lib/cover-utils";
import type { GeneralData, CoverPage } from "@/modules/cover-generator/types";

interface GenerateRequest {
  projectId?: string;
  generalData: GeneralData;
  pages: CoverPage[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateRequest;
    const { generalData, pages, projectId } = body;

    if (!generalData || typeof generalData !== "object") {
      return NextResponse.json(
        { error: "Dados gerais obrigatorios (generalData)." },
        { status: 400 }
      );
    }

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: "Lista de paginas obrigatoria (pages)." },
        { status: 400 }
      );
    }

    if (pages.length > 500) {
      return NextResponse.json(
        { error: "Limite de 500 paginas excedido." },
        { status: 400 }
      );
    }

    const sigla = generalData.siglaArquivo || "";
    const revisao = generalData.revisao || "r";
    const codigoInterno = generalData.codigoInterno || "codigo";

    const odtFileName = getFileName(codigoInterno, sigla, revisao, "odt");
    const pdfFileName = getFileName(codigoInterno, sigla, revisao, "pdf");
    const zipFileName = getFileName(codigoInterno, sigla, revisao, "zip");

    const odtBuffer = await generateOdtBuffer({
      templateId: generalData.templateId,
      generalData,
      pages,
    });

    const { pdfBuffer, error: pdfError } = await convertOdtToPdf(odtBuffer);

    let zipData: string;

    if (pdfBuffer) {
      const zip = new JSZip();
      zip.file(odtFileName, odtBuffer);
      zip.file(pdfFileName, pdfBuffer);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      zipData = Buffer.from(zipBuffer).toString("base64");
    } else {
      const zip = new JSZip();
      zip.file(odtFileName, odtBuffer);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      zipData = Buffer.from(zipBuffer).toString("base64");
    }

    if (projectId) {
      if (!isDatabaseConfigured()) {
        return NextResponse.json(
          { error: "DATABASE_URL nao configurada para registrar artefatos." },
          { status: 503 },
        );
      }

      const session = await auth();
      const email = session?.user?.email?.trim();

      if (!email) {
        return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
      }

      const actor = await getUserActor(normalizeEmail(email), session?.user?.name ?? null);

      try {
        await assertProjectAccess(projectId, actor);
      } catch {
        return NextResponse.json({ error: "Projeto nao encontrado." }, { status: 404 });
      }

      await getPrisma().$transaction(async (tx) => {
        const odtStorage = describeStoredFile({
          data: odtBuffer,
          module: "capas",
          projectId,
          fileName: odtFileName,
        });
        await createDocumentArtifact(tx, {
          projectId,
          actor,
          module: "capas",
          kind: "COVER_ODT",
          fileName: odtFileName,
          mimeType: "application/vnd.oasis.opendocument.text",
          ...odtStorage,
          metadata: {
            templateId: generalData.templateId,
            pageCount: pages.length,
          },
        });

        if (pdfBuffer) {
          const pdfStorage = describeStoredFile({
            data: pdfBuffer,
            module: "capas",
            projectId,
            fileName: pdfFileName,
          });
          await createDocumentArtifact(tx, {
            projectId,
            actor,
            module: "capas",
            kind: "COVER_PDF",
            fileName: pdfFileName,
            mimeType: "application/pdf",
            ...pdfStorage,
            metadata: {
              templateId: generalData.templateId,
              pageCount: pages.length,
            },
          });
        }

        const zipBuffer = Buffer.from(zipData, "base64");
        const zipStorage = describeStoredFile({
          data: zipBuffer,
          module: "capas",
          projectId,
          fileName: zipFileName,
        });
        await createDocumentArtifact(tx, {
          projectId,
          actor,
          module: "capas",
          kind: "COVER_ZIP",
          fileName: zipFileName,
          mimeType: "application/zip",
          ...zipStorage,
          metadata: {
            templateId: generalData.templateId,
            pageCount: pages.length,
            pdfGenerated: Boolean(pdfBuffer),
          },
        });
      });
    }

    return NextResponse.json({
      files: {
        odt: {
          name: odtFileName,
          data: Buffer.from(odtBuffer).toString("base64"),
        },
        pdf: pdfBuffer
          ? {
              name: pdfFileName,
              data: Buffer.from(pdfBuffer).toString("base64"),
            }
          : null,
        zip: {
          name: zipFileName,
          data: zipData,
        },
      },
      pdfError: pdfError || undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
