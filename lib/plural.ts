/**
 * "1 auditoria" e "3 auditorias" — e nunca mais "auditoria(s)".
 *
 * O plural por parêntese atravessava o produto inteiro: 22 ocorrências, da
 * barra de seleção do admin até o VEREDITO da auditoria — "3 incongruência(s)
 * crítica(s)", que é a frase mais lida deste software. Num produto que vende
 * rigor documental para engenharia, escrever como formulário de repartição
 * contradiz a promessa na linha mais importante.
 *
 * O segundo argumento é a FRASE INTEIRA no singular, e o terceiro no plural,
 * porque em português a concordância não para no substantivo: "1 auditoria
 * selecionada" vira "3 auditorias selecionadas", com as duas palavras mudando.
 * Um helper que só pluralizasse o substantivo trocaria um erro por outro.
 *
 * Fica fora daqui, de propósito, o log: `app/api/audit/route.ts` escreve
 * `[audit] ... N achado(s)` para o terminal, e ninguém lê aquilo procurando
 * cuidado editorial.
 */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Só a palavra, sem o número na frente — para quando a contagem já está na
 * tela por outro caminho (um número grande num cartão, por exemplo).
 */
export function palavra(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}
