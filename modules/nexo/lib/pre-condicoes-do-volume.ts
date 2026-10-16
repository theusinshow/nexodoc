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
 *
 * Desde 09/10/2026 as pranchas são guardadas por projeto e voltam no F5; a
 * trava continua para a conversa sem projeto e para o envio que falhou.
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
   * Quantas das `pranchas` ainda estão SUBINDO para o servidor (09/10/2026).
   * Montar no meio do envio mandaria referência de prancha sem ficha.
   */
  subindo?: number;
  /** Nomes das pranchas cujo envio falhou de vez. */
  naoGuardadas?: string[];
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
    return "sem as pranchas — solte os arquivos das pranchas para montar";
  }
  const falhas = partes.naoGuardadas ?? [];
  if (falhas.length === 1) {
    return `não consegui guardar ${falhas[0]} — tente de novo ou solte o arquivo outra vez`;
  }
  if (falhas.length > 1) {
    return `não consegui guardar ${falhas.length} pranchas (${falhas[0]} e mais ${falhas.length - 1}) — tente de novo ou solte os arquivos outra vez`;
  }
  const subindo = Math.max(0, partes.subindo ?? 0);
  if (subindo > 0) {
    return `guardando as pranchas — ${partes.pranchas - subindo} de ${partes.pranchas}; monta assim que terminar`;
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

/** O que a tela sabe sobre a leitura dos selos neste instante. */
export interface LeituraDosSelos {
  /** A leitura ainda está em voo. */
  lendo: boolean;
  /** Quantas folhas já voltaram do leitor. */
  lidas: number;
  /** Quantas folhas foram anexadas. */
  total: number;
}

/**
 * O QUE IMPEDE GERAR AGORA — e é uma coisa só: a leitura ainda não acabou.
 *
 * O plano de geração recalcula os blocos a cada render, então a TELA sempre
 * mostra o número certo. O artefato, não: ele sai do que existia no instante do
 * clique. Gerar no meio da leitura produz uma LD curta sem dizer nada.
 *
 * Medido em 20/08/2026 no volume 10 de 040-26: clicando GERAR com 18 das 20
 * folhas lidas, o bloco SPDA anunciava 4 folhas na tela e a LD saiu com 2. O
 * volume foi montado com 25 páginas em vez de 27 — duas pranchas a menos num
 * documento que vai para a prefeitura, e nenhum aviso em lugar nenhum.
 *
 * A leitura segue a ordem do upload, então quem perde é sempre a ÚLTIMA
 * disciplina do volume. Num volume misto — 6 dos 8 reais são — isso é a regra,
 * não o azar.
 *
 * NÃO trava por selo ilegível: a folha cujo carimbo não foi lido existe como
 * objeto, entra na LD como "sem título no selo" e é corrigível no canvas.
 * Travar por isso impediria de gerar um volume que o escritório aceita.
 */
export function motivoParaNaoGerar(leitura: LeituraDosSelos): string | null {
  if (!leitura.lendo) return null;
  const total = Math.max(0, Math.trunc(leitura.total));
  const lidas = Math.max(0, Math.min(Math.trunc(leitura.lidas), total || Infinity));
  return total > 0
    ? `Ainda lendo os selos — ${lidas} de ${total} folhas. Gerar agora deixaria folhas de fora.`
    : "Ainda lendo os selos. Gerar agora deixaria folhas de fora.";
}

/** O que a tela sabe sobre a capa deste turno. */
export interface CapaDoPlano {
  /** Há uma capa entre os documentos que este turno vai gerar. */
  noPlano: boolean;
  /** O número do volume, como decidido ou derivado do nome do arquivo. */
  volume: string;
}

/**
 * O QUE IMPEDE GERAR A CAPA — e é o número do volume, quando ninguém o disse.
 *
 * O builder cai em "1"/"I" quando não acha o volume em lugar nenhum, e a capa
 * sai "Vol. I" sem que ninguém tenha decidido isso. Medido em 20/08/2026 no
 * volume 10 de 040-26: as pranchas não carregam o número do volume — nem no
 * nome, nem no carimbo —, só a pasta sabe (`10_his_inc_spd`). O escritório
 * escreve "Vol. X"; o Nexo escrevia "Vol. I".
 *
 * O campo ainda aparecia em CINZA no frame, marcado "do arquivo": apresentado
 * como fato quando era palpite. Afirmar em vez de perguntar é o modo de falhar
 * que este produto existe para evitar — o engenheiro só descobriria abrindo o
 * PDF, e uma capa com o volume errado é volume reemitido.
 *
 * O default do builder CONTINUA lá, de propósito: ele é a rede para o caminho
 * que não passe por aqui, e uma capa com "Vol. I" é menos ruim que uma capa com
 * "Vol. " vazio. O que muda é que o caminho normal não chega mais nele.
 */
export function motivoParaNaoGerarCapa(capa: CapaDoPlano): string | null {
  if (!capa.noPlano) return null;
  return capa.volume.trim()
    ? null
    : "Diga o número do volume — sem ele a capa sai como Vol. I, sem ninguém ter decidido.";
}

/** A situação que cada montador de volume publica (ver `montadores-de-volume`). */
export interface SituacaoPublicada {
  bloqueio: string | null;
  erro: string | null;
}

/**
 * O QUE O AGENTE PRECISA SABER DA MONTAGEM — uma linha por motivo (16/10/2026).
 *
 * O agente não via o botão. Com o volume travado ("gere a LD deste tomo"), ele
 * respondia "eu só proponho; confirme pelo botão" — três vezes seguidas no
 * 121-25, para um botão que não podia ser apertado. A trava já existia, escrita
 * e testada; só não chegava à conversa.
 *
 * Tomos com o mesmo motivo viram uma linha só: quatro tomos travados pela mesma
 * razão é uma coisa a dizer, não quatro.
 */
export function bloqueiosParaOAgente(
  situacoes: Readonly<Record<string, SituacaoPublicada>>,
): string[] {
  const porMotivo = new Map<string, string[]>();
  for (const [id, s] of Object.entries(situacoes)) {
    const motivo = (s.erro ? `falhou: ${s.erro}` : s.bloqueio)?.trim();
    if (!motivo) continue;
    const tomo = /:t(\d+)$/.exec(id)?.[1] ?? "";
    const tomos = porMotivo.get(motivo) ?? [];
    if (!tomos.includes(tomo)) tomos.push(tomo);
    porMotivo.set(motivo, tomos);
  }
  return [...porMotivo].map(([motivo, tomos]) => {
    const numerados = tomos.filter(Boolean).sort();
    if (numerados.length === 0) return motivo;
    const rotulo = numerados.length === 1 ? "tomo" : "tomos";
    return `${rotulo} ${numerados.join(", ")}: ${motivo}`;
  });
}
