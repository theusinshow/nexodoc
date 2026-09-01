/**
 * A ATENÇÃO DO PAINEL — o que vem primeiro, o que a linha diz, e o que abre
 * sozinho.
 *
 * As três decisões da home nova, fora do componente para poderem ser provadas
 * sem navegador. A home é o lugar em que "quase certo" custa caro: ela é a
 * primeira tela depois do login, e uma ordem errada empurra o trabalho que
 * espera alguém para baixo da dobra.
 *
 * PURO e sem imports → roda em node cru (`npm run test:atencao-painel`).
 */

/** O mínimo que a ordenação precisa saber de um projeto. */
export type ProjetoParaOrdenar = {
  projectId: string;
  /** O maior tempo parado entre os achados que esperam VOCÊ. Zero quando não há. */
  diasParado: number;
  /** Achados que vieram PARA você. */
  recebidos: number;
  /** Achados que você mandou e estão com outra pessoa. */
  enviados: number;
  /** Instante do trabalho mais recente. Desempata. */
  atualizadoEm: number;
};

/**
 * MAIS PARADO PRIMEIRO — e projeto sem pendência depois de todos.
 *
 * É a ordem que o canto da lista promete desde sempre ("mais parados primeiro")
 * e que a tela não cumpria. Projeto sem pendência CONTINUA na lista, porque a
 * home é "onde você está trabalhando" — mas não disputa o topo com trabalho que
 * espera alguém.
 *
 * Ordena uma CÓPIA: o chamador é React, e mutar a prop faria o render seguinte
 * enxergar outra lista.
 */
export function ordemDaAtencao<T extends ProjetoParaOrdenar>(projetos: readonly T[]): T[] {
  return [...projetos].sort((a, b) => {
    const aTem = a.recebidos > 0;
    const bTem = b.recebidos > 0;

    if (aTem !== bTem) return aTem ? -1 : 1;
    if (aTem && a.diasParado !== b.diasParado) return b.diasParado - a.diasParado;

    return b.atualizadoEm - a.atualizadoEm;
  });
}

/**
 * A partir de quantos dias um achado parado ganha destaque.
 *
 * Cinco, e não três: com três, uma pendência de sexta já chega alaranjada na
 * segunda — e tarja que acende sozinha no fim de semana ensina a ignorá-la.
 *
 * MORA AQUI, e não no componente: a tela e o teste não podem discordar do
 * número, e era exatamente isso que duas cópias permitiriam.
 */
export const LIMIAR_TARJA = 5;

export type ResumoDoProjeto = {
  texto: string;
  /** `alerta` acende; `seu` marca o que espera você; `quieto` é o resto. */
  realce: "alerta" | "seu" | "quieto";
};

/**
 * A LINHA DE ESTADO do cartão fechado.
 *
 * O QUE É SEU VENCE O QUE ESTÁ COM OUTROS. Um projeto com 2 achados seus e 9
 * enviados é, para quem olha a home, um projeto com 2 achados — os outros nove
 * não pedem nada dessa pessoa agora.
 *
 * E O QUE ESTÁ COM OUTROS DIZ COM QUEM. O rótulo era "5 com outros": informava
 * a quantidade e escondia o essencial, que é de quem cobrar. Com mais de uma
 * pessoa vira contagem — três nomes numa linha de resumo é a repetição que esta
 * tela existe para tirar.
 */
export function resumoDoProjeto(args: {
  recebidos: number;
  enviados: number;
  diasParado: number;
  pessoas: readonly string[];
}): ResumoDoProjeto {
  if (args.recebidos > 0) {
    const quantos = `${args.recebidos} ${args.recebidos === 1 ? "achado" : "achados"}`;

    return args.diasParado >= LIMIAR_TARJA
      ? { texto: `${quantos} · parado há ${args.diasParado} dias`, realce: "alerta" }
      : { texto: quantos, realce: "seu" };
  }

  if (args.enviados > 0) {
    /*
     * PESSOAS ÚNICAS. Cinco achados com o Milton são UMA pessoa, e contar as
     * entradas diria "com 5 pessoas" sobre um destinatário só.
     */
    const unicas = [...new Set(args.pessoas.map((n) => n.trim()).filter(Boolean))];
    const comQuem =
      unicas.length === 1 ? unicas[0] : `${unicas.length || args.enviados} pessoas`;

    return { texto: `${args.enviados} com ${comQuem}`, realce: "quieto" };
  }

  return { texto: "sem pendência", realce: "quieto" };
}

/**
 * QUAL CARTÃO NASCE ABERTO — e por que quase nenhum.
 *
 * A home abria o PRIMEIRO cartão sempre (`if (primeiro) setAbertos(...)`). Na
 * medição de 01/09/2026 isso expandiu cinco achados que estavam com o Milton —
 * trabalho que está com outra pessoa, o tipo menos acionável que existe — e
 * gastou a dobra inteira mostrando o que ninguém pode fazer agora.
 *
 * Abre sozinho só o que espera VOCÊ, e só o primeiro deles. Nada para você,
 * nada abre: a lista fechada cabe inteira, e cada cartão diz o seu estado numa
 * linha.
 *
 * Recebe a lista JÁ ORDENADA por `ordemDaAtencao` — assim "o primeiro" quer
 * dizer "o mais parado", e não "o primeiro que o banco devolveu".
 */
export function abreSozinho(projetos: readonly ProjetoParaOrdenar[]): string | null {
  return projetos.find((p) => p.recebidos > 0)?.projectId ?? null;
}
