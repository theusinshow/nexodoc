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
  /**
   * Instante do trabalho mais recente, em MILISSEGUNDOS. Desempata.
   *
   * O sufixo não é enfeite: `ProjetoDoPainel.atualizadoEm` é uma string ISO, e
   * dois campos com o mesmo nome e tipos diferentes é como um `Date.parse`
   * esquecido vira uma ordenação silenciosamente aleatória.
   */
  atualizadoEmMs: number;
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

    return b.atualizadoEmMs - a.atualizadoEmMs;
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
  /**
   * O TOM do chip. Eram três, e `quieto` cobria duas coisas diferentes:
   * "está com outra pessoa" e "não tem nada". O componente desenhava `quieto`
   * como texto solto, sem caixa, com uma razão escrita — "só o que espera VOCÊ
   * ganha a caixa".
   *
   * A razão era boa e o efeito foi outro: na tela cheia, as linhas sem caixa
   * leem como DESABILITADAS ao lado das que têm. O olho aprende que caixa =
   * importante e para de ler a coluna inteira. Agora todo estado é um chip com
   * a mesma forma, e só a cor muda — a hierarquia passa a ser a cor, que não
   * some.
   *
   * `trabalho` é o quinto, e ele não existia: é o projeto que está na home
   * porque houve conversa recente, sem auditoria nem achado. Ele aparecia só na
   * coluna da direita, que morreu.
   */
  realce: "alerta" | "seu" | "outro" | "trabalho" | "limpo";
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
  /**
   * O trabalho do Nexo neste projeto, quando NÃO há achado nenhum.
   *
   * Ele só fala quando o resto se cala, e a precedência é essa de propósito: um
   * projeto com achado parado E volume montado ontem é, para quem abre a home,
   * um projeto com achado parado. Dizer "volume montado" ali esconderia a
   * cobrança atrás de uma notícia boa.
   */
  trabalho?: { tipo?: string | null; auditoriaPendente?: boolean } | null;
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

    return { texto: `${args.enviados} com ${comQuem}`, realce: "outro" };
  }

  /*
   * SEM ACHADO, o que sobra é o que se fez aqui. "Sem pendência" é verdade e é
   * pouco: não distingue a obra que ninguém tocou da que teve volume montado
   * ontem — e essa segunda é o motivo de metade das visitas ao produto.
   */
  if (args.trabalho?.auditoriaPendente) {
    return { texto: "auditoria em curso", realce: "trabalho" };
  }

  if (args.trabalho?.tipo === "volume") {
    return { texto: "volume montado", realce: "trabalho" };
  }

  /*
   * SÓ FALA QUEM TEM O QUE DIZER, e este freio foi acrescentado depois de ver a
   * tela: havia um "trabalho recente" genérico aqui, para qualquer conversa. Só
   * que TODO projeto tem conversa — é assim que o trabalho começa —, então esse
   * ramo engolia o "sem pendência" e o tornava inalcançável. Um projeto
   * auditado e limpo aparecia como "trabalho recente", que não diz nada que a
   * pessoa não saiba.
   *
   * O quinto estado existe para o caso concreto (montou volume, nunca auditou),
   * não para "houve uma conversa aqui".
   */
  return { texto: "sem pendência", realce: "limpo" };
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
