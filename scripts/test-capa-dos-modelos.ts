/**
 * TODO MODELO DE CAPA DO SOFTWARE TEM DE SER LIDO PELO LEITOR.
 *
 * Para cada `templates/capas/<id>/modelo*.odt`: tira as linhas do `content.xml`,
 * preenche cada `{{CAMPO}}` com um valor de exemplo, passa por `lerCapa` e exige
 * os mesmos valores de volta. Um modelo novo que o leitor não entenda derruba
 * este teste — é assim que "todos os padrões de prefeitura" continua valendo.
 *
 *   node scripts/test-capa-dos-modelos.ts   (== npm run test:capa-dos-modelos)
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { lerCapa } from "../lib/leitura-da-capa.ts";

const RAIZ = "templates/capas";
const chave = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");

interface Config {
  id: string;
  nome: string;
  volumeFormat: string;
  defaults: { orgao: string; secretaria: string; fase: string };
  campos: string[];
}

function linhasDoOdt(xml: string): string[] {
  return xml
    .replace(/<text:line-break\/>/g, "\n")
    .replace(/<text:(?:tab|s)(?:\s[^>]*)?\/>/g, " ")
    .replace(/<\/text:(?:p|h)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .split("\n");
}

let passed = 0;
const ids = readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name);
assert.ok(ids.length > 0, "nenhum modelo em templates/capas");

for (const id of ids) {
  const config = JSON.parse(readFileSync(join(RAIZ, id, "config.json"), "utf8")) as Config;
  const odt = readdirSync(join(RAIZ, id)).find((f) => f.endsWith(".odt"));
  assert.ok(odt, `${id}: sem .odt`);
  const zip = await JSZip.loadAsync(readFileSync(join(RAIZ, id, odt)));
  const xml = await zip.file("content.xml")!.async("string");

  const valores: Record<string, string> = {
    ORGAO: config.defaults.orgao,
    SECRETARIA: config.defaults.secretaria,
    FASE: config.defaults.fase,
    NOME_OBRA: "OBRA DE PROVA DO MODELO",
    BAIRRO: "BAIRRO CENTRO",
    TITULO_CAPA: "MEMORIAL DESCRITIVO",
    TOMO: "",
    VOLUME: config.volumeFormat === "numeric" ? "1" : "I",
    MES_ANO: "SETEMBRO/2026",
    CODIGO_EXIBIDO: "999-26",
  };
  const linhas = linhasDoOdt(xml)
    .map((l) => l.replace(/\{\{(\w+)\}\}/g, (_, c: string) => valores[c] ?? ""))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l, i, todas) => l && l !== todas[i - 1]);
  const texto = `--- PAGINA 1 ---\n${linhas.join("\n")}\n\n--- PAGINA 2 ---\n`;

  const cidade = config.nome.replace(/^Prefeitura Municipal de /i, "");
  const capa = lerCapa(texto, [cidade]);
  try {
    assert.ok(capa, "o leitor não reconheceu a capa");
    assert.equal(capa.obra, "OBRA DE PROVA DO MODELO");
    assert.equal(chave(capa.municipio), chave(cidade));
    assert.equal(chave(capa.orgao), chave(`PREFEITURA MUNICIPAL DE ${cidade}`));
    assert.equal(capa.codigo, "999-26");
    assert.equal(capa.mesAno, "SETEMBRO/2026");
    if (config.campos.includes("BAIRRO")) assert.equal(capa.bairro, "BAIRRO CENTRO");
    if (config.campos.includes("SECRETARIA")) {
      assert.equal(capa.secretaria, config.defaults.secretaria);
    }
    passed++;
    console.log(`  ok  ${id}`);
  } catch (err) {
    console.error(`FALHOU  ${id}`);
    console.error(err instanceof Error ? err.message : err);
    console.error(texto);
    process.exitCode = 1;
  }
}

console.log(`\n${passed} de ${ids.length} modelo(s) de capa lidos`);
