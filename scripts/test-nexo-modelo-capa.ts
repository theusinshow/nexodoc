/**
 * IDA E VOLTA do modelo de capa anexado, nos 4 modelos do repositório.
 *
 * Para cada modelo M: preenche com os dados A → capa C (o que o engenheiro
 * anexaria). Lê C, classifica por regras, responde os pendentes com um ORÁCULO
 * (linha de título → TITULO_CAPA, o resto → FIXO: testa a fiação, não a IA),
 * injeta → modelo M'. Então:
 *   1. M' preenchido com A dá o MESMO texto que C;
 *   2. M' preenchido com B (outra obra, outro tomo, outra data) dá o mesmo
 *      texto que M preenchido com B — prova que os campos são campos de verdade.
 *
 *   node scripts/test-nexo-modelo-capa.ts   (== npm run test:nexo:modelo-capa)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";

import {
  desembrulharCamposDeUsuario,
  preencherCorpo,
  type ValoresDaPagina,
} from "../server/odt/marcadores.ts";
import { lerParagrafos } from "../server/nexo/modelo-capa/paragrafos.ts";
import {
  aplicarRespostas,
  classificarPorRegras,
  pendentes,
} from "../server/nexo/modelo-capa/regras.ts";
import { injetarMarcadores } from "../server/nexo/modelo-capa/injetar.ts";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const escapar = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<text:line-break/>");

const ROOT = "templates/capas";
const MODELOS = ["prefchap", "pmcriciuma", "prefflor", "prefsjose"];

interface Dados {
  obra: string;
  bairro: string;
  titulo: string;
  mesAno: string;
  codigo: string;
}
const A: Dados = {
  obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL\nDE CHAPECÓ",
  bairro: "CENTRO",
  titulo: "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO",
  mesAno: "JUNHO/2026",
  codigo: "040-26",
};
const B: Dados = {
  obra: "CENTRO DE EVENTOS\nARENA BELVEDERE",
  bairro: "BELVEDERE",
  titulo: "PROJETO HIDROSSANITÁRIO\nREDE DE ESGOTO",
  mesAno: "OUTUBRO/2026",
  codigo: "117-25",
};

interface Config {
  arquivoTemplate: string;
  tomoFormat?: string;
  volumeFormat?: string;
  defaults: { orgao: string; secretaria: string; fase: string };
}

function abertura(xml: string) {
  const a = /<office:text\b[^>]*>/.exec(xml)!;
  return { depois: a.index + a[0].length, fim: xml.indexOf("</office:text>") };
}
function preencher(xml: string, v: ValoresDaPagina): string {
  const { depois, fim } = abertura(xml);
  return xml.slice(0, depois) + preencherCorpo(xml.slice(depois, fim), v, escapar) + xml.slice(fim);
}

async function carregar(id: string) {
  const cfg = JSON.parse(readFileSync(`${ROOT}/${id}/config.json`, "utf8")) as Config;
  const zip = await JSZip.loadAsync(readFileSync(`${ROOT}/${id}/${cfg.arquivoTemplate}`));
  const xml = desembrulharCamposDeUsuario(await zip.file("content.xml")!.async("string"));
  return { cfg, xml };
}

function tomoNoFormato(formato: string | undefined, n: number): string {
  const p = String(n).padStart(2, "0");
  if (formato === "plain") return `TOMO ${n}`;
  if (formato === "plain-padded") return `TOMO ${p}`;
  if (formato === "parenthesized") return `(TOMO ${n})`;
  return `(TOMO ${p})`;
}

function valores(cfg: Config, d: Dados, tomo: string, volume: string): ValoresDaPagina {
  return {
    gerais: {
      "{{ORGAO}}": cfg.defaults.orgao,
      "{{SECRETARIA}}": cfg.defaults.secretaria,
      "{{NOME_OBRA}}": d.obra,
      "{{FASE}}": cfg.defaults.fase,
      "{{BAIRRO}}": d.bairro,
      "{{MES_ANO}}": d.mesAno,
      "{{CODIGO_EXIBIDO}}": d.codigo,
    },
    tituloCapa: d.titulo,
    extras: {},
    disciplina: "",
    tomo,
    volume,
  };
}

const textos = (xml: string) => lerParagrafos(xml).map((p) => p.texto);

for (const id of MODELOS) {
  await test(`${id}: ida e volta preserva a capa e os campos`, async () => {
    const { cfg, xml } = await carregar(id);
    const numerico = cfg.volumeFormat === "numeric";
    const tomoA = tomoNoFormato(cfg.tomoFormat, 2);
    const volA = numerico ? "05" : "VII";
    const capaA = preencher(xml, valores(cfg, A, tomoA, volA));

    const paragrafosC = lerParagrafos(capaA);
    let proposta = classificarPorRegras(paragrafosC, {
      obra: A.obra.replace(/\n/g, " "),
      bairro: A.bairro,
      orgaos: [cfg.defaults.orgao],
      secretarias: [cfg.defaults.secretaria],
    });
    const faltam = pendentes(proposta);
    const linhasDoTitulo = A.titulo.split("\n");
    proposta = aplicarRespostas(
      proposta,
      faltam.map((p) => ({
        indice: p.indice,
        campo: linhasDoTitulo.includes(p.texto) ? ("TITULO_CAPA" as const) : ("FIXO" as const),
      })),
      "ia",
    );
    assert.equal(proposta.tomoFormat, cfg.tomoFormat ?? "plain-padded", "formato do tomo");
    assert.equal(proposta.volumeFormat, cfg.volumeFormat ?? "roman", "formato do volume");

    const modeloNovo = injetarMarcadores(capaA, proposta);

    // 1. mesmo texto com os mesmos dados
    assert.deepEqual(textos(preencher(modeloNovo, valores(cfg, A, tomoA, volA))), textos(capaA));

    // 2. outros dados: o modelo novo imprime o que o original imprimiria
    const tomoB = tomoNoFormato(cfg.tomoFormat, 3);
    const volB = numerico ? "08" : "IX";
    assert.deepEqual(
      textos(preencher(modeloNovo, valores(cfg, B, tomoB, volB))),
      textos(preencher(xml, valores(cfg, B, tomoB, volB))),
    );

    // a IA só viu o que as regras não reconhecem — nunca código, data, tomo, volume
    for (const p of faltam) {
      assert.ok(!/^\d{3}[-_]\d{2}$|TOMO|^VOL/i.test(p.texto), `foi para a IA: ${p.texto}`);
    }
  });
}

await test("injeção: parágrafo FIXO fica byte a byte, o campo herda o span", () => {
  const xml =
    '<office:body><office:text><text:p text:style-name="P1">ESTADO DE SANTA CATARINA</text:p>' +
    '<text:p text:style-name="P2"><text:span text:style-name="T1">040-26</text:span></text:p>' +
    "</office:text></office:body>";
  const proposta = classificarPorRegras(lerParagrafos(xml), { orgaos: [], secretarias: [] });
  const saida = injetarMarcadores(xml, proposta);
  assert.match(saida, /<text:p text:style-name="P1">ESTADO DE SANTA CATARINA<\/text:p>/);
  assert.match(saida, /<text:span text:style-name="T1">\{\{CODIGO_EXIBIDO\}\}<\/text:span>/);
});

await test("injeção: spans ANINHADOS ficam todos (o T3 de Chapecó corrige a fonte do de fora)", () => {
  const xml =
    '<office:body><office:text><text:p text:style-name="P9"><text:span text:style-name="Source_20_Text">' +
    '<text:span text:style-name="T3">PROJETO EXECUTIVO</text:span></text:span></text:p></office:text></office:body>';
  const saida = injetarMarcadores(xml, classificarPorRegras(lerParagrafos(xml), { orgaos: [], secretarias: [] }));
  assert.match(
    saida,
    /<text:p text:style-name="P9"><text:span text:style-name="Source_20_Text"><text:span text:style-name="T3">\{\{FASE\}\}<\/text:span><\/text:span><\/text:p>/,
  );
});

await test("injeção: ida e volta preserva os estilos de cada parágrafo de campo (4 modelos)", async () => {
  for (const id of MODELOS) {
    const { cfg, xml } = await carregar(id);
    const capa = preencher(xml, valores(cfg, A, tomoNoFormato(cfg.tomoFormat, 2), cfg.volumeFormat === "numeric" ? "05" : "VII"));
    const p = classificarPorRegras(lerParagrafos(capa), {
      obra: A.obra.replace(/\n/g, " "),
      bairro: A.bairro,
      orgaos: [cfg.defaults.orgao],
      secretarias: [cfg.defaults.secretaria],
    });
    const modelo = injetarMarcadores(capa, p);
    // Os estilos de span que a capa usava continuam todos no modelo — menos os
    // que só carregam `officeooo:rsid` (marca de revisão do LibreOffice, sem
    // efeito na impressão).
    const soRevisao = (nome: string) => {
      const def = new RegExp(`<style:style style:name="${nome}"[^>]*>([\\s\\S]*?)</style:style>`).exec(capa)?.[1] ?? "";
      return /^<style:text-properties officeooo:rsid="[^"]+"\/>$/.test(def.trim());
    };
    const estilos = (x: string) => new Set([...x.matchAll(/<text:span text:style-name="([^"]+)"/g)].map((m) => m[1]));
    for (const e of estilos(capa)) {
      if (!soRevisao(e)) assert.ok(estilos(modelo).has(e), `${id}: perdeu o estilo ${e}`);
    }
  }
});

await test("regras: Vol. VII mantém o rótulo fixo", () => {
  const p = classificarPorRegras([{ indice: 0, texto: "Vol. VII" }], { orgaos: [], secretarias: [] });
  assert.deepEqual(p.paragrafos[0].trechos, [
    { texto: "Vol. ", campo: "FIXO" },
    { texto: "VII", campo: "VOLUME" },
  ]);
  assert.equal(p.volumeFormat, "roman");
});

await test("aplicarRespostas: índice alucinado não marca nada", () => {
  const base = classificarPorRegras([{ indice: 3, texto: "QUALQUER" }], { orgaos: [], secretarias: [] });
  const r = aplicarRespostas(base, [{ indice: 99, campo: "NOME_OBRA" }], "ia");
  assert.equal(r.paragrafos[0].trechos, null);
});

await test("aplicarRespostas: a IA não sobrescreve a regra, a pessoa sim", () => {
  const base = classificarPorRegras([{ indice: 0, texto: "040-26" }], { orgaos: [], secretarias: [] });
  assert.equal(aplicarRespostas(base, [{ indice: 0, campo: "FIXO" }], "ia").paragrafos[0].trechos![0].campo, "CODIGO_EXIBIDO");
  assert.equal(aplicarRespostas(base, [{ indice: 0, campo: "FIXO" }], "pessoa").paragrafos[0].trechos![0].campo, "FIXO");
});

console.log(`\n${passed} teste(s) ok.`);
