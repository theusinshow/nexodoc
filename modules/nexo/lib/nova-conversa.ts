/**
 * "NOVA CONVERSA" — a troca para uma conversa vazia, na ordem que não perde nada.
 *
 * Extraída de `newConversation` (conversation-store.tsx) em 15/09/2026, depois
 * da segunda rodada, para fechar as duas suspeitas abertas da onda final. Teste
 * em `scripts/test-nova-conversa.ts`.
 *
 * 1. A MUDANÇA DO MESMO TICK. `newConversation` dava o flush e trocava o estado
 *    na mesma volta. O flush grava o snapshot, que só recebe o estado no commit;
 *    uma mudança agendada logo antes (`await saveResult(...)` e, em seguida,
 *    "Nova conversa") chegava ao React JUNTO com a troca, e o commit que a
 *    trazia já trazia o id novo — ela nunca era gravada na conversa que saía.
 *    Agora, se há mudança sem commit (`geracaoSemCommit`), a troca espera o
 *    commit QUE A TRAZ, e só então dá o flush (ver abaixo); sem mudança
 *    pendente (o caso normal: o clique vem muito depois do último commit), ela
 *    continua saindo na mesma volta, e a tela não muda de ritmo.
 * 2. A ÚLTIMA ABERTURA VENCE também contra "Nova conversa": ela pega a vez em
 *    `aberturas`, e a abertura do F5 que ainda espera a lista do servidor
 *    desiste em vez de trocar por cima. E se, enquanto "Nova conversa" espera o
 *    commit, alguém abrir outra conversa, vale a abertura.
 *
 * `descartar` (a conversa aberta acabou de ser apagada) larga o pendente e
 * troca na hora: não há mudança a salvar.
 *
 * PURO: só tipos de fora. Roda no node cru.
 */
import type { AgendaDeGravacao } from "./agenda-de-gravacao.ts";

export function comecarNovaConversa(args: {
  agenda: AgendaDeGravacao;
  aberturas: { comecar: () => number; valeAinda: (n: number) => boolean };
  descartar: boolean;
  /** O `flushPersist` do store: grava já e devolve a geração do pedido. */
  flush: () => number;
  idNovo: string;
  /** Zera o estado da conversa (os `set*` do store). */
  zerar: () => void;
  /** Quanto esperar o commit, no máximo: trocar de conversa nunca trava. */
  limiteMs?: number;
}): Promise<void> {
  const minha = args.aberturas.comecar();
  const trocar = () => {
    // Daqui até o commit, o snapshot tem o id da antiga com a guarda de vazia e
    // o `createdAt` da nova: nada grava a partir dele (ver `comecarTroca`).
    args.agenda.comecarTroca(args.idNovo);
    args.zerar();
  };
  if (args.descartar) {
    args.agenda.descartar();
    trocar();
    return Promise.resolve();
  }
  const pendente = args.agenda.geracaoSemCommit();
  if (pendente === null) {
    args.flush();
    trocar();
    return Promise.resolve();
  }
  /*
   * ESPERA O COMMIT DA MUDANÇA, E SÓ ENTÃO O FLUSH (revisão da frente A,
   * 15/09/2026). A primeira versão dava o flush antes e esperava o commit DELE.
   * Só que o "Nova conversa" da tela roda dentro de `flushSync`: a geração do
   * flush ia na faixa síncrona e comitava na hora, SEM a mudança pendente da
   * faixa padrão (`await saveResult(...)`). A espera resolvia, A era gravada
   * sem a mudança, e a troca chegava junto com ela. Esperando a geração que
   * entrou no estado junto com a mudança, o commit que resolve é o que a traz.
   */
  return args.agenda
    .proximaSincronizacao(pendente, args.limiteMs ?? 1000)
    .then(() => {
      if (!args.aberturas.valeAinda(minha)) return;
      args.flush();
      trocar();
    });
}
