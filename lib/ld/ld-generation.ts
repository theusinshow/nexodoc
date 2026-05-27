import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

export type LdData = {
  projectCode: string;
  formattedCode: string;
  discipline: string;
  revision: string;
  sectionTitle: string;
  client: string;
  workName: string;
  phase: string;
};

export type ReviewRow = {
  sheet: string;
  file: string;
  description: string;
  readDiscipline?: string;
  lowConfidence?: boolean;
  reviewedAlertKeys?: string[];
};

export type Tomo = {
  title: string;
  start: string;
  end: string;
};

export type GeneratePayload = {
  ldData: LdData;
  rows: ReviewRow[];
  tomos: Tomo[];
  templateBase64?: string | null;
  inconsistencies?: InconsistencyPayload;
};

export type InconsistencyPayload = {
  missingSheets: number[];
  globalWarnings: string[];
  rowWarnings: Array<{
    sheet: string;
    file: string;
    warnings: string[];
    reviewed: boolean;
  }>;
};

const templatePath = path.join(process.cwd(), "templates", "modelo_ld_empresa.odt");

export function buildBaseFileName(data: LdData) {
  return `${data.projectCode}_${data.discipline}_ld_${data.revision}`.toLowerCase();
}

export function buildOdtFileName(data: LdData) {
  return `${buildBaseFileName(data)}.odt`;
}

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeDescription(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseSheetNumber(value: string) {
  const match = value.trim().match(/(\d+)\s*\/\s*(\d+)/);

  return match ? Number(match[1]) : null;
}

function parseTemplateBase64(value: string) {
  const base64 = value.includes(",") ? value.split(",").at(-1) : value;

  if (!base64) {
    throw new Error("Template alternativo inválido.");
  }

  return Buffer.from(base64, "base64");
}

async function loadTemplateBuffer(templateBase64?: string | null) {
  if (templateBase64) {
    return parseTemplateBase64(templateBase64);
  }

  try {
    return await readFile(templatePath);
  } catch {
    throw new Error("Template padrão não encontrado em templates/modelo_ld_empresa.odt.");
  }
}

function replaceTagValue(xml: string, tag: string, value: string) {
  const escapedValue = escapeXml(value);
  const regex = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`);

  if (!regex.test(xml)) {
    return xml;
  }

  return xml.replace(regex, `$1${escapedValue}$3`);
}

function replaceUserDefined(xml: string, name: string, value: string) {
  const escapedName = escapeXml(name);
  const escapedValue = escapeXml(value);
  const regex = new RegExp(
    `(<meta:user-defined\\b(?=[^>]*meta:name="${escapedName}")[^>]*>)([\\s\\S]*?)(</meta:user-defined>)`,
  );

  if (regex.test(xml)) {
    return xml.replace(regex, `$1${escapedValue}$3`);
  }

  return xml.replace(
    "</office:meta>",
    `<meta:user-defined meta:name="${escapedName}">${escapedValue}</meta:user-defined></office:meta>`,
  );
}

function replaceDisplayedField(xml: string, fieldName: string, value: string) {
  const escapedValue = escapeXml(value);
  const userDefinedRegex = new RegExp(
    `(<text:user-defined\\b(?=[^>]*text:name="${escapeXml(fieldName)}")[^>]*>)([\\s\\S]*?)(</text:user-defined>)`,
    "g",
  );

  return xml
    .replace(userDefinedRegex, `$1${escapedValue}$3`)
    .replace(/(<text:subject\b[^>]*>)([\s\S]*?)(<\/text:subject>)/g, (_, start, current, end) =>
      fieldName === "Assunto" ? `${start}${escapedValue}${end}` : `${start}${current}${end}`,
    )
    .replace(/(<text:description\b[^>]*>)([\s\S]*?)(<\/text:description>)/g, (_, start, current, end) =>
      fieldName === "Anotações" ? `${start}${escapedValue}${end}` : `${start}${current}${end}`,
    );
}

function updateMetaXml(metaXml: string, data: LdData) {
  let xml = metaXml;

  xml = replaceUserDefined(xml, "Info 1", data.client);
  xml = replaceUserDefined(xml, "Info 2", data.formattedCode);
  xml = replaceUserDefined(xml, "Info 3", "Lista de documentos");
  xml = replaceUserDefined(xml, "Info 4", "LISTA DE DOCUMENTOS");
  xml = replaceTagValue(xml, "dc:subject", data.workName);
  xml = replaceTagValue(xml, "dc:description", data.phase);

  return xml;
}

function updateDisplayedProperties(xml: string, data: LdData) {
  let nextXml = xml;

  nextXml = replaceDisplayedField(nextXml, "Info 1", data.client);
  nextXml = replaceDisplayedField(nextXml, "Info 2", data.formattedCode);
  nextXml = replaceDisplayedField(nextXml, "Info 3", "Lista de documentos");
  nextXml = replaceDisplayedField(nextXml, "Info 4", "LISTA DE DOCUMENTOS");
  nextXml = replaceDisplayedField(nextXml, "Assunto", data.workName);
  nextXml = replaceDisplayedField(nextXml, "Anotações", data.phase);

  return nextXml;
}

function getRowsForTomo(rows: ReviewRow[], tomo: Tomo, isSingleTomo: boolean) {
  if (isSingleTomo) {
    return rows;
  }

  const start = parseSheetNumber(tomo.start);
  const end = parseSheetNumber(tomo.end);

  if (!start || !end) {
    return [];
  }

  return rows.filter((row) => {
    const sheet = parseSheetNumber(row.sheet);

    return sheet !== null && sheet >= start && sheet <= end;
  });
}

function validateTomoRanges(tomos: Tomo[]) {
  if (tomos.length <= 1) {
    return;
  }

  const ranges = tomos.map((tomo) => {
    const start = tomo.start.match(/(\d+)\s*\/\s*(\d+)/);
    const end = tomo.end.match(/(\d+)\s*\/\s*(\d+)/);

    if (!start || !end) {
      throw new Error("A divisão dos tomos possui intervalo inválido.");
    }

    return {
      start: Number(start[1]),
      end: Number(end[1]),
      total: Number(start[2]),
      endTotal: Number(end[2]),
    };
  });
  const total = ranges[0].total;

  if (
    ranges[0].start !== 1 ||
    ranges.some((range) => range.total !== total || range.endTotal !== total || range.end < range.start) ||
    ranges.some((range, index) => index > 0 && range.start !== ranges[index - 1].end + 1) ||
    ranges[ranges.length - 1].end !== total
  ) {
    throw new Error("A divisão dos tomos deve cobrir exatamente todas as folhas, sem lacunas ou sobreposições.");
  }
}

function buildTableRow(rowTemplate: string, row: ReviewRow) {
  return rowTemplate
    .replaceAll("{{NUMERO_FOLHA}}", escapeXml(row.sheet))
    .replaceAll("{{ARQUIVO}}", escapeXml(row.file))
    .replaceAll("{{DESCRICAO}}", escapeXml(normalizeDescription(row.description)));
}

function addPageBreakStyle(contentXml: string) {
  if (contentXml.includes('style:name="LD_PageBreak"')) {
    return contentXml;
  }

  const styleXml =
    '<style:style style:name="LD_PageBreak" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:break-before="page"/></style:style>';

  return contentXml.replace("</office:automatic-styles>", `${styleXml}</office:automatic-styles>`);
}

function buildContentXml(contentXml: string, data: LdData, rows: ReviewRow[], tomos: Tomo[]) {
  validateTomoRanges(tomos);
  const titleRegex = /<text:p\b[^>]*>\{\{TITULO_SECAO\}\}<\/text:p>/;
  const tableRegex = /<table:table\b[\s\S]*?<\/table:table>/;
  const titleMatch = contentXml.match(titleRegex);
  const tableMatch = contentXml.match(tableRegex);

  if (!titleMatch || !tableMatch) {
    throw new Error("Template ODT precisa conter {{TITULO_SECAO}} e uma tabela com marcadores.");
  }

  const tableXml = tableMatch[0];
  const markerRows = tableXml.match(/<table:table-row\b[\s\S]*?<\/table:table-row>/g)?.filter((row) =>
    row.includes("{{NUMERO_FOLHA}}"),
  );

  if (!markerRows?.length) {
    throw new Error("Template ODT precisa conter uma linha de tabela com {{NUMERO_FOLHA}}, {{ARQUIVO}} e {{DESCRICAO}}.");
  }

  const rowTemplate = markerRows[0];
  const baseTableXml = markerRows.reduce((currentTable, markerRow) => currentTable.replace(markerRow, ""), tableXml);
  const insertionPoint = "</table:table>";
  const effectiveTomos = tomos.length > 0 ? tomos : [{ title: "TOMO 1", start: "", end: "" }];
  const isSingleTomo = effectiveTomos.length === 1;
  const sectionTemplate = `${titleMatch[0]}${tableXml}`;
  const sectionBlocks = effectiveTomos.map((tomo, index) => {
    const title = isSingleTomo ? data.sectionTitle : `${data.sectionTitle} (${tomo.title})`;
    const tomoRows = getRowsForTomo(rows, tomo, isSingleTomo);
    const generatedRows = tomoRows.map((row) => buildTableRow(rowTemplate, row)).join("");
    const tableWithRows = baseTableXml.replace(insertionPoint, `${generatedRows}${insertionPoint}`);
    const section = `${titleMatch[0].replace("{{TITULO_SECAO}}", escapeXml(title))}${tableWithRows}`;
    const pageBreak = index === 0 ? "" : '<text:p text:style-name="LD_PageBreak"/>';

    return `${pageBreak}${section}`;
  });

  return addPageBreakStyle(contentXml.replace(sectionTemplate, sectionBlocks.join("")));
}

export async function generateOdtBuffer(payload: GeneratePayload) {
  const templateBuffer = await loadTemplateBuffer(payload.templateBase64);
  const zip = await JSZip.loadAsync(templateBuffer);
  const metaEntry = zip.file("meta.xml");
  const contentEntry = zip.file("content.xml");
  const stylesEntry = zip.file("styles.xml");

  if (!metaEntry || !contentEntry || !stylesEntry) {
    throw new Error("Template ODT inválido.");
  }

  const metaXml = await metaEntry.async("string");
  const contentXml = await contentEntry.async("string");
  const stylesXml = await stylesEntry.async("string");
  const sortedRows = [...payload.rows].sort((a, b) => {
    const sheetA = parseSheetNumber(a.sheet) ?? Number.MAX_SAFE_INTEGER;
    const sheetB = parseSheetNumber(b.sheet) ?? Number.MAX_SAFE_INTEGER;

    return sheetA - sheetB;
  });

  zip.file("meta.xml", updateMetaXml(metaXml, payload.ldData));
  zip.file("styles.xml", updateDisplayedProperties(stylesXml, payload.ldData));
  zip.file(
    "content.xml",
    buildContentXml(contentXml, payload.ldData, sortedRows, payload.tomos ?? []),
  );

  const output = await zip.generateAsync({
    type: "uint8array",
    mimeType: "application/vnd.oasis.opendocument.text",
  });

  return Buffer.from(output);
}

export function buildInconsistencyReport(payload: GeneratePayload) {
  const issues = payload.inconsistencies;

  if (!issues) {
    return "";
  }

  const hasIssues =
    issues.missingSheets.length > 0 ||
    issues.globalWarnings.length > 0 ||
    issues.rowWarnings.length > 0;

  if (!hasIssues) {
    return "";
  }

  const lines = [
    `# Inconsistências da LD ${buildBaseFileName(payload.ldData)}`,
    "",
    `Projeto: ${payload.ldData.projectCode}`,
    `Disciplina: ${payload.ldData.discipline}`,
    `Revisão: ${payload.ldData.revision}`,
    "",
  ];

  if (issues.missingSheets.length > 0) {
    lines.push("## Folhas faltantes", "", ...issues.missingSheets.map((sheet) => `- Folha ${sheet}`), "");
  }

  if (issues.globalWarnings.length > 0) {
    lines.push("## Alertas gerais", "", ...issues.globalWarnings.map((warning) => `- ${warning}`), "");
  }

  if (issues.rowWarnings.length > 0) {
    lines.push("## Alertas por linha", "");

    for (const row of issues.rowWarnings) {
      lines.push(`### ${row.sheet || "Sem folha"} | ${row.file || "Sem arquivo"}`);
      lines.push(...row.warnings.map((warning) => `- ${warning}`));
      lines.push(`- Revisado pelo usuário: ${row.reviewed ? "sim" : "não"}`, "");
    }
  }

  return lines.join("\n");
}
