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
   *
   * `curso` é o SEXTO, e nasceu em 09/09/2026 separando-se do `trabalho`.
   * Os dois liam igual na tela — "auditoria em curso" e "volume montado" com o
   * mesmo tom cinza — e são opostos: um é o motor trabalhando NESTE INSTANTE, o
   * outro é uma tarefa que acabou. Um estado que muda sozinho enquanto a pessoa
   * olha não pode ter a mesma cor de um que não muda mais.
   */
  realce: "alerta" | "seu" | "outro" | "curso" | "trabalho" | "limpo";
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
    return { texto: "auditoria em curso", realce: "curso" };
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

/* ────────────────────────────────────────────────────────────────────────────
 * A ORDENAÇÃO ESCOLHIDA — quatro, e a promessa do canto vira um controle.
 *
 * O canto da lista dizia "mais parados primeiro" e essa era a única ordem que
 * existia. Ela continua sendo o padrão, e continua sendo a certa para quem abre
 * a tela de manhã sem saber o que quer. As outras três servem a quem CHEGA
 * SABENDO: "o que eu mexi ontem", "onde está a pilha", "acha o 077".
 *
 * "Críticos primeiro" ficou de fora de propósito. O painel não carrega
 * severidade de achado — `ItemDoPainel` tem título, direção, pessoa e dias, e
 * mais nada. Uma ordem que dissesse "críticos" ordenando por quantidade seria
 * a interface afirmando o que ela não sabe.
 * ────────────────────────────────────────────────────────────────────────── */

/** As ordens que a lista oferece. O valor viaja para o `localStorage`. */
export const ORDENS = [
  { id: "parados", rotulo: "Mais parados primeiro" },
  { id: "recentes", rotulo: "Atualizados recentemente" },
  { id: "achados", rotulo: "Mais achados" },
  { id: "alfabetica", rotulo: "A–Z" },
] as const;

export type OrdemDaLista = (typeof ORDENS)[number]["id"];

export function ehOrdem(valor: unknown): valor is OrdemDaLista {
  return ORDENS.some((o) => o.id === valor);
}

/** O que as ordens que não são "parados" precisam saber, além do básico. */
export type ProjetoParaOrdenarPorNome = ProjetoParaOrdenar & {
  codigo: string;
  nome: string;
};

/**
 * ORDENA UMA CÓPIA, sempre — o chamador é React.
 *
 * Só `parados` é `ordemDaAtencao`; as outras três são ordens simples e
 * DELIBERADAMENTE não separam "o que é seu" do resto. Quem escolheu "A–Z"
 * pediu o alfabeto, e um alfabeto que começa pelos seus achados não é um
 * alfabeto — é a ordem de atenção com outro rótulo.
 */
