/**
 * QUAL AUDITORIA ANTERIOR SERVE DE BASE PARA ESTE MEMORIAL — mesmo que ela
 * tenha acontecido em outra conversa.
 *
 * Até 02/09/2026 a base era sempre a última auditoria DA CONVERSA ATUAL
 * (`ConfirmationCard.tsx`). Corrigir os erros apontados e voltar numa conversa
 * nova — que é o que se faz depois de mexer no documento — relia 100% do
 * memorial sem dizer que havia base. O motor de reuso inteiro ficava parado.
 *
 * A escolha antiga tinha razão registrada no código: "comparar com a de outra
 * conversa arriscaria emparelhar revisões diferentes que convivem". O risco era
 * real enquanto o único elo era o nome exato do arquivo. Com `chaveDoDocumento`
 * ele fica contido — `040_26_md_geral` e `040_26_md_ter_pav` são chaves
 * diferentes, e um pareamento errado ainda degradaria para "nenhum capítulo
 * bate", que relê tudo.
 *
 * PURO: recebe as candidatas já lidas do banco, devolve a ordem em que valem ser
 * tentadas. Quem fala com o Postgres e quem aplica `avaliarBase` é a rota — a
 * separação existe porque o portão precisa do `report` inteiro, e carregar o
 * `report` de vinte auditorias para achar um nome de arquivo seria caro.
 */
import { chaveDoDocumento } from "./elegibilidade-da-base.ts";

export interface CandidataDeBase {
  auditId: string;
  /** Os nomes de arquivo desta auditoria — vêm de `AuditText.fileName`. */
  arquivos: readonly string[];
  /** ISO. Só para ordenar e para a tela dizer de quando é. */
  quando: string;
}

/**
 * Quantas candidatas de mesma chave vale carregar o `report` para testar.
 *
 * Passar disso é sinal de outra coisa — o mesmo documento auditado dezenas de
 * vezes no mesmo projeto —, e nesse caso a mais recente que presta está entre as
 * primeiras. O teto existe para o custo da busca não crescer com o histórico.
 */
export const MAX_CANDIDATAS = 5;

/**
 * As candidatas que são O MESMO DOCUMENTO, da mais recente para a mais antiga.
 *
 * "Mesmo documento" é `chaveDoDocumento`: o nome sem a revisão nem o rastro das
 * assinaturas. É o que faz `_a` → `_b` e a via assinada casarem, e o que impede
 * `040_26_md_geral` de casar com `040_26_md_ter_pav`.
 *
 * NÃO decide se a base presta — isso é de `avaliarBase`, que precisa do parecer.
 * Aqui só se decide a ORDEM DE TENTATIVA.
 */
export function candidatasParaBase(
  candidatas: readonly CandidataDeBase[],
  arquivo: string,
): CandidataDeBase[] {
  const chave = chaveDoDocumento(arquivo);
  if (!chave) return [];

  return candidatas
    .filter((c) => c.arquivos.some((a) => chaveDoDocumento(a) === chave))
    /*
     * A MAIS RECENTE PRIMEIRO. Ordenar aqui e não confiar na ordem do banco é
     * de propósito: esta função é testada sozinha, e uma ordem que só existe na
     * cláusula SQL não seria exercitada por teste nenhum.
     */
    .slice()
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, MAX_CANDIDATAS);
}
