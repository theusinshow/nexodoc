import { NextResponse } from "next/server";
import { toFile } from "openai";

import { parseAuditMode } from "@/lib/audit-mode";
import { getAuditorPrompt } from "@/lib/auditor-prompt";
import {
  getMockAuditResult,
  isMockModeEnabled,
  waitForMockAudit,
} from "@/lib/mock-audit";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-5-mini";
const DEFAULT_FAST_MAX_OUTPUT_TOKENS = 900;
const DEFAULT_VOLUME_MAX_OUTPUT_TOKENS = 1600;
const DEFAULT_COMPLETE_MAX_OUTPUT_TOKENS = 1800;

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const message = String(formData.get("message") ?? "").trim();
    const auditMode = parseAuditMode(formData.get("auditMode"));
    const files = formData
      .getAll("files")
      .filter((file): file is File => file instanceof File);

    if (!message) {
      return jsonError("Informe uma solicitação para a auditoria.");
    }

    if (files.length === 0) {
      return jsonError("Envie pelo menos um PDF para análise.");
    }

    if (files.length > MAX_FILES) {
      return jsonError(`Envie no máximo ${MAX_FILES} PDFs por análise.`);
    }

    for (const file of files) {
      if (!isPdf(file)) {
        return jsonError(`O arquivo "${file.name}" não é um PDF válido.`);
      }

      if (file.size > MAX_FILE_SIZE) {
        return jsonError(`O arquivo "${file.name}" excede o limite de 25 MB.`);
      }
    }

    if (isMockModeEnabled()) {
      await waitForMockAudit();
      return NextResponse.json({
        result: getMockAuditResult(auditMode),
        auditMode,
        mock: true,
      });
    }

    const openai = getOpenAIClient();
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return openai.files.create({
          file: await toFile(buffer, file.name, { type: "application/pdf" }),
          purpose: "user_data",
        });
      }),
    );

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      instructions: getAuditorPrompt(auditMode),
      max_output_tokens:
        auditMode === "volume"
          ? Number(
              process.env.NEXODOC_VOLUME_MAX_OUTPUT_TOKENS ??
                DEFAULT_VOLUME_MAX_OUTPUT_TOKENS,
            )
          : auditMode === "complete"
          ? Number(
              process.env.NEXODOC_COMPLETE_MAX_OUTPUT_TOKENS ??
                DEFAULT_COMPLETE_MAX_OUTPUT_TOKENS,
            )
          : Number(
              process.env.NEXODOC_FAST_MAX_OUTPUT_TOKENS ??
                DEFAULT_FAST_MAX_OUTPUT_TOKENS,
            ),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
            ...uploadedFiles.map((file) => ({
              type: "input_file" as const,
              file_id: file.id,
            })),
          ],
        },
      ],
    });

    const result = response.output_text?.trim();

    if (!result) {
      return jsonError("A análise não retornou conteúdo.", 502);
    }

    return NextResponse.json({ result, auditMode });
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return jsonError("OPENAI_API_KEY não configurada no backend.", 500);
    }

    if (
      error instanceof Error &&
      (error.message.includes("model") || error.message.includes("modelo"))
    ) {
      return jsonError(
        "Modelo da OpenAI indisponível. Verifique OPENAI_MODEL no .env.local.",
        500,
      );
    }

    if (
      error instanceof Error &&
      (error.message.includes("quota") ||
        error.message.includes("insufficient_quota") ||
        error.message.includes("billing"))
    ) {
      return jsonError(
        "A conta da OpenAI API está sem quota ou sem cobrança ativa. Verifique o billing na plataforma da OpenAI.",
        402,
      );
    }

    return jsonError("Não foi possível concluir a auditoria documental.", 500);
  }
}
