/**
 * OS DOIS TÍTULOS DE UM BLOCO — o da LD e o da separatriz —, e a precedência
 * entre o que o escritório padroniza e o que o engenheiro decide.
 *
 * O escritório imprime nomes DIFERENTES para a mesma disciplina, conforme o
 * documento. Lido dos PDFs que ele entregou (040-26, confirmado em 116-25):
 *
 *   disciplina | separatriz                              | LD e capa
 *   -----------|-----------------------------------------|------------------------
 *   his        | PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS | PROJETO HIDROSSANITÁRIO
 *   inc        | PROJETO PREVENTIVO CONTRA INCÊNDIO      | PROJETO PREVENTIVO
 *   spd        | PROJETO DE SISTEMA DE PROTEÇÃO C.D.A.   | PROJETO SPDA
 *
 * Isto nasceu de um defeito medido em 20/08/2026: as três separatrizes do volume
 * 10 saíam com o RÓTULO DE TELA — "HIDROSSANITÁRIO", "SPDA" —, porque uma
 * variável só (`titulo`, no `ConfirmationCard`) alimentava `postSeparatriz` E
 * `postLd`. Um nome onde eram necessários dois.
 *
 * A REGRA NÃO É "O LÉXICO SEMPRE VENCE", e é aí que mora a sutileza. O
 * componente já registrava a restrição: no volume de disciplina única, o que o
 * engenheiro decidiu não pode ser reescrito. Mas o campo por onde essa decisão
 * chega é o MESMO que, na falta dela, vem preenchido com o padrão derivado da
 * LD. Aceitar tudo como decisão faria a separatriz herdar o nome da LD — que é o
 * defeito, um andar acima.
 *
 * Por isso: o léxico vence o PADRÃO DERIVADO e perde para a DECISÃO, e o que
 * separa os dois é a comparação com o nome de capa da própria disciplina.
 */
import { nomeNaCapa, nomeNaSeparatriz } from "./disciplinas";

export interface TitulosDoBloco {
  /** Título da LISTA DE DOCUMENTOS deste bloco. */
  ld: string;
  /** Título impresso na SEPARATRIZ deste bloco. */
  separatriz: string;
}

export interface EntradaDosTitulos {
  /** Código canônico de três letras ("his"). Vazio = disciplina desconhecida. */
  codigo: string;
  /** Rótulo de tela da disciplina ("Hidrossanitário"). Último recurso. */
  rotulo: string;
  /**
   * O título que já veio decidido para este bloco — do engenheiro ou do agente.
   *
   * Pode ser uma DECISÃO ("PROJETO DE ÁGUAS PLUVIAIS") ou apenas o PADRÃO
   * DERIVADO da LD, que costuma ser o próprio nome de capa. Só o primeiro caso
   * manda; ver o comentário do módulo.
   */
  escolhido?: string;
}

/** Normaliza para comparar decisão contra padrão: caixa e espaço não decidem. */
function chave(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

export function titulosDoBloco(entrada: EntradaDosTitulos): TitulosDoBloco {
  const escolhido = (entrada.escolhido ?? "").trim();
  const doRotulo = entrada.rotulo.trim().toUpperCase();
  const daCapa = nomeNaCapa(entrada.codigo) ?? "";
  const daSeparatriz = nomeNaSeparatriz(entrada.codigo) ?? "";

  /*
   * Decisão é o que DIVERGE do padrão da LD. Um `escolhido` igual ao nome de
   * capa é o padrão voltando por outro caminho, não uma escolha.
   */
  const houveDecisao = escolhido !== "" && chave(escolhido) !== chave(daCapa);

  return {
    ld: escolhido || daCapa || doRotulo,
    separatriz: houveDecisao ? escolhido : daSeparatriz || doRotulo || escolhido,
  };
}
