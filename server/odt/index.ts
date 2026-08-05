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

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    let block = templateBody.innerXml;

    for (const [marker, value] of Object.entries(replacements)) {
      block = distribuirNosMarcadores(block, marker, value);
    }

    block = distribuirNosMarcadores(block, "{{TITULO_CAPA}}", page.tituloCapa);
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

/**
 * O MARCADOR REPETIDO DIVIDE O VALOR EM LINHAS.
 *
 * Um campo que sai em várias linhas — o nome da obra, o título com as
 * disciplinas — pode aparecer mais de uma vez no modelo, cada ocorrência num
 * parágrafo seu. É assim que o padrão da empresa desenha a capa: a 1ª linha do
 * nome da obra num parágrafo, a 2ª no seguinte, o bairro logo abaixo.
 *
 * Com `replaceAll`, os dois parágrafos recebiam o nome INTEIRO e a obra saía
 * duplicada na capa. Aqui cada ocorrência recebe a sua linha, e a ÚLTIMA recebe
 * o que sobrar — assim nada é perdido quando o texto tem mais linhas do que o
 * modelo previu. Ocorrência sem linha correspondente fica vazia, que é o
 * parágrafo em branco que o modelo já desenhava.
 *
 * Com UMA ocorrência o comportamento é o de sempre: o valor inteiro, com as
 * quebras viram `<text:line-break/>`.
 *
 * Substituiu duas funções específicas de Criciúma que fixavam NOMES DE ESTILO
 * ("P9", "P13") no código. Nome de estilo é numeração interna do LibreOffice:
 * ele renumera ao salvar, e o "P9" que era alinhado à direita passou a ser
 * centralizado no modelo novo — o código escreveria no estilo errado sem que
 * nada acusasse. Herdar o estilo do parágrafo do modelo não tem esse problema.
 */
function distribuirNosMarcadores(
  block: string,
  marcador: string,
  valor: string,
): string {
  const partes = block.split(marcador);
  const quantos = partes.length - 1;
  if (quantos <= 0) return block;
  if (quantos === 1) return block.replaceAll(marcador, markerXmlValue(valor));

  const linhas = valor
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let saida = partes[0];
  for (let i = 0; i < quantos; i++) {
    const conteudo =
      i === quantos - 1 ? linhas.slice(i).join("\n") : (linhas[i] ?? "");
    saida += markerXmlValue(conteudo) + partes[i + 1];
  }
  return saida;
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
