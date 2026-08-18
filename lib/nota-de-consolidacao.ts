/**
 * O ACHADO QUE FALA DE OUTRO ACHADO NÃO É UM ACHADO.
 *
 * No parecer do 117_25 (18/08/2026) saiu isto, contado entre os 58:
 *
 *   INC-052 · tipo "Achado duplicado"
 *           · descrição "A ocorrência foi consolidada no INC-019."
 *           · sugestão "Tratar ambas as ocorrências pelo INC-019."
 *
 * O modelo fez a coisa certa — viu a mesma sigla errada nas páginas 29 e 31 e
 * decidiu que era um achado só — e depois **entregou a decisão como se fosse
 * mais um defeito do memorial**. Quem lê o parecer não tem por que conhecer a
 * numeração interna, e a contagem do relatório sobe por uma linha que não
 * aponta erro nenhum no documento.
 *
 * O CORTE PRECISA SER CIRÚRGICO. O mesmo parecer traz "Parágrafo duplicado no
 * mesmo documento" (INC-050) e "Parágrafo duplicado" (INC-057), que são achados
 * legítimos: o sujeito deles é o MEMORIAL. O sujeito do INC-052 é o INC-019.
 * A regra separa os dois pelo sujeito, não pela palavra "duplicado".
 *
 * PURO: classifica um achado, não mexe em lista.
 */
import type { AuditFinding } from "./audit-report.ts";

/** Referência à numeração interna do próprio parecer: INC-019, AUD-007. */
const REFERENCIA_INTERNA = /\b(?:INC|AUD)-\d{1,4}\b/i;

/**
 * Tipos em que o próprio rótulo já declara que a linha é escrituração.
 * "Achado duplicado", "Achado consolidado", "Item repetido no parecer".
 */
const TIPO_DE_ESCRITURACAO =
  /\bachad[oa]s?\s+(?:duplicad|consolidad|repetid|unificad|agrupad)/i;

/**
 * Frases que dizem "isto já está em outro lugar DESTE parecer". Exigem a
 * referência interna junto — sem ela, "consolidado" pode ser uma afirmação
 * legítima sobre o documento ("orçamento consolidado", "sigla consolidada").
 */
const FRASE_DE_CONSOLIDACAO =
  /\b(?:consolidad|tratad|unificad|agrupad|absorvid|remetid)[oa]s?\b/i;

function texto(f: AuditFinding): string {
  return [f.descricao, f.sugestao_correcao, f.conflito].filter(Boolean).join(" ");
}

/**
 * Esta linha é uma nota de consolidação em vez de um defeito do documento?
 *
 * Dois caminhos, e ambos exigem que a linha aponte para OUTRO achado — é o que
 * impede o filtro de comer "Parágrafo duplicado no mesmo documento", cujo texto
 * nunca cita INC nenhum:
 *
 *   1. o `tipo` já se declara escrituração ("Achado duplicado"); ou
 *   2. o texto diz que a ocorrência foi consolidada/tratada em outro achado.
 */
export function ehNotaDeConsolidacao(f: AuditFinding): boolean {
  const corpo = texto(f);
  if (!REFERENCIA_INTERNA.test(corpo)) return false;

  if (TIPO_DE_ESCRITURACAO.test(String(f.tipo ?? ""))) return true;

  return FRASE_DE_CONSOLIDACAO.test(corpo);
}

/**
 * Tira do parecer as linhas que só falam da numeração dele mesmo.
 *
 * Devolve também o que foi tirado: um filtro que descarta em silêncio é a
 * próxima coisa a esconder achado, e este produto já pagou por isso.
 */
export function semNotasDeConsolidacao(findings: AuditFinding[]) {
  const mantidos: AuditFinding[] = [];
  const removidos: AuditFinding[] = [];
  for (const f of findings) {
    (ehNotaDeConsolidacao(f) ? removidos : mantidos).push(f);
  }
  return { mantidos, removidos };
}
