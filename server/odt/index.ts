import JSZip from "jszip";
import { readFile } from "fs/promises";
import {
  MIMETYPE,
  MANIFEST_XML,
  buildStylesXml,
  buildContentXml,
  buildMetaXml,
} from "../lib/template-odt";
import { escapeXml, formatMesAno, formatDisplayCode } from "@/lib/cover-utils";
import type { GeneralData, CoverPage } from "@/modules/cover-generator/types";
import { getTemplateOdtPath } from "@/server/templates/registry";

const CRICIUMA_TEMPLATE_ID = "pmcriciuma";

export interface GenerateOdtInput {
  templateId?: string;
  generalData: GeneralData;
  pages: CoverPage[];
}

export async function generateOdtBuffer(input: GenerateOdtInput): Promise<Buffer> {
  const { templateId, generalData, pages } = input;

  const mesAno = formatMesAno(generalData.mes, generalData.ano);
  const codigoExibido = generalData.codigoExibido || formatDisplayCode(generalData.codigoInterno);

  const templateOdtPath = templateId ? await getTemplateOdtPath(templateId) : null;

  if (templateOdtPath) {
    const odtBuffer = await readFile(templateOdtPath);
    return await fillExistingOdt(
      templateId ?? "",
      odtBuffer,
      generalData,
      mesAno,
      codigoExibido,
      pages
    );
  }

  return await generateDefaultOdt(
    generalData,
    pages,
    mesAno,
    codigoExibido
  );
}

async function generateDefaultOdt(
  generalData: GeneralData,
  pages: CoverPage[],
  mesAno: string,
  codigoExibido: string
): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("mimetype", MIMETYPE, { compression: "STORE" });

  zip.file(
    "content.xml",
    buildContentXml(
      generalData.orgao,
      generalData.secretaria,
      generalData.nomeObra,
      generalData.fase,
      mesAno,
      codigoExibido,
      pages.map((p) => ({
        tituloCapa: p.tituloCapa,
        disciplina: p.disciplina,
        tomo: p.tomo,
        volume: p.volume,
      }))
    )
  );

  zip.file("styles.xml", buildStylesXml());
  zip.file("meta.xml", buildMetaXml(generalData.nomeObra, generalData.orgao));
  zip.file("META-INF/manifest.xml", MANIFEST_XML);

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return Buffer.from(arrayBuffer);
}

async function fillExistingOdt(
  templateId: string,
  templateBuffer: Buffer,
  generalData: GeneralData,
  mesAno: string,
  codigoExibido: string,
  pages: CoverPage[]
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);

  const contentXmlFile = zip.file("content.xml");
  if (!contentXmlFile) {
    throw new Error("Template ODT invalido: content.xml nao encontrado");
  }

  let contentXml = await contentXmlFile.async("string");
  if (templateId === CRICIUMA_TEMPLATE_ID) {
    contentXml = tuneCriciumaTemplateXml(contentXml);
  }
  const templateBody = extractOfficeText(contentXml);

  const replacements: Record<string, string> = {
    "{{ORGAO}}": generalData.orgao,
    "{{SECRETARIA}}": generalData.secretaria,
    "{{NOME_OBRA}}": generalData.nomeObra,
    "{{FASE}}": generalData.fase,
    "{{MES_ANO}}": mesAno,
    "{{CODIGO_EXIBIDO}}": codigoExibido,
  };

  const pageBlocks: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let block = templateBody.innerXml;

    for (const [marker, value] of Object.entries(replacements)) {
      if (templateId === CRICIUMA_TEMPLATE_ID && marker === "{{NOME_OBRA}}") {
        block = block.replaceAll(marker, criciumaProjectNameXmlValue(value));
      } else {
        block = block.replaceAll(marker, markerXmlValue(value));
      }
    }

    block = replaceTitleMarkers(block, page.tituloCapa, templateId);
    block = block.replaceAll("{{DISCIPLINA}}", markerXmlValue(page.disciplina));
    block = block.replaceAll("{{TOMO}}", markerXmlValue(page.tomo));
    block = block.replaceAll("{{VOLUME}}", markerXmlValue(page.volume));

    if (i > 0) {
      block = `<text:p text:style-name="Standard" fo:break-before="page"/>\n${block}`;
    }

    pageBlocks.push(block);
  }

  const finalXml =
    contentXml.slice(0, templateBody.start) +
    pageBlocks.join("\n") +
    contentXml.slice(templateBody.end);

  zip.file("content.xml", finalXml);

  if (zip.file("meta.xml")) {
    let metaXml = await zip.file("meta.xml")!.async("string");
    metaXml = metaXml.replace(
      /<dc:title>[^<]*<\/dc:title>/,
      `<dc:title>${escapeXml(generalData.nomeObra)}</dc:title>`
    );
    metaXml = metaXml.replace(
      /<dc:creator>[^<]*<\/dc:creator>/,
      `<dc:creator>${escapeXml(generalData.orgao)}</dc:creator>`
    );
    const now = new Date().toISOString();
    metaXml = metaXml.replace(
      /<meta:creation-date>[^<]*<\/meta:creation-date>/,
      `<meta:creation-date>${now}</meta:creation-date>`
    );
    metaXml = metaXml.replace(
      /<dc:date>[^<]*<\/dc:date>/,
      `<dc:date>${now}</dc:date>`
    );
    metaXml = metaXml.replace(
      /<meta:generator>[^<]*<\/meta:generator>/,
      "<meta:generator>NexoDoc - Gerador de Capas</meta:generator>"
    );
    zip.file("meta.xml", metaXml);
  }

  const arrayBuffer = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return Buffer.from(arrayBuffer);
}

