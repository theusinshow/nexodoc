import { NextResponse } from "next/server";
import { toFile } from "openai";

import { AUDITOR_SYSTEM_PROMPT } from "@/lib/auditor-prompt";
import { getOpenAIClient } from "@/lib/openai";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const DEFAULT_MODEL = "gpt-5.1-mini";

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
      instructions: AUDITOR_SYSTEM_PROMPT,
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

    return NextResponse.json({ result });
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return jsonError("OPENAI_API_KEY não configurada no backend.", 500);
    }

    return jsonError("Não foi possível concluir a auditoria documental.", 500);
  }
}
