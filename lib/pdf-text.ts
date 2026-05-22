export type ExtractedPdfPage = {
  page: number;
  text: string;
};

export type ExtractedPdf = {
  pages: ExtractedPdfPage[];
  text: string;
  pageCount: number;
  charCount: number;
};

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const pages: ExtractedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => {
        return "str" in item && typeof item.str === "string" ? item.str : "";
      })
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push({
      page: pageNumber,
      text,
    });
  }

  await document.destroy();

  const text = pages.map((page) => `--- PAGINA ${page.page} ---\n${page.text}`).join("\n\n");

  return {
    pages,
    text,
    pageCount: document.numPages,
    charCount: text.length,
  };
}

export type AuditTextChunk = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  text: string;
};

function getPageChapter(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const match =
    normalized.match(/(?:^|\s)(\d{1,2})\s+[–-]?\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s/]{5,80})/) ??
    normalized.match(/Cap\.\s*(\d{1,2})\s*[–-]\s*([^|]{5,80})/i);

  if (!match) {
    return "";
  }

  return `${match[1]} - ${match[2].trim()}`.replace(/\s+/g, " ");
}

export function chunkPdfByChapter(extracted: ExtractedPdf, maxChunkChars = 28000) {
  const chunks: AuditTextChunk[] = [];
  let currentTitle = "Inicio do documento";
  let currentStartPage = extracted.pages[0]?.page ?? 1;
  let currentText = "";

  function pushCurrent(endPage: number) {
    const text = currentText.trim();

    if (!text) {
      return;
    }

    chunks.push({
      id: `chunk-${chunks.length + 1}`,
      title: currentTitle,
      startPage: currentStartPage,
      endPage,
      text,
    });
  }

  for (const page of extracted.pages) {
    const chapter = getPageChapter(page.text);
    const pageText = `--- PAGINA ${page.page} ---\n${page.text}\n`;
    const shouldSplitByChapter =
      chapter && chapter !== currentTitle && currentText.length > 0;
    const shouldSplitBySize = currentText.length + pageText.length > maxChunkChars;

    if (shouldSplitByChapter || shouldSplitBySize) {
      pushCurrent(page.page - 1);
      currentText = "";
      currentStartPage = page.page;
      currentTitle = chapter || currentTitle;
    } else if (chapter) {
      currentTitle = chapter;
    }

    currentText += pageText;
  }

  pushCurrent(extracted.pages.at(-1)?.page ?? currentStartPage);

  return chunks;
}
