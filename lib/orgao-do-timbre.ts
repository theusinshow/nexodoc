/**
 * O ÓRGÃO do timbre do memorial: "PREFEITURA MUNICIPAL DE <cidade>".
 *
 * A captura do nome da cidade para no FIM DA LINHA. Ela aceitava `\s`, que
 * inclui a quebra, e no modelo de capa PREFEITURA / SECRETARIA engolia a linha
 * de baixo até o teto de 40 caracteres: o 027_24 saiu "PREFEITURA MUNICIPAL DE
 * SÃO JOSÉ SECRETARIA MUNICIPAL DE INFRAEST", e Chapecó e Navegantes, idem. A
 * pasta da conversa herdava o lixo.
 *
 * PURO e sem `@/`, como [[nome-da-obra.ts]]: prova em node cru, sem PDF.
 */
export function orgaoDoTimbre(texto: string): string {
  return (
    /Prefeitura\s+Municipal\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç \t]{2,40})/i
      .exec(texto)?.[0]
      ?.replace(/\s+/g, " ")
      .trim() ?? ""
  );
}