export function ordenarLista<T extends ProjetoParaOrdenarPorNome>(
  projetos: readonly T[],
  ordem: OrdemDaLista,
): T[] {
  if (ordem === "parados") return ordemDaAtencao(projetos);

  const copia = [...projetos];

  if (ordem === "recentes") {
    return copia.sort(
      (a, b) => b.atualizadoEmMs - a.atualizadoEmMs || a.codigo.localeCompare(b.codigo),
    );
  }

  if (ordem === "achados") {
    /*
     * TOTAL, e não só o recebido. A pergunta desta ordem é "onde está a pilha
     * de trabalho", e a pilha do projeto inclui o que está com os outros —
     * quem cobra precisa achar o projeto de nove achados mesmo que oito
     * estejam com o Victor.
     */
    const total = (p: T) => p.recebidos + p.enviados;
    return copia.sort(
      (a, b) =>
        total(b) - total(a) ||
        b.diasParado - a.diasParado ||
        a.codigo.localeCompare(b.codigo),
    );
  }

  /*
   * A–Z PELO NOME DA OBRA, e não pelo código. O código é `SIM118-25`: ordená-lo
   * dá a ordem do número de contrato, que é cronológica disfarçada de
   * alfabética. Quem pede A–Z está procurando "Ginásio", não "118".
   *
   * `localeCompare` com pt-BR: sem ele, "Ampliação" cai depois de "Zona" em
   * runtime que ordena por code point, e acento vira erro de ordem.
   */
  return copia.sort(
    (a, b) =>
      (a.nome || a.codigo).localeCompare(b.nome || b.codigo, "pt-BR", {
        sensitivity: "base",
      }) || a.codigo.localeCompare(b.codigo),
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * O QUE PEDE VOCÊ, EM NÚMEROS — a faixa "Precisa da sua atenção".
 *
 * Três contadores, e os três saem do MESMO dado que a lista já desenha. É a
 * regra desta faixa: ela não busca nada, ela CONTA o que está logo abaixo. Um
 * contador que consultasse outra fonte poderia dizer "3 achados" sobre uma
 * lista que mostra dois, e a faixa perderia a única coisa que a justifica.
 *
 * "1 conferência pendente" ficou de fora: a conferência do volume não é estado
 * persistido — ela roda durante a montagem e morre com ela. Um contador ali
 * seria número inventado.
 * ────────────────────────────────────────────────────────────────────────── */

export type FocoDaAtencao = "com-voce" | "parados" | "com-outros";

export type ContadorDaAtencao = {
  foco: FocoDaAtencao;
  /** Quantos ACHADOS — não quantos projetos. É o que a pessoa vai fazer. */
  quantos: number;
  /** Em quantos projetos eles estão. Vai para o `title` do controle. */
  projetos: number;
  rotulo: string;
};

export function contadoresDaAtencao(
  projetos: readonly { recebidos: number; enviados: number; diasParado: number }[],
): ContadorDaAtencao[] {
  const conta = (
    escolhe: (p: { recebidos: number; enviados: number; diasParado: number }) => number,
  ) =>
    projetos.reduce(
      (acc, p) => {
        const n = escolhe(p);
        return n > 0 ? { quantos: acc.quantos + n, projetos: acc.projetos + 1 } : acc;
      },
      { quantos: 0, projetos: 0 },
    );

  const comVoce = conta((p) => p.recebidos);
  /*
   * PARADO é um SUBCONJUNTO de "com você", e a faixa o repete de propósito. Os
   * dois números respondem perguntas diferentes — "quanto trabalho tenho" e
   * "quanto dele já está me constrangendo" — e somá-los num só esconderia o
   * segundo, que é o que faz alguém mudar o dia.
   *
   * Conta PROJETO parado, não achado: `diasParado` é o pior item do projeto, e
   * não dá para saber daqui quantos itens dele passaram do limiar sem receber a
   * lista inteira. O rótulo diz "projeto" para não mentir sobre a unidade.
   */
  const parados = projetos.filter((p) => p.recebidos > 0 && p.diasParado >= LIMIAR_TARJA);
  const comOutros = conta((p) => p.enviados);

  /*
   * O RÓTULO ENCURTOU, e a razão é a linha: três chips lado a lado somavam
   * "11 achados com você · 3 projetos parados · 12 com outras pessoas" — 58
   * caracteres de preposição para dizer três números. "Meus" e "da equipe" são
   * a mesma informação em metade do espaço, e são as palavras que o escritório
   * usa falando.
   *
   * "MEUS ACHADOS" e não "achados": a distinção que o chip carrega não é
   * "existe achado", é "é seu ou é de outro". O possessivo faz o trabalho que a
   * preposição fazia, e cabe.
   */
  const tudo: ContadorDaAtencao[] = [
    {
      foco: "com-voce",
      quantos: comVoce.quantos,
      projetos: comVoce.projetos,
      rotulo: `${comVoce.quantos} ${comVoce.quantos === 1 ? "meu achado" : "meus achados"}`,
    },
    {
      foco: "parados",
      quantos: parados.length,
      projetos: parados.length,
      rotulo: `${parados.length} ${parados.length === 1 ? "projeto parado" : "projetos parados"}`,
    },
    {
      foco: "com-outros",
      quantos: comOutros.quantos,
      projetos: comOutros.projetos,
      rotulo: `${comOutros.quantos} da equipe`,
    },
  ];

  // Contador zerado não vira "0 achados com você" — ele SOME. Uma faixa que
  // anuncia zeros ensina a não olhar para ela.
  return tudo.filter((c) => c.quantos > 0);
}

/**
 * AS INICIAIS de quem responde por um achado.
 *
 * Duas letras quando há dois nomes ("Carla Mendes" → CM), uma quando há um só
 * ("Carla" → C). O e-mail perde o domínio antes — `victor.almeida@prosul.com`
 * é `VA`, e não `VI`, porque o ponto separa nome de sobrenome tão bem quanto o
 * espaço.
 *
 * NUNCA substitui o nome sozinha. A regra do cartão é: uma pessoa mostra o
 * NOME (é de quem cobrar, e cobrar exige saber de quem); duas ou mais mostram
 * a pilha de iniciais, porque três nomes numa linha de resumo é a repetição
 * que esta tela existe para tirar. O tooltip devolve os nomes inteiros.
 */
export function iniciaisDe(valor: string): string {
  const local = (valor.includes("@") ? valor.split("@")[0] : valor).trim();
  const partes = local.split(/[\s._-]+/).filter(Boolean);

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0][0].toUpperCase();

  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/* ────────────────────────────────────────────────────────────────────────────
 * O ESTADO DO MOTOR — o que a legenda do orbe diz.
 *
 * Ela dizia a CONTAGEM de achados ("11 achados esperam por você"), e a faixa
 * "Precisa da sua atenção" repetia o mesmo número 60px abaixo. Duas vezes o
 * mesmo dado na mesma dobra, e a de baixo ainda FILTRA a lista — então a de
 * cima perdeu a disputa e trocou de assunto.
 *
 * O que só a legenda pode dizer é em que pé está o MOTOR: se há auditoria
 * rodando, se acabou de terminar alguma coisa, ou se está tudo quieto. Nenhum
 * desses três aparece em outro lugar da tela.
 *
 * PURO, e por isso testável: a regra de "há pouco" é uma subtração de datas, e
 * é exatamente o tipo de coisa que passa despercebida no navegador — ninguém
 * abre a home às 3h da manhã para conferir se a notícia de ontem já saiu.
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Quanto tempo uma conclusão continua sendo notícia.
 *
 * DOZE HORAS, e o limite não é decoração: sem ele, "auditoria concluída"
 * ficaria no lugar mais visível do produto por três semanas depois de a
 * auditoria acabar. Notícia velha no lugar de honra ensina a não olhar para o
 * lugar de honra.
 *
 * Doze e não vinte e quatro: quem montou um volume às 18h de ontem e abre o
 * produto às 9h de hoje não está "no meio" daquilo — o dia virou, e o que ele
 * quer saber é o que está rodando AGORA. Doze horas cobrem o intervalo do
 * almoço e a volta depois de uma reunião, que é o caso real.
 */
export const NOTICIA_VALE_MS = 12 * 60 * 60 * 1000;

export type EstadoDoProcesso = {
  texto: string;
  /**
   * `info` é processo ACONTECENDO — azul, e com o ponto que pulsa.
   * `quieto` é notícia ou repouso — sem cor.
   *
   * NÃO EXISTE `alerta` AQUI, e a ausência é a decisão: âmbar nesta tela
   * significa uma coisa só, "está parado esperando você", e é o chip de tempo
   * do projeto que a carrega. Se a legenda do orbe também pudesse ficar âmbar,
   * a mesma cor diria "rodando agora" e "parado há seis semanas" na mesma
   * dobra.
   */
  tom: "info" | "quieto";
};

export function estadoDoProcesso(args: {
  /** Há auditoria rodando neste instante. */
  emCurso: boolean;
  /** O código da obra do trabalho mais recente. Vazio quando não há pasta. */
  codigo: string;
  /** `volume` | `auditoria` | outro. É o `tipo` da conversa. */
  tipo: string | null;
  /** Quando esse trabalho foi tocado pela última vez, em ms. */
  quandoMs: number | null;
  agoraMs?: number;
}): EstadoDoProcesso {
  const agora = args.agoraMs ?? Date.now();
  // O código entra na frase quando existe; sem ele a frase fica genérica em vez
  // de ficar quebrada ("Analisando o memorial do " com o fim pendurado).
  const onde = args.codigo.trim() ? ` do ${args.codigo.trim()}` : "";

  if (args.emCurso) return { texto: `Analisando o memorial${onde}`, tom: "info" };

  const recente =
    args.quandoMs !== null && agora - args.quandoMs >= 0 && agora - args.quandoMs < NOTICIA_VALE_MS;

  if (recente && args.tipo === "volume") {
    return { texto: `Volume${onde} montado`, tom: "quieto" };
  }

  if (recente && args.tipo === "auditoria") {
    return { texto: `Auditoria${onde} concluída`, tom: "quieto" };
  }

  /*
   * O REPOUSO, e ele NÃO é "tudo em dia".
   *
   * "Tudo em dia" é uma afirmação sobre o TRABALHO, e a legenda não fala de
   * trabalho — fala do motor. Numa conta com onze achados parados, "tudo em
   * dia" seria falso a dois dedos de uma faixa dizendo o contrário.
   */
  return { texto: "Nenhum processo em andamento", tom: "quieto" };
}
