/**
 * QUANDO A CONVERSA VAI AO DISCO — o debounce e o flush do `conversation-store`.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru do
 * `test:agenda-de-gravacao`, com um relógio de mentira no lugar do
 * `setTimeout`.
 *
 * `gravar` e `conversaAtual` são passados a cada chamada, e não na criação: o
 * store cria a agenda uma vez só (num `useState`), e ali não pode tocar o
 * `snapshotRef` — o lint do React Compiler barra ref lida durante o render.
 */

export type Relogio = {
  armar: (fn: () => void, ms: number) => unknown;
  desarmar: (alca: unknown) => void;
};

const RELOGIO_DO_NAVEGADOR: Relogio = {
  armar: (fn, ms) => setTimeout(fn, ms),
  desarmar: (alca) => clearTimeout(alca as ReturnType<typeof setTimeout>),
};

export type AgendaDeGravacao = {
  /**
   * Grava `esperaMs` depois da ÚLTIMA chamada. Devolve uma geração, como
   * `gravarJa`: quem chama põe no estado do React na mesma volta, e é assim que
   * `geracaoSemCommit` sabe se a mudança já chegou a um commit.
   */
  agendar: (gravar: () => void) => number;
  /**
   * A última geração entregue (debounce ou flush), se nenhum commit a
   * sincronizou ainda; `null` se não há mudança pendente. É o que
   * `comecarNovaConversa` espera antes de dar o flush e trocar de conversa: o
   * commit que traz ESTA geração traz a mudança, porque as duas entraram no
   * estado na mesma volta (e na mesma faixa de prioridade do React).
   */
  geracaoSemCommit: () => number | null;
  /**
   * Grava AGORA e pede outra gravação para o commit que trouxer a geração
   * devolvida. Quem chama PRECISA pôr essa geração no estado do React na mesma
   * volta (`setGeracao(devolvida)`) — é isso que amarra o pedido ao commit que
   * carrega a mudança. `conversaAtual` devolve o id que está no snapshot.
   */
  gravarJa: (gravar: () => void, conversaAtual: () => string) => number;
  /**
   * Chamado pelo store DEPOIS de copiar o estado comitado para o snapshot, com
   * a geração que ESSE commit carrega. Cumpre o pedido só se o commit já tem a
   * geração pedida e a conversa ainda é a mesma.
   */
  aoSincronizar: (
    gravar: () => void,
    conversaAtual: () => string,
    geracaoComitada: number,
  ) => void;
  /** Resolve quando um commit com `geracao` sincronizar (ou em `limiteMs`). */
  proximaSincronizacao: (geracao: number, limiteMs: number) => Promise<void>;
  /**
   * O snapshot vai começar a receber campos da conversa `para` com o id ainda
   * da anterior. Esquece o pedido pendente e, até o commit que trouxer `para`
   * sincronizar, nenhuma gravação lê o snapshot: `gravarJa` e o debounce só
   * deixam um pedido para `para`, cumprido pelo commit dela.
   */
  comecarTroca: (para: string) => void;
  /**
   * A conversa para a qual a troca começou e cujo commit ainda não sincronizou;
   * `null` fora de troca. É a conversa aberta DE FATO nessa janela: o snapshot
   * ainda tem o id da anterior (ver `conversaAberta` no store).
   */
  destinoDaTroca: () => string | null;
  /**
   * A conversa aberta DE FATO, dado o id do snapshot: o destino da troca em
   * curso, ou o próprio snapshot. Quem pergunta "é a conversa aberta?" —
   * `conversaAberta()` e `marcarConflito` no store — usa esta mesma regra.
   */
  abertaAgora: (idDoSnapshot: string) => string;
  /** Larga tudo o que estava para ser gravado: debounce e pedido. */
  descartar: () => void;
};

