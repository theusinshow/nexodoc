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
  /** Grava `esperaMs` depois da ÚLTIMA chamada. */
  agendar: (gravar: () => void) => void;
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
   * Esquece o pedido pendente sem gravar. Para quando o snapshot vai começar a
   * receber campos de OUTRA conversa: dali em diante nada pode ser gravado sob
   * o id antigo a partir dele.
   */
  esquecerPedido: () => void;
  /** Larga tudo o que estava para ser gravado: debounce e pedido. */
  descartar: () => void;
};

export function criarAgendaDeGravacao(opcoes: {
  esperaMs: number;
  relogio?: Relogio;
}): AgendaDeGravacao {
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR;
  let alca: unknown = null;
  /** Última geração entregue a um `gravarJa`. */
  let geracoes = 0;
  /** O pedido pós-commit: para qual conversa e a partir de qual geração. */
  let pedido: { conversa: string; geracao: number } | null = null;
  let esperando: { geracao: number; resolver: () => void }[] = [];

  function desarmar() {
    if (alca !== null) {
      relogio.desarmar(alca);
      alca = null;
    }
  }

  return {
    agendar(gravar) {
      desarmar();
      alca = relogio.armar(() => {
        alca = null;
        gravar();
      }, opcoes.esperaMs);
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
       */
      desarmar();
      gravar();
      geracoes += 1;
      pedido = { conversa: conversaAtual(), geracao: geracoes };
      return geracoes;
    },
    aoSincronizar(gravar, conversaAtual, geracaoComitada) {
      if (pedido !== null && geracaoComitada >= pedido.geracao) {
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
    esquecerPedido() {
      pedido = null;
    },
    descartar() {
      desarmar();
      pedido = null;
    },
  };
}
