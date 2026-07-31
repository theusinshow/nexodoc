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

export interface LightCheckOptions {
  /** Reservado para checagens template-aware (órgão/prefeitura da capa). */
  templateId?: string;
  /**
   * O BLOCO de cada selo — código da disciplina, na MESMA ordem de `selos`.
   *
   * Vem do CLIENTE de propósito. Quem sabe a disciplina de uma folha é quem
   * montou o volume: a regra é correção manual → nome do arquivo → carimbo
   * (`disciplina-da-folha.ts`), e a correção manual vive só no canvas — o
   * servidor nunca a vê. Deixar o servidor recalcular daria um bloco diferente
   * do que o engenheiro está vendo na tela, que é o pior tipo de discordância.
   *
   * Ausente: cai no que o nome do arquivo diz, e sem isso num bloco só — o
   * comportamento de antes.
   */
  blocos?: (string | null | undefined)[];
  /** Código do bloco → rótulo ("his" → "Hidrossanitario"), para as mensagens. */
  rotulos?: Record<string, string>;
}

/**
 * Roda a conferência leve sobre os selos lidos das pranchas de um volume.
 * Determinístico, sem IA. Parseia os nomes (fonte única) e delega à checagem
 * pura, que confere código e obra no volume inteiro e o resto POR BLOCO.
 */
export function runLightCheck(
  selos: SeloForLd[],
  opts: LightCheckOptions = {},
): LightCheckResult {
  void opts.templateId;
  const indices = selos
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.fileName || s.arquivo);
  const validos = indices.map(({ s }) => s);
  // Folha RESOLVIDA (reconciliação por ordem de página) sobrescreve a do fato.
  const resolved = resolveSheetNumbers(validos);
  const facts = validos.map((s, i) => {
    const fato = seloToFact(s);
    /*
     * Sem bloco vindo do cliente, o nome do arquivo decide — e só quando ele
     * aponta UMA disciplina. Nome com várias é o PDF do volume inteiro
     * (`vol10_his_inc_spd`), e dizer que as 30 folhas dele são todas "his"
     * faria a conferência agrupar errado: a mesma regra de `escolherCodigo`.
     */
    const doCliente = opts.blocos?.[indices[i].i];
    const bloco =
      (doCliente ?? "").trim() ||
      (fato.disciplinas.length === 1 ? fato.disciplinas[0] : "");
    return { ...fato, sheet: resolved[i], bloco };
  });
  return checkSeloFacts(facts, { rotulos: opts.rotulos });
}
