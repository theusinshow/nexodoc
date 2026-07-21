import JSZip from "jszip";
import { MIMETYPE, MANIFEST_XML, buildMetaXml } from "../lib/template-odt";
import { escapeXml } from "@/lib/cover-utils";

/**
 * Gera um ODT de "folhas separatrizes": uma pagina quase em branco por
 * disciplina, com o nome da disciplina em negrito na metade inferior da folha.
 * Sem timbre — funciona igual para qualquer prefeitura. O padrao segue o
 * anexo do usuario (folha de rosto de disciplina dentro do volume).
 *
 * Cada titulo vai dentro de um quadro (draw:frame) ancorado a pagina, em
 * posicao absoluta. Isso posiciona o texto de forma confiavel na mesma altura
 * em todas as paginas — margem superior de paragrafo e ignorada pelo LibreOffice
 * no topo da pagina (apos quebra), entao nao da para depender dela.
 */
export async function generateSeparatorOdtBuffer(titles: string[]): Promise<Buffer> {
  const clean = titles.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) {
    throw new Error("Nenhuma disciplina informada para gerar as separatrizes.");
  }

  const zip = new JSZip();
  zip.file("mimetype", MIMETYPE, { compression: "STORE" });
  zip.file("content.xml", buildSeparatorContentXml(clean));
  zip.file("styles.xml", buildSeparatorStylesXml());
  zip.file("meta.xml", buildMetaXml("Folhas Separatrizes", ""));
  zip.file("META-INF/manifest.xml", MANIFEST_XML);

  const arrayBuffer = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
  });
  return Buffer.from(arrayBuffer);
}

function buildSeparatorStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:page-layout style:name="pm1">
      <style:page-layout-properties fo:page-width="21.00cm" fo:page-height="29.70cm" style:print-orientation="portrait" fo:margin-top="2.5cm" fo:margin-bottom="2.5cm" fo:margin-left="3cm" fo:margin-right="2cm"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="pm1"/>
  </office:master-styles>
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:text-properties style:font-name="Arial" fo:font-size="12pt" fo:language="pt" fo:country="BR"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
    <style:style style:name="SEP_TITULO" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="end"/>
      <style:text-properties fo:font-size="18pt" fo:font-weight="bold"/>
    </style:style>
  </office:styles>
</office:document-styles>`;
}

function buildSeparatorContentXml(titles: string[]): string {
  const pages: string[] = [];

  for (let i = 0; i < titles.length; i++) {
    // Paragrafo hospedeiro: a partir da 2a folha, carrega a quebra de pagina
    // (estilo automatico P_BREAK). O texto real fica no quadro ancorado.
    const paraStyle = i === 0 ? "Standard" : "P_BREAK";
    pages.push(
      `<text:p text:style-name="${paraStyle}">` +
        `<draw:frame draw:style-name="FR_SEP" draw:name="sep${i + 1}" ` +
        `text:anchor-type="page" text:anchor-page-number="${i + 1}" ` +
        `svg:x="3cm" svg:y="16cm" svg:width="16cm" svg:height="3cm" draw:z-index="0">` +
        `<draw:text-box>` +
        `<text:p text:style-name="SEP_TITULO">${escapeXml(titles[i])}</text:p>` +
        `</draw:text-box>` +
        `</draw:frame>` +
        `</text:p>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="P_BREAK" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:break-before="page"/>
    </style:style>
    <style:style style:name="FR_SEP" style:family="graphic">
      <style:graphic-properties style:vertical-pos="from-top" style:vertical-rel="page" style:horizontal-pos="from-left" style:horizontal-rel="page" draw:auto-grow-height="true" fo:min-height="1cm" style:wrap="none" draw:fill="none" draw:stroke="none"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
${pages.join("\n")}
    </office:text>
  </office:body>
</office:document-content>`;
}
