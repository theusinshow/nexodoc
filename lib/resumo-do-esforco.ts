/**
 * A FRASE QUE DESCREVE O ESFORÇO da auditoria — a partir dos números medidos.
 *
 * O relatório dizia "leitura global por IA e 98 blocos de leitura por capítulo"
 * numa corrida que leu **8**: a frase usava o total de capítulos do documento em
 * vez dos blocos que foram ao modelo. Um parecer que sustenta decisão de emitir
 * projeto afirmava 12× o trabalho que fez.
 *
 * A regra que rege este arquivo: **só entra o que se pode afirmar**. Nada de
 * rótulo fixo, nada de número deduzido, e a fração lida é dita SEMPRE que não
 * for o documento inteiro — porque é justamente aí que o silêncio engana.
 *
 * PURO: recebe a medição, não a produz.
 */
import type { CoberturaDoArquivo } from "./audit-report.ts";

/** Quanto do documento a leitura global recebeu, de 0 a 1. */
export function fracaoLida(c: CoberturaDoArquivo): number {
  if (c.caracteres_totais <= 0) return 0;
  return Math.min(1, c.caracteres_lidos / c.caracteres_totais);
}

/**
 * A cobertura é COMPLETA quando a leitura global recebeu o documento inteiro e
 * nenhum bloco ficou de fora.
 *
 * Os dois têm de valer: ler tudo numa passada e nenhum capítulo em detalhe é uma
 * cobertura; ler todos os capítulos e só um recorte no conjunto é outra. Chamar
 * qualquer uma das duas de "completa" seria a mesma imprecisão de antes.
 */
export function coberturaCompleta(c: CoberturaDoArquivo): boolean {
  return fracaoLida(c) >= 1 && c.blocos_lidos >= c.blocos_totais;
}

function porcento(fracao: number): string {
  return `${Math.round(fracao * 100)}%`;
}

/**
 * A frase do `arquivos_analisados[].resumo`.
 *
 * Sem medição devolve a frase mínima e honesta: não afirma cobertura nenhuma.
 * Parecer antigo, gravado antes deste campo existir, cai aqui.
 */
export function resumoDoEsforco(c?: CoberturaDoArquivo): string {
  if (!c) {
    return "Leitura de identidade e leitura do documento por IA.";
  }

  const partes: string[] = ["Leitura de identidade"];

  const fracao = fracaoLida(c);
  partes.push(
    fracao >= 1
      ? "leitura do documento inteiro por IA"
      : `leitura de ${porcento(fracao)} do documento por IA (trechos amostrados)`,
  );

  if (c.blocos_lidos > 0) {
    partes.push(
      c.blocos_lidos >= c.blocos_totais
        ? `${c.blocos_lidos} blocos de leitura por capítulo (todos)`
        : `${c.blocos_lidos} de ${c.blocos_totais} blocos de leitura por capítulo`,
    );
  }

  const frase = `${partes.join(", ")}.`;

  /*
   * O AVISO É PARTE DA FRASE, e não um campo à parte que a tela possa esquecer
   * de mostrar. Quem lê o resumo precisa sair sabendo que o parecer não cobre o
   * documento — foi a ausência disso que deixou uma leitura de 16% parecer
   * completa.
   */
  return coberturaCompleta(c)
    ? frase
    : `${frase} ATENÇÃO: partes do documento não foram lidas nesta auditoria.`;
}
