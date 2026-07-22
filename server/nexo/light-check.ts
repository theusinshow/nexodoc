import {
  parseFilename,
  sheetNumberFromFilename,
  sheetNumberFromSelo,
  resolveSheetNumbers,
} from "./parse-filename";
import type { SeloForLd } from "./build-ld-proposal";
import { checkSeloFacts, type SeloFact, type LightCheckResult } from "./light-check-core";

/**
 * Conferência leve (light check) do Nexo — porta de qualidade DETERMINÍSTICA,
 * SEM memorial e SEM IA/LLM. Confere se as pranchas (selos) são internamente
 * consistentes, pegando a classe de erro que motivou o projeto: um projeto
 * emitido com o nome/código de OUTRA obra, ou folhas faltando/duplicadas.
 *
 * FONTE ÚNICA: o parsing do nome (código/folha/revisão/disciplina) vem de
 * `parse-filename.ts` — as mesmas regras da geração da LD/capa. A comparação pura
 * fica em `light-check-core.ts` (sem imports, testável com node cru).
 */

export type {
  LightCheckSeverity,
  LightCheckFinding,
  LightCheckVeredito,
  LightCheckResult,
  SeloFact,
} from "./light-check-core";
export { checkSeloFacts } from "./light-check-core";

/** Todos os números (>0) que um selo carrega — base para o total de referência. */
function seloNumbers(s: SeloForLd): number[] {
  const out: number[] = [];
  if (typeof s.total === "number") out.push(s.total);
  if (typeof s.folha === "number") out.push(s.folha);
  const fromArquivo = s.arquivo ? sheetNumberFromFilename(s.arquivo) : null;
  if (fromArquivo != null) out.push(fromArquivo);
  const fromName = sheetNumberFromFilename(s.fileName);
  if (fromName != null) out.push(fromName);
  if (s.numeroFolha) {
    for (const m of s.numeroFolha.matchAll(/\d+/g)) out.push(parseInt(m[0], 10));
  }
  return out.filter((n) => Number.isFinite(n) && n > 0);
}

/**
 * Converte um selo lido em fato parseado, usando as MESMAS regras de nome da
 * geração (parse-filename). A folha vem do nome (autoritativa); o campo `folha`
 * do OCR só entra na falta.
 */
export function seloToFact(s: SeloForLd): SeloFact {
  // Prefere o código do CARIMBO (arquivo, per-prancha) — num PDF combinado o
  // nome do upload é o do tomo/volume e não carrega revisão/folha por prancha.
  const parsed = parseFilename(s.arquivo?.trim() || s.fileName);
  const sheet = sheetNumberFromSelo({
    arquivo: s.arquivo,
    fileName: s.fileName,
    folha: s.folha,
  });
  return {
    label: s.fileName || s.arquivo || "(sem nome)",
    codigo: parsed.codigo,
    obra: s.obra?.trim() ?? "",
    revisao: parsed.revisao,
    disciplinas: parsed.disciplinas,
    sheet,
    totalLido: typeof s.total === "number" ? s.total : null,
    numeros: seloNumbers(s),
  };
}

/**
 * Roda a conferência leve sobre os selos lidos das pranchas de UMA disciplina.
 * Determinístico, sem IA. Parseia os nomes (fonte única) e delega à checagem pura.
 */
export function runLightCheck(
  selos: SeloForLd[],
  opts: { templateId?: string } = {},
): LightCheckResult {
  // Reservado para checagens template-aware futuras (órgão/prefeitura da capa).
  void opts;
  const validos = selos.filter((s) => s.fileName || s.arquivo);
  // Folha RESOLVIDA (reconciliação por ordem de página) sobrescreve a do fato.
  const resolved = resolveSheetNumbers(validos);
  const facts = validos.map((s, i) => ({ ...seloToFact(s), sheet: resolved[i] }));
  return checkSeloFacts(facts);
}
