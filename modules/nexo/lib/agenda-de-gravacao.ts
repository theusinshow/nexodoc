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
   * Grava AGORA. `conversaAtual` devolve o id da conversa aberta no instante
   * da leitura — é o que impede a gravação rearmada de escrever outra conversa.
   */
  gravarJa: (gravar: () => void, conversaAtual: () => string) => void;
  /** Larga a gravação pendente sem gravar. */
  descartar: () => void;
};

export function criarAgendaDeGravacao(opcoes: {
  esperaMs: number;
  relogio?: Relogio;
}): AgendaDeGravacao {
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR;
  let alca: unknown = null;

  function descartar() {
    if (alca !== null) {
      relogio.desarmar(alca);
      alca = null;
    }
  }

  return {
    agendar(gravar) {
      descartar();
      alca = relogio.armar(() => {
        alca = null;
        gravar();
      }, opcoes.esperaMs);
    },
    gravarJa(gravar, conversaAtual) {
      /*
       * O FLUSH NÃO ENGOLE O DEBOUNCE — 14/09/2026.
       *
       * O snapshot que `gravar` lê só acompanha o estado DEPOIS do commit do
       * React. Um debounce pendente quer dizer "há mudança que talvez ainda
       * não esteja no snapshot", e cancelá-lo deixava o flush gravar o velho
       * sem ninguém gravar o novo depois. Medido na jornada a3 (reauditar o
       * 117_25): `saveResult` da rodada 2 agendava, `marcarAuditoriaPendente
       * (null)` gravava já na mesma volta, e a rodada 2 aparecia na tela com
       * só a rodada 1 no disco — um F5 sem a rede de recuperação a perdia.
       *
       * Então grava agora (o campo que o flush escreveu à mão vale já) e
       * REARMA a gravação pendente, que lê o snapshot depois do commit. Ela
       * só vale para a MESMA conversa: `selectConversation`/`newConversation`
       * gravam já e trocam de id, e a gravação rearmada escreveria a conversa
       * recém-aberta — mexendo no `updatedAt` de quem só foi olhada.
       */
      const havia = alca !== null;
      descartar();
      gravar();
      if (!havia) return;
      const conversa = conversaAtual();
      alca = relogio.armar(() => {
        alca = null;
        if (conversaAtual() === conversa) gravar();
      }, opcoes.esperaMs);
    },
    descartar,
  };
}
