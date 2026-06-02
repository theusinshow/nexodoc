import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";

export interface SeparatorOptions {
  title: string;
  pageSize?: "A4" | "A3";
}

const PAGE_SIZES = {
  A4: { width: 595.3, height: 841.89 },
  A3: { width: 841.89, height: 1190.55 },
};

const INTERIM_TEMPLATE = {
  fontSize: 14,
  x: 242.15,
  baselineFromBottom: 344,
  maxWidth: 300,
  lineHeight: 19,
};

export async function generateSeparatorPdf(
  options: SeparatorOptions
): Promise<Uint8Array> {
  const { title, pageSize = "A4" } = options;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_SIZES[pageSize].width, PAGE_SIZES[pageSize].height]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  const upperTitle = title.toUpperCase();

  const fontSize = INTERIM_TEMPLATE.fontSize;
  const maxWidth = Math.min(INTERIM_TEMPLATE.maxWidth, width - INTERIM_TEMPLATE.x - 40);

  const lines = wrapText(upperTitle, fontBold, fontSize, maxWidth);

  const startY = Math.min(INTERIM_TEMPLATE.baselineFromBottom, height - 80);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY - i * INTERIM_TEMPLATE.lineHeight;

    page.drawText(line, {
      x: INTERIM_TEMPLATE.x,
      y,
      size: fontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

export function createSeparatorTitle(blockTitle: string, disciplineCode?: string): string {
  const parts: string[] = [];

  if (disciplineCode) {
    parts.push(disciplineCode);
  }

  if (blockTitle) {
    parts.push(blockTitle);
  }

  return parts.join(" - ");
}
