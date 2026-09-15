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
   * O atualizador do estado do React para a geração `nova`, que quem chama
   * passa ao setter NA MESMA VOLTA da mudança: `setGeracoes(juntarGeracao(g))`.
   * O estado guarda a LISTA das gerações ainda sem commit — é ela que o commit
   * entrega a `aoSincronizar`, e não a maior (ver `aoSincronizar`). As que já
   * sincronizaram saem da lista aqui: o que conta é o que a agenda sabia NA
   * CHAMADA, e uma geração que já sincronizou nunca volta a faltar.
   */
  juntarGeracao: (nova: number) => (atual: readonly number[]) => number[];
  /**
   * A maior geração entregue (debounce ou flush) se alguma ainda não chegou a
   * um commit; `null` se não há mudança pendente. É o que `comecarNovaConversa`
   * espera antes de dar o flush e trocar de conversa — e esperar por ela é
   * esperar por TODAS até ela (ver `proximaSincronizacao`).
   */
  geracaoSemCommit: () => number | null;
  /**
   * Grava AGORA e pede outra gravação para o commit que trouxer a geração
   * devolvida. Quem chama PRECISA pôr essa geração no estado do React na mesma
   * volta (`setGeracoes(juntarGeracao(devolvida))`) — é isso que amarra o
   * pedido ao commit que carrega a mudança. `conversaAtual` devolve o id que
   * está no snapshot.
   */
  gravarJa: (gravar: () => void, conversaAtual: () => string) => number;
  /**
   * Chamado pelo store DEPOIS de copiar o estado comitado para o snapshot, com
   * as gerações que ESSE commit carrega. Cumpre o pedido só quando nenhuma
   * geração até a dele falta chegar a um commit, e a conversa ainda é a mesma.
   */
  aoSincronizar: (
    gravar: () => void,
    conversaAtual: () => string,
    geracoesComitadas: readonly number[],
  ) => void;
  /**
   * Resolve quando todas as gerações entregues até `geracao` tiverem chegado a
   * um commit (ou em `limiteMs`).
   */
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
  /*
   * AS GERAÇÕES ENTREGUES QUE NENHUM COMMIT TROUXE AINDA — e não "a maior que
   * sincronizou" (15/09/2026, a suspeita aberta da última onda da frente A).
   * Com a maior, um commit com a geração g+1 dizia que g já tinha chegado. Não
   * diz: o React comita a faixa síncrona na hora, PULANDO o que é da faixa
   * padrão. Uma mudança de continuação assíncrona (`await saveResult(...)`, g)
   * seguida do flush de outro gesto num clique (g+1) comitava g+1 sem a
   * mudança — a espera de "Nova conversa" e da abertura resolvia cedo, e o
   * pedido do flush (que desarmou o debounce de g) era cumprido sem ela; nada
   * mais a gravava. A mudança e a geração dela entram no estado na mesma volta,
   * portanto na mesma faixa e no mesmo commit: o commit que traz a geração traz
   * a mudança, e só ele a tira daqui.
   */
  const semCommit = new Set<number>();
  /** Nenhuma geração entregue até `geracao` falta chegar a um commit. */
  const chegaramAte = (geracao: number) => {
    for (const g of semCommit) if (g <= geracao) return false;
    return true;
  };
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
      semCommit.add(geracoes);
      alca = relogio.armar(() => {
        alca = null;
        // No meio de uma troca o snapshot é metade de cada conversa: o commit
        // da conversa nova é quem grava.
        if (trocandoPara !== null) {
          /*
           * Qualquer commit da conversa nova cumpre: a geração 0 não espera
           * nenhuma, e não a deste debounce — ela entra no estado junto com a
           * mudança, e o commit que a traz pode ser o de antes da troca.
           */
          pedido = { conversa: trocandoPara, geracao: 0 };
          return;
        }
        gravar();
      }, opcoes.esperaMs);
      return geracoes;
    },
    juntarGeracao(nova) {
      const faltavam = new Set(semCommit);
      return (atual) => [...atual.filter((g) => faltavam.has(g)), nova];
    },
    geracaoSemCommit() {
      let maior: number | null = null;
      for (const g of semCommit) if (maior === null || g > maior) maior = g;
      return maior;
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
      semCommit.add(geracoes);
      if (trocandoPara !== null) {
        pedido = { conversa: trocandoPara, geracao: geracoes };
        return geracoes;
      }
      gravar();
      pedido = { conversa: conversaAtual(), geracao: geracoes };
      return geracoes;
    },
    aoSincronizar(gravar, conversaAtual, geracoesComitadas) {
      for (const g of geracoesComitadas) semCommit.delete(g);
      // O commit da conversa nova chegou ao snapshot: a troca acabou.
      if (trocandoPara !== null && conversaAtual() === trocandoPara)
        trocandoPara = null;
      /*
       * Um commit de ANTES da troca não cumpre nem descarta o pedido dela. E o
       * pedido espera TODAS as gerações até a dele, não só a dele: o flush
       * desarmou o debounce das anteriores, e agora é ele quem as grava.
       */
      if (
        trocandoPara === null &&
        pedido !== null &&
        chegaramAte(pedido.geracao)
      ) {
        const cumprir = pedido.conversa === conversaAtual();
        pedido = null;
        if (cumprir) gravar();
      }
      const prontos = esperando.filter((e) => chegaramAte(e.geracao));
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