function markerXmlValue(value: string): string {
  return escapeXml(value).replace(/\n/g, "<text:line-break/>");
}

function replaceTitleMarkers(block: string, value: string, templateId: string): string {
  if (templateId !== CRICIUMA_TEMPLATE_ID) {
    return block.replaceAll("{{TITULO_CAPA}}", markerXmlValue(value));
  }

  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const volumeTitle = lines[0] ?? "";
  const detailTitle = lines.slice(1).join("\n");

  return block
    .replace("{{TITULO_CAPA}}", markerXmlValue(volumeTitle))
    .replaceAll("{{TITULO_CAPA}}", paragraphXmlValue(detailTitle, "P9"));
}

function criciumaProjectNameXmlValue(value: string): string {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return markerXmlValue(lines[0] ?? "");
  }

  return `${escapeXml(lines[0])}</text:p>${lines
    .slice(1)
    .map((line) => `<text:p text:style-name="P13">${escapeXml(line)}</text:p>`)
    .join("")}<text:p text:style-name="P7">`;
}

function paragraphXmlValue(value: string, styleName: string): string {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  return lines
    .map((line, index) =>
      index === 0
        ? escapeXml(line)
        : `</text:p><text:p text:style-name="${styleName}">${escapeXml(line)}`
    )
    .join("");
}

function tuneCriciumaTemplateXml(contentXml: string): string {
  return contentXml
    .replace(
      "{{NOME_OBRA}}</text:p><text:p text:style-name=\"P7\"/><text:p text:style-name=\"P7\"/><text:p text:style-name=\"P7\"/><text:p text:style-name=\"P7\"/>",
      "{{NOME_OBRA}}</text:p><text:p text:style-name=\"P7\"/><text:p text:style-name=\"P7\"/>"
    )
    .replaceAll('fo:font-size="25pt"', 'fo:font-size="16pt"')
    .replaceAll('style:font-size-asian="25pt"', 'style:font-size-asian="16pt"')
    .replaceAll('style:font-size-complex="25pt"', 'style:font-size-complex="16pt"');
}

function extractOfficeText(contentXml: string): {
  innerXml: string;
  start: number;
  end: number;
} {
  const openTagMatch = contentXml.match(/<office:text\b[^>]*>/);
  const closeTag = "</office:text>";

  if (!openTagMatch || openTagMatch.index === undefined) {
    throw new Error("Template ODT invalido: office:text nao encontrado");
  }

  const start = openTagMatch.index + openTagMatch[0].length;
  const end = contentXml.indexOf(closeTag, start);

  if (end === -1) {
    throw new Error("Template ODT invalido: fechamento office:text nao encontrado");
  }

  return {
    innerXml: contentXml.slice(start, end),
    start,
    end,
  };
}
