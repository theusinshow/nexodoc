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
 * Quantos blocos esta corrida PRETENDIA ler. Parecer antigo não declara o plano;
 * para ele vale o total, que é como era lido antes.
 */
function blocosPlanejados(c: CoberturaDoArquivo): number {
  return c.blocos_planejados ?? c.blocos_totais;
}

/**
 * A cobertura é COMPLETA quando a leitura global recebeu o documento inteiro e
 * nenhum bloco PLANEJADO ficou de fora.
 *
 * Era `blocos_lidos >= blocos_totais`, e a intenção estava certa: ler tudo numa
 * passada sem examinar capítulo nenhum não é a mesma cobertura que examinar
 * todos. Só que no Profundo `chunkLimit` é 0 por desenho — a global lê o
 * documento inteiro e nenhum bloco é planejado —, então a condição era
 * estruturalmente falsa e TODA corrida Profunda saía marcada como incompleta.
 *
 * Medido em 18/08/2026 no 117_25: a corrida cuja leitura global morreu em 503 e
 * a corrida que leu as 218 páginas e produziu 48 achados gravaram a MESMA
 * cobertura e a MESMA frase — inclusive o mesmo "ATENÇÃO". O aviso existia para
 * denunciar exatamente a primeira, e não conseguia, porque já estava aceso na
 * segunda. Alarme que toca sempre é ruído, não aviso.
 *
 * Comparar contra o PLANO preserva a intenção original onde ela vale (o Padrão,
 * que planeja blocos e pode deixá-los para trás) e cala onde ela não se aplica.
 */
export function coberturaCompleta(c: CoberturaDoArquivo): boolean {
  return fracaoLida(c) >= 1 && c.blocos_lidos >= blocosPlanejados(c);
}

/**
 * A cobertura MEDIDA, corrigida pelo que de fato aconteceu.
 *
 * `caracteres_lidos` é gravado quando o plano fecha — antes de a leitura global
 * ir ao modelo. É o número certo enquanto nada falha, e uma promessa quando algo
 * falha: na corrida de 18/08 em que a global abortou com 503, o campo seguiu
 * afirmando 469.053 de 469.053 caracteres lidos por uma passada que leu ZERO.
 *
 * A prosa do parecer já sabia da falha (`passadas_incompletas`); os números não.
 * Quem consome `cobertura` por máquina — painel, portão de emissão, benchmark —
 * lia cobertura total de uma auditoria sem IA nenhuma.
 *
 * PURA: recebe a medição e as falhas, devolve a medição corrigida.
 */
export function coberturaReconciliada(
  c: CoberturaDoArquivo,
  passadasIncompletas: { passada: string; motivo?: string }[] = [],
): CoberturaDoArquivo {
  const globalFalhou = passadasIncompletas.some((p) =>
    p.passada.toLowerCase().includes("global"),
  );
  if (!globalFalhou) return c;
  return { ...c, caracteres_lidos: 0 };
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
      : fracao <= 0
        ? /*
           * Zero não é uma amostra pequena, é a ausência da passada — e foi o
           * que aconteceu no 117_25 quando a global abortou em 503. Dizer
           * "0% (trechos amostrados)" descreveria uma amostragem que não houve.
           */
          "a leitura do documento por IA NÃO foi concluída"
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
