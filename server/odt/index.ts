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
// A regra do marcador vive num módulo PURO para poder ser testada em node cru:
// este arquivo importa por alias `@/`, que o node pelado não resolve.
import { desembrulharCamposDeUsuario, distribuirNosMarcadores } from "./marcadores";

export interface GenerateOdtInput {
  templateId?: string;
  generalData: GeneralData;
  pages: CoverPage[];
  /**
   * Marcadores que o MODELO tem e o Nexo não conhece, chaveados pelo nome sem
   * as chaves (`RESPONSAVEL`, não `{{RESPONSAVEL}}`).
   *
   * O modelo é de quem o mantém: acrescentar um `{{RESPONSAVEL}}` ao ODT tem de
   * bastar. Sem este canal o marcador novo sairia LITERAL na capa — e o frame
   * teria oferecido um campo que não vai a lugar nenhum, o que é pior do que
   * não oferecer.
   */
  extras?: Record<string, string>;
}

export async function generateOdtBuffer(input: GenerateOdtInput): Promise<Buffer> {
  const { templateId, generalData, pages, extras } = input;

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
      pages,
      extras ?? {}
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
  pages: CoverPage[],
  extras: Record<string, string>
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(templateBuffer);

  const contentXmlFile = zip.file("content.xml");
  if (!contentXmlFile) {
    throw new Error("Template ODT invalido: content.xml nao encontrado");
  }

  /*
   * O TEMPLATE MANDA, INTEIRO.
   *
   * Havia aqui um `tuneCriciumaTemplateXml` que remendava o XML do modelo em
   * tempo de execução por casamento EXATO de string: apagava dois parágrafos
   * vazios e trocava 25pt por 16pt. Isso torna o arquivo que se abre no
   * LibreOffice diferente do que sai impresso — e, pior, o remendo vira no-op
   * SILENCIOSO assim que alguém salva o modelo (o LibreOffice reescreve o XML,
   * renumera estilos e a string deixa de casar). Foi o que aconteceu: o modelo
   * novo de Criciúma já traz 16pt e não tem mais o estilo que o remendo
   * procurava, então ele não fazia nada havia tempo.
   *
   * Agora o que se vê no modelo é o que sai. Ajuste de layout se faz no ODT.
   */
  const contentXml = await contentXmlFile.async("string");
  const templateBody = extractOfficeText(contentXml);

  const replacements: Record<string, string> = {
    "{{ORGAO}}": generalData.orgao,
    "{{SECRETARIA}}": generalData.secretaria,
    "{{NOME_OBRA}}": generalData.nomeObra,
    "{{FASE}}": generalData.fase,
    /*
     * BAIRRO — subtítulo da obra, entre o nome e o volume.
     *
     * Opcional como `{{ORGAO}}` e `{{SECRETARIA}}`: o template que não tiver o
     * marcador simplesmente não o usa, e o template que tiver com o campo vazio
     * imprime linha em branco em vez de "{{BAIRRO}}" — que é o que aconteceria
     * se o marcador não estivesse nesta tabela.
     */
    "{{BAIRRO}}": generalData.bairro ?? "",
    "{{MES_ANO}}": mesAno,
    "{{CODIGO_EXIBIDO}}": codigoExibido,
  };

  const pageBlocks: string[] = [];

  /*
   * Os marcadores que o LibreOffice transformou em CAMPO voltam a ser texto
   * antes de qualquer substituição — senão o `text:name` conta como uma segunda
   * ocorrência do marcador e o parágrafo é colapsado. Uma vez só, fora do laço:
   * o corpo é o mesmo para todas as páginas.
   */
  const corpoDoModelo = desembrulharCamposDeUsuario(templateBody.innerXml);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let block = corpoDoModelo;

    for (const [marker, value] of Object.entries(replacements)) {
      block = distribuirNosMarcadores(block, marker, value, markerXmlValue);
    }

    block = distribuirNosMarcadores(
      block,
      "{{TITULO_CAPA}}",
      page.tituloCapa,
      markerXmlValue,
    );

    /*
     * MARCADORES QUE O MODELO TEM E O NEXO NÃO CONHECE.
     *
     * Vêm DEPOIS dos conhecidos, para nunca sobrescrever um deles por engano.
     * Sem este canal, um `{{RESPONSAVEL}}` acrescentado ao ODT seria impresso
     * literal na capa.
     */
    for (const [nome, valor] of Object.entries(extras)) {
      block = distribuirNosMarcadores(block, `{{${nome}}}`, valor, markerXmlValue);
    }
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
