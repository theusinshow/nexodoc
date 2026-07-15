import { NextResponse } from "next/server";

import { extractPdfText } from "@/lib/pdf-text";
import { classifyDocument, type DocumentClassification } from "@/lib/audit-classify";

export const runtime = "nodejs";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * Pré-leitura determinística: lê o(s) arquivo(s) e devolve o tipo de documento
 * (memorial/LD/capa/prancha/orçamento) e a identidade (obra, município, código)
 * para o cartão de confirmação da tela de auditoria. Não chama IA, não persiste.
 */
export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie os arquivos como multipart/form-data." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Envie no máximo ${MAX_FILES} arquivos.` }, { status: 400 });
  }

  const classifications: DocumentClassification[] = [];

  for (const file of files) {
    if (!isPdf(file)) {
      return NextResponse.json(
        { error: `O arquivo "${file.name}" não é um PDF.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `O arquivo "${file.name}" excede o limite de 25 MB.` },
        { status: 400 },
      );
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractPdfText(buffer);
      classifications.push(classifyDocument(file.name, extracted));
    } catch {
      // PDF ilegível (corrompido / só imagem sem texto): devolve um cartão de
      // baixa confiança para o operador confirmar manualmente, sem derrubar o lote.
      classifications.push({
        fileName: file.name,
        tipo: "desconhecido",
        tipoLabel: "Não identificado",
        obra: "",
        municipio: "",
        codigo: "",
        orgao: "",
        revisao: "",
        confianca: "baixa",
        auditMode: "memorial",
        analysisLevel: "standard",
        pageCount: 0,
        charCount: 0,
        precisaOcr: true,
        sinais: ["não foi possível extrair texto do PDF (provável imagem) — confirme o tipo manualmente"],
      });
    }
  }

  return NextResponse.json({ classifications });
}
