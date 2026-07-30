/**
 * De QUE disciplina é esta folha — a pergunta que decide em que bloco do volume
 * ela entra (`blocos.ts`).
 *
 * É só a AMARRAÇÃO: o léxico do escritório e o parser de nome de arquivo, dados
 * à regra pura de `blocos.ts`. A regra mora lá porque lá ela é testável com
 * node cru; este módulo não é, porque o parser importa por caminho sem extensão.
 */

import { DISCIPLINA_LEXICON } from "@/server/nexo/disciplinas";
import { parseFilename } from "@/server/nexo/parse-filename";
import { escolherCodigo, tabelasDoLexico } from "./blocos";
import type { Folha } from "./folhas";

const TABELAS = tabelasDoLexico(DISCIPLINA_LEXICON);

/** Rótulo de exibição do código ("dre" → "Drenagem"). */
export function rotuloDoCodigo(codigo: string): string {
  return DISCIPLINA_LEXICON[codigo.trim().toLowerCase()] ?? "";
}

/**
 * Disciplinas lidas do nome do arquivo, canonizadas. Memorizado por nome: o
 * canvas repete a pergunta a cada render, e um projeto tem 200+ folhas.
 */
const porArquivo = new Map<string, string[]>();
function doNomeDoArquivo(fileName: string): string[] {
  const guardado = porArquivo.get(fileName);
  if (guardado) return guardado;
  const codigos = parseFilename(fileName).disciplinas.map(
    (c) => TABELAS.canonico.get(c) ?? c,
  );
  porArquivo.set(fileName, codigos);
  return codigos;
}

/** O código da disciplina desta folha, ou "" quando não deu para saber. */
export function codigoDaFolha(folha: Folha): string {
  return escolherCodigo(
    {
      manual: folha.disciplinaManual ? (folha.disciplina ?? "") : "",
      doNome: doNomeDoArquivo(folha.fileName),
      doCarimbo: folha.disciplina ?? "",
    },
    TABELAS,
  );
}
