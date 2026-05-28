import { escapeXml } from "@/lib/cover-utils";

export const MIMETYPE = "application/vnd.oasis.opendocument.text";

export const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
 <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
 <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
 <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

export function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
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
      <style:paragraph-properties fo:hyphenation-ladder-count="no-limit" style:text-autospace="ideograph-alpha" style:punctuation-wrap="hanging" style:line-break="strict" style:tab-stop-distance="1.25cm" style:writing-mode="page"/>
      <style:text-properties style:use-window-font-color="true" style:font-name="Arial" fo:font-size="12pt" fo:language="pt" fo:country="BR" style:letter-kerning="true"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
    <style:style style:name="CAPA_ORGAO" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="16pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="CAPA_SECRETARIA" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="14pt"/>
    </style:style>
    <style:style style:name="CAPA_OBRA" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="1cm" fo:margin-bottom="0.5cm"/>
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="CAPA_FASE" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="12pt"/>
    </style:style>
    <style:style style:name="CAPA_TITULO" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.5cm" fo:margin-bottom="0.3cm"/>
      <style:text-properties fo:font-size="12pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="CAPA_DISCIPLINA" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.1cm" fo:margin-bottom="0.1cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>
    <style:style style:name="CAPA_TOMO" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>
    <style:style style:name="CAPA_VOLUME" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>
    <style:style style:name="CAPA_MESANO" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.2cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="11pt"/>
    </style:style>
    <style:style style:name="CAPA_CODIGO" style:family="paragraph" style:parent-style-name="Standard">
      <style:paragraph-properties fo:text-align="center" fo:margin-top="0.5cm" fo:margin-bottom="0.2cm"/>
      <style:text-properties fo:font-size="10pt"/>
    </style:style>
  </office:styles>
</office:document-styles>`;
}

export function buildContentXml(
  orgao: string,
  secretaria: string,
  nomeObra: string,
  fase: string,
  mesAno: string,
  codigoExibido: string,
  pages: Array<{ tituloCapa: string; disciplina: string; tomo: string; volume: string }>
): string {
  const pageContents: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const lines: string[] = [];

    if (i > 0) {
      lines.push(
        `<text:p text:style-name="Standard" fo:break-before="page"/>`
      );
    }

    lines.push(
      `<text:p text:style-name="CAPA_ORGAO">${escapeXml(orgao)}</text:p>`
    );
    if (secretaria) {
      for (const line of secretaria.split("\n")) {
        if (line.trim()) {
          lines.push(
            `<text:p text:style-name="CAPA_SECRETARIA">${escapeXml(line.trim())}</text:p>`
          );
        }
      }
    }
    if (nomeObra) {
      for (const line of nomeObra.split("\n")) {
        if (line.trim()) {
          lines.push(
            `<text:p text:style-name="CAPA_OBRA">${escapeXml(line.trim())}</text:p>`
          );
        }
      }
    }
    if (fase) {
      for (const line of fase.split("\n")) {
        if (line.trim()) {
          lines.push(
            `<text:p text:style-name="CAPA_FASE">${escapeXml(line.trim())}</text:p>`
          );
        }
      }
    }
    if (page.tituloCapa) {
      for (const line of page.tituloCapa.split("\n")) {
        if (line.trim()) {
          lines.push(
            `<text:p text:style-name="CAPA_TITULO">${escapeXml(line.trim())}</text:p>`
          );
        }
      }
    }
    if (page.disciplina) {
      for (const line of page.disciplina.split("\n")) {
        if (line.trim()) {
          lines.push(
            `<text:p text:style-name="CAPA_DISCIPLINA">${escapeXml(line.trim())}</text:p>`
          );
        }
      }
    }
    if (page.tomo) {
      lines.push(
        `<text:p text:style-name="CAPA_TOMO">${escapeXml(page.tomo)}</text:p>`
      );
    }
    if (page.volume) {
      lines.push(
        `<text:p text:style-name="CAPA_VOLUME">${escapeXml(page.volume)}</text:p>`
      );
    }
    if (mesAno) {
      lines.push(
        `<text:p text:style-name="CAPA_MESANO">${escapeXml(mesAno)}</text:p>`
      );
    }
    if (codigoExibido) {
      lines.push(
        `<text:p text:style-name="CAPA_CODIGO">${escapeXml(codigoExibido)}</text:p>`
      );
    }

    pageContents.push(lines.join("\n"));
  }

  const bodyContent = pageContents.join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
  xmlns:chart="urn:oasis:names:tc:opendocument:xmlns:chart:1.0"
  xmlns:dr3d="urn:oasis:names:tc:opendocument:xmlns:dr3d:1.0"
  xmlns:math="http://www.w3.org/1998/Math/MathML"
  xmlns:form="urn:oasis:names:tc:opendocument:xmlns:form:1.0"
  xmlns:script="urn:oasis:names:tc:opendocument:xmlns:script:1.0"
  xmlns:dom="http://www.w3.org/2001/xml-events"
  xmlns:xforms="http://www.w3.org/2002/xforms"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  office:version="1.2">
  <office:body>
    <office:text>
${bodyContent}
    </office:text>
  </office:body>
</office:document-content>`;
}

export function buildMetaXml(nomeObra: string, orgao: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  office:version="1.2">
  <office:meta>
    <meta:creation-date>${now}</meta:creation-date>
    <dc:date>${now}</dc:date>
    <meta:generator>NexoDoc - Gerador de Capas</meta:generator>
    <dc:title>${escapeXml(nomeObra)}</dc:title>
    <dc:creator>${escapeXml(orgao)}</dc:creator>
  </office:meta>
</office:document-meta>`;
}
