/**
 * A SUGESTÃO QUE DIZ "NENHUMA CORREÇÃO" NÃO É UM ACHADO.
 *
 * Quando a validação pede para remover um achado de IA, ele não some: vira
 * `tier: "sugestao"` ([[decisao-da-validacao.ts]]) — a regra de recall é que
 * achado incerto vai para a camada recolhível em vez de desaparecer. A tela
 * antiga respeitava a camada ("Sugestões da IA — não contam para o veredito");
 * a fila nova e o `totalFindings` não olham `tier`, e a linha entra na contagem
 * como mais um defeito.
 *
 * Quase nenhuma dessas linhas é incerteza. Medido no banco de dev em
 * 16/10/2026: 51 das 56 sugestões têm a ação reescrita pela validação como
 * "Nenhuma correção necessária com base neste candidato", "Remover o achado" ou
 * "Tratar a correção no INC-005" — a validação concluiu que não há erro, ou que
 * ele já está noutro achado, e ainda assim a linha foi contada. No laço de corrigir e
 * reauditar o 040_26_est_md_a, foram 3 dos 10 achados da 3ª volta: quem corrige
 * tudo o que o Nexo pede vê o número parar de cair por linhas que não pedem nada.
 *
 * O CORTE É ESTREITO DE PROPÓSITO. Só sai a linha que:
 *   1. é sugestão de IA (não regra, não questão em aberto do motor);
 *   2. tem a ação COMEÇANDO por uma das formas de `ABRE_DISPENSANDO`;
 *   3. não traz, depois disso, uma troca concreta — "Nenhuma correção
 *      obrigatória; se a intenção for X, substituir «3,5 dias» por «3,76 dias»"
 *      ainda instrui alguém, e fica.
 *
 * As 5 que sobram no banco são assim: cada uma manda fazer alguma coisa.
 *
 * PURO: classifica um achado, não mexe em lista.
 */
import type { AuditFinding } from "./audit-report.ts";

function semAcento(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A ação que dispensa a si mesma. Três formas, todas vistas no banco:
 *  - "Nenhuma correção necessária", "Não há alteração sustentada",
 *    "Nenhuma substituição obrigatória";
 *  - "Remover o achado.", "Não editar com base neste candidato";
 *  - a duplicata, que manda tratar NOUTRO achado: "Tratar a correção no
 *    INC-005", "Incorporar a ocorrência da página 27 ao INC-006". O defeito já
 *    está contado lá. Só com o verbo de remessa NO INÍCIO: "Corrigir a página
 *    11 e revisar no âmbito de INC-014" manda corrigir algo, e fica.
 */
const ABRE_DISPENSANDO = [
  /^(?:nenhuma|nenhum|nao ha|sem) (?:correcao|alteracao|ajuste|acao|mudanca|substituicao)\b/,
  /^(?:remover (?:o achado|este candidato)|nao (?:abrir|editar|exigir|registrar|emitir)\b)/,
  /^(?:tratar|consolidar|incorporar|executar|aplicar|manter)\b.*\b(?:inc|aud)-\d/,
];

/**
 * Uma troca concreta: verbo de edição com um valor citado entre aspas ou
 * guillemets. Sem o valor, "substituir" é intenção; sem o verbo, «prumo» é só a
 * palavra discutida ("«prumo» pode ser adotado por preferência").
 */
const TROCA_CONCRETA =
  /\b(?:substituir|trocar|incluir|acrescentar|inserir|retirar|excluir|corrigir para)\b[^.;]*[«"“][^»"”]{1,}[»"”]/;

export function ehSugestaoSemCorrecao(f: AuditFinding): boolean {
  if (f.origem === "regra" || f.tier !== "sugestao" || f.motor) return false;
  const acao = semAcento(f.sugestao_correcao ?? "");
  if (!ABRE_DISPENSANDO.some((forma) => forma.test(acao))) return false;
  return !TROCA_CONCRETA.test(acao);
}

/**
 * Tira do parecer as sugestões que a própria validação dispensou.
 *
 * Devolve também o que foi tirado: vai para `runtime`, porque um filtro que
 * descarta em silêncio é a próxima coisa a esconder achado.
 */
export function semSugestoesSemCorrecao(findings: AuditFinding[]) {
  const mantidos: AuditFinding[] = [];
  const removidos: AuditFinding[] = [];
  for (const f of findings) {
    (ehSugestaoSemCorrecao(f) ? removidos : mantidos).push(f);
  }
  return { mantidos, removidos };
}