export function criarAgendaDeGravacao(opcoes: {
  esperaMs: number;
  relogio?: Relogio;
}): AgendaDeGravacao {
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR;
  let alca: unknown = null;
  /** Última geração entregue a um `gravarJa` ou `agendar`. */
  let geracoes = 0;
  /** A maior geração que um commit já sincronizou. */
  let comitada = 0;
  /** O pedido pós-commit: para qual conversa e a partir de qual geração. */
  let pedido: { conversa: string; geracao: number } | null = null;
  let esperando: { geracao: number; resolver: () => void }[] = [];
  /**
   * A conversa para a qual o snapshot está sendo trocado, entre as escritas à
   * mão da troca e o commit que traz o id dela (ver `comecarTroca`).
   */
  let trocandoPara: string | null = null;

  function desarmar() {
    if (alca !== null) {
      relogio.desarmar(alca);
      alca = null;
    }
  }

  return {
    agendar(gravar) {
      desarmar();
      geracoes += 1;
      alca = relogio.armar(() => {
        alca = null;
        // No meio de uma troca o snapshot é metade de cada conversa: o commit
        // da conversa nova é quem grava.
        if (trocandoPara !== null) {
          /*
           * Qualquer commit da conversa nova cumpre: a geração é a última já
           * comitada, e não a deste debounce — ela entra no estado junto com a
           * mudança, e o commit que a traz pode ser o de antes da troca.
           */
          pedido = { conversa: trocandoPara, geracao: comitada };
          return;
        }
        gravar();
      }, opcoes.esperaMs);
      return geracoes;
    },
    geracaoSemCommit() {
      return geracoes > comitada ? geracoes : null;
    },
    gravarJa(gravar, conversaAtual) {
      /*
       * A GRAVAÇÃO IMEDIATA ESPERA O ESTADO NOVO — 14/09/2026.
       *
       * O snapshot que `gravar` lê só recebe o estado no effect, DEPOIS do
       * commit do React. Quem chama o flush acabou de mudar estado na mesma
       * volta — e o que ele não escreveu à mão no snapshot ainda não está lá.
       * Medido na jornada a3 (reauditar o 117_25): `saveResult` da rodada 2
       * agendava, `marcarAuditoriaPendente(null)` gravava já, o flush cancelava
       * o debounce e a rodada 2 ficava na tela com só a rodada 1 no disco. O
       * mesmo desenho perdia o título que `salvarDossieDoMemorial` troca por
       * `setTitle` logo antes do flush.
       *
       * Então: grava agora (o que foi escrito à mão vale já — é o bilhete que
       * um F5 no segundo seguinte precisa achar) e PEDE outra gravação.
       *
       * O PEDIDO TEM GERAÇÃO (segunda rodada da revisão, 14/09/2026). Cumprido
       * pelo "próximo effect", ele foi cumprido pelo effect ERRADO: effects
       * rodam dos filhos para o pai, e `use-reconectar-auditoria` limpa o
       * bilhete de dentro de um effect. O effect do provider que rodava logo em
       * seguida era o do commit ANTERIOR — recopiava o bilhete velho para o
       * snapshot e gravava ele, e o commit com o bilhete nulo não tinha mais
       * pedido. O bilhete ficava no disco e todo F5 reabria a conversa. A
       * geração vai para o estado do React junto com a mudança, então só o
       * commit que a traz pode cumprir o pedido.
       *
       * NO MEIO DE UMA TROCA NÃO GRAVA NADA AGORA (revisão final, 15/09/2026,
       * jornada c6). Entre as escritas à mão de `selectConversation` e o commit
       * da conversa nova, o snapshot tem o id da ANTERIOR com o memorial e o
       * `createdAt` da nova. Medido: o palco limpou o bilhete residual da nova
       * dentro do commit da troca e a anterior foi gravada com o memorial da
       * nova (e a nova ficou com o bilhete no disco); no F5, a segunda abertura
       * da mesma conversa gravou um registro fantasma. Aí só fica o pedido,
       * para a conversa nova, cumprido pelo commit dela.
       */
      desarmar();
      geracoes += 1;
      if (trocandoPara !== null) {
        pedido = { conversa: trocandoPara, geracao: geracoes };
        return geracoes;
      }
      gravar();
      pedido = { conversa: conversaAtual(), geracao: geracoes };
      return geracoes;
    },
    aoSincronizar(gravar, conversaAtual, geracaoComitada) {
      comitada = Math.max(comitada, geracaoComitada);
      // O commit da conversa nova chegou ao snapshot: a troca acabou.
      if (trocandoPara !== null && conversaAtual() === trocandoPara)
        trocandoPara = null;
      // Um commit de ANTES da troca não cumpre nem descarta o pedido dela.
      if (
        trocandoPara === null &&
        pedido !== null &&
        geracaoComitada >= pedido.geracao
      ) {
        const cumprir = pedido.conversa === conversaAtual();
        pedido = null;
        if (cumprir) gravar();
      }
      const prontos = esperando.filter((e) => geracaoComitada >= e.geracao);
      esperando = esperando.filter((e) => geracaoComitada < e.geracao);
      for (const e of prontos) e.resolver();
    },
    proximaSincronizacao(geracao, limiteMs) {
      return new Promise<void>((resolve) => {
        let limite: unknown = null;
        const entrada = {
          geracao,
          resolver: () => {
            if (limite !== null) relogio.desarmar(limite);
            limite = null;
            esperando = esperando.filter((e) => e !== entrada);
            resolve();
          },
        };
        esperando.push(entrada);
        limite = relogio.armar(() => {
          limite = null;
          entrada.resolver();
        }, limiteMs);
      });
    },
    comecarTroca(para) {
      pedido = null;
      trocandoPara = para;
    },
    destinoDaTroca() {
      return trocandoPara;
    },
    abertaAgora(idDoSnapshot) {
      return trocandoPara ?? idDoSnapshot;
    },
    descartar() {
      desarmar();
      pedido = null;
    },
  };
}
