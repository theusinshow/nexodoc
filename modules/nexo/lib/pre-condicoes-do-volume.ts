/**
 * A PRÉ-CONDIÇÃO DA MONTAGEM DO VOLUME, num lugar só.
 *
 * Ela morava no atributo `disabled` do botão "Montar volume". Enquanto a única
 * porta era aquele botão, funcionou; quando nasceu o "Montar os N volumes", o
 * laço passou a chamar a montagem DIRETO (`confirmRef.current()`), sem botão
 * nenhum no caminho — e a trava, que era um adorno de interface, não travou
 * nada.
 *
 * O estrago aparece na conversa RETOMADA: trocar de conversa ou dar F5 chama
 * `limparPranchas()` e os bytes das pranchas não voltam (só o memorial é
 * recuperado do IndexedDB). Os artefatos capa/LD/separatriz voltam do servidor
 * e entram normalmente, então o volume SAI — com capa, separatriz e LD e
 * nenhuma prancha dentro. Sem erro, sem aviso: `buildVolumeParts` pula parte
 * sem bytes em silêncio, e o PDF é entregue como se estivesse pronto.
 *
 * Por isso a regra virou função pura, testada em node cru: quem monta pergunta
 * a ela ANTES de montar, e o botão pergunta a mesma coisa para desabilitar. Uma
 * verdade só — interface e montagem não podem discordar sobre o que é um volume
 * entregável.
 */

import {
  temCapa as disciplinaTemCapa,
  temLd as disciplinaTemLd,
} from "../../../server/nexo/disciplinas.ts";

/** O que a montagem tem em mãos, do ponto de vista das pré-condições. */
export interface PartesDoVolume {
  /** Há PDF de capa para este tomo. */
  temCapa: boolean;
  /** Há PDF de LD para este tomo. */
  temLd: boolean;
  /**
   * O volume mistura disciplinas. Aí a LD não é uma: são N, uma por bloco, e a
   * montagem gera as que faltarem — exigir a LD única travaria para sempre.
   */
  misto: boolean;
  /** Quantos ARQUIVOS de prancha este tomo tem em mãos (bytes, não selos). */
  pranchas: number;
  /**
   * Código da disciplina do volume, quando ele é de UMA só (`snd`, `arq`...).
   *
   * Existe por causa de uma trava que este arquivo criaria sozinho: o plano de
   * geração parou de oferecer LD para quem não tem LD (`blocoGera`), e se a
   * exigência daqui não lesse a MESMA tabela, o volume de sondagem ficaria
   * travado para sempre — o plano não oferece, e o botão pede.
   *
   * Opcional de propósito: nem todo caminho sabe a disciplina, e não saber não
   * pode virar dispensa. Ausente, a exigência é a de antes.
   */
  codigo?: string;
}

/**
 * O motivo pelo qual este volume NÃO pode ser montado, ou `null` se pode.
 *
 * A frase é a que o engenheiro lê — no lugar do botão travado, e na lista de
 * falhas do "montar todos". Volume sem prancha, sem capa ou (quando é de uma
 * disciplina só) sem LD não é entregável: montar assim produz um PDF que passa
 * por pronto.
 *
 * O QUE A DISCIPLINA DISPENSA não é cobrado: sondagem não tem LD na tabela do
 * escritório, e exigir a dela travaria um volume que está pronto. A dispensa
 * depende de `codigo` chegar — sem ele, a regra é a de antes.
 */
export function motivoParaNaoMontar(partes: PartesDoVolume): string | null {
  if (partes.pranchas <= 0) {
    return "sem as pranchas — os arquivos não estão nesta sessão; reanexe-os para montar";
  }
  const codigo = partes.codigo?.trim() ?? "";
  if (!partes.temCapa && (!codigo || disciplinaTemCapa(codigo))) {
    return "gere a capa deste tomo antes de montar";
  }
  if (!partes.misto && !partes.temLd && (!codigo || disciplinaTemLd(codigo))) {
    return "gere a LD deste tomo antes de montar";
  }
  return null;
}
