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
   * Grava AGORA, e de novo logo depois do próximo commit da MESMA conversa.
   * `conversaAtual` devolve o id que está no snapshot no instante da leitura.
   */
  gravarJa: (gravar: () => void, conversaAtual: () => string) => void;
  /**
   * Chamado pelo store DEPOIS de copiar o estado comitado para o snapshot.
   * Cumpre o pedido do `gravarJa`, se ele ainda for desta conversa.
   */
  aoSincronizar: (gravar: () => void, conversaAtual: () => string) => void;
  /** Resolve no próximo `aoSincronizar` (ou em `limiteMs`, o que vier antes). */
  proximaSincronizacao: (limiteMs: number) => Promise<void>;
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
  /** A conversa para a qual um `gravarJa` pediu a gravação pós-commit. */
  let pedidoPara: string | null = null;
  let esperando: (() => void)[] = [];

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
       * `setTitle` logo antes do flush — sem debounce nenhum para rearmar.
       *
       * Então: grava agora (o que foi escrito à mão vale já — é o bilhete que
       * um F5 no segundo seguinte precisa achar) e PEDE outra gravação para o
       * primeiro commit depois daqui, se a conversa ainda for a mesma. O
       * debounce pendente sai: o pedido cobre a mesma mudança, e um timer
       * solto gravaria o snapshot de quem estivesse aberto meio segundo depois.
       */
      desarmar();
      gravar();
      pedidoPara = conversaAtual();
    },
    aoSincronizar(gravar, conversaAtual) {
      const pedido = pedidoPara;
      pedidoPara = null;
      const avisar = esperando;
      esperando = [];
      if (pedido !== null && pedido === conversaAtual()) gravar();
      for (const fn of avisar) fn();
    },
    proximaSincronizacao(limiteMs) {
      return new Promise<void>((resolve) => {
        let feito = false;
        const uma = () => {
          if (feito) return;
          feito = true;
          resolve();
        };
        esperando.push(uma);
        relogio.armar(uma, limiteMs);
      });
    },
    esquecerPedido() {
      pedidoPara = null;
    },
    descartar() {
      desarmar();
      pedidoPara = null;
    },
  };
}
