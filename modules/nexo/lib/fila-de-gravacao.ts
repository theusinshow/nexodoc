/**
 * A FILA DE GRAVAÇÃO DA CONVERSA — e a trava da aba desatualizada.
 *
 * Decidido pelo Matheus em 15/09/2026 (cenário C3 da bateria): a aba que abriu
 * a conversa antes de outra aba (ou máquina) mudá-la é RECUSADA, avisa e
 * oferece recarregar, sem sobrescrever. Medido na jornada c3 (Tarefa 14): a
 * aba 2 abriu a conversa antes do parecer, a aba 1 auditou, a aba 2 gravou
 * depois com hora nova e conteúdo velho, e o parecer sumiu do servidor e do
 * IndexedDB que as duas dividem.
 *
 * A BASE é o `updatedAt` que a aba leu ao abrir a conversa (`abrir`), ou o da
 * última gravação dela que o disco (ou o servidor) confirmou.
 *
 * NO DISCO, a checagem é lida NA HORA DE EXECUTAR, não na de enfileirar (achado
 * da pré-revisão, 15/09/2026). O store grava em dupla (`gravarJa`: agora e de
 * novo no commit). Conferindo a trava e avançando a base ao enfileirar, a
 * primeira achava o disco mais novo e travava — mas a segunda já tinha passado
 * pela trava com a base avançada para a hora da primeira, mais nova que a da
 * outra aba, e gravava por cima do parecer. Aqui a base só avança quando a
 * gravação chega, e cada trabalho confere a trava e o disco quando é a vez dele.
 *
 * NO SERVIDOR, a ida sai NA HORA, sem esperar a fila (15/09/2026, regressão da
 * auditoria: qualquer espera antes do `fetch` custou um quadro de render, ~50ms
 * medidos, e as últimas gravações da a1 — o bilhete limpo e o parecer — eram
 * cortadas quando a aba fechava; em 4 corridas, 3 deixaram o servidor com o
 * bilhete, contra 0 de 4 sem a fila). Para a base não precisar avançar antes da
 * resposta, a ida leva junto AS PRÓPRIAS: as versões que esta aba já mandou e
 * ninguém confirmou. A rota recusa guardado mais novo que a base que não seja
 * uma delas (`gravacaoDesatualizada`) — e isso vale em qualquer ordem de
 * chegada, inclusive para a segunda gravação da aba parada, cuja base continua
 * a velha.
 *
 * SEM IMPORTS de runtime além da regra pura: roda no node cru do
 * `test:fila-de-gravacao`. Os ganchos de disco e servidor vêm a cada chamada,
 * como na `agenda-de-gravacao.ts`, porque o store cria a fila uma vez só.
 */
import { gravacaoDesatualizada } from "../../../server/nexo/conversa-remota.ts";

export type OrigemDoConflito = "disco" | "servidor";

type Registro = { id: string; updatedAt: number };

/** Quantas próprias sem confirmação viajam, no máximo, no cabeçalho. */
const LIMITE_DE_PROPRIAS = 20;

export type GanchosDaGravacao<R extends Registro> = {
  /**
   * O `updatedAt` do registro que está no disco agora, se for mais novo que
   * `acimaDe` (senão pode devolver null: não há o que recusar).
   */
  lerVersaoNoDisco: (id: string, acimaDe: number) => Promise<number | null>;
  /** Grava no disco; rejeita quando falha. */
  gravarNoDisco: (rec: R) => Promise<void>;
  depoisDoDisco: (rec: R, ok: boolean) => void;
  /**
   * Dispara a ida ao servidor — chamado dentro de `gravar`, sem espera nenhuma.
   * `base` é a versão confirmada; `proprias`, as mandadas desde ela. A promessa
   * diz o que o servidor fez: a fila confirma a base ou trava e desce a cópia.
   */
  enviarAoServidor: (
    rec: R,
    base: number | null,
    proprias: readonly number[],
  ) => Promise<RespostaDoServidor>;
  /** A cópia que o servidor guarda desta conversa (null se não deu para ler). */
  lerDoServidor: (id: string) => Promise<R | null>;
  /** A conversa travou (disco mais novo que a base, ou 409 do servidor). */
  aoConflito: (id: string, origem: OrigemDoConflito) => void;
  /** A cópia do servidor desceu para o disco, depois de um 409. */
  aoDescer?: (id: string) => void;
};

/** "outra" é tudo que não confirma nem recusa: desligada, falha, expurgada. */
export type RespostaDoServidor = "ok" | "desatualizada" | "outra";

export type FilaDeGravacao<R extends Registro> = {
  /**
   * Manda ao servidor agora e enfileira o disco. A promessa resolve quando a
   * gravação no disco termina (ou é largada); nunca rejeita.
   */
  gravar: (rec: R, ganchos: GanchosDaGravacao<R>) => Promise<void>;
  /**
   * A conversa foi (re)aberta e a tela vai mostrar a `versao` lida. Destrava;
   * se estava travada, larga o que ainda está na fila dela (é da tela velha).
   */
  abrir: (id: string, versao: number) => void;
  /** O servidor aceitou esta versão: ela também é base desta aba. */
  confirmar: (id: string, versao: number) => void;
  /** Trava por fora da fila (o 409 do servidor). */
  travar: (id: string, origem: OrigemDoConflito) => void;
  travada: (id: string) => OrigemDoConflito | null;
  /** Resolve quando o que está na fila agora terminar. */
  ociosa: () => Promise<void>;
};

export function criarFilaDeGravacao<R extends Registro>(
  opcoes: { registrarFalha?: (erro: unknown) => void } = {},
): FilaDeGravacao<R> {
  const registrarFalha =
    opcoes.registrarFalha ??
    ((erro: unknown) =>
      console.error("[nexo] gravação da conversa falhou na fila", erro));
  const bases = new Map<string, number>();
  const travadas = new Map<string, OrigemDoConflito>();
  /**
   * A época de cada conversa sobe quando uma conversa TRAVADA é recarregada.
   * Um trabalho enfileirado antes disso carrega o conteúdo da tela velha, e
   * sem a época ele passaria pela checagem com a base recém-lida e gravaria
   * por cima do que a recarga acabou de trazer.
   */
  const epocas = new Map<string, number>();
  /** A hora da última gravação mandada de cada conversa. */
  const horas = new Map<string, number>();
  /** As versões mandadas ao servidor e ainda não confirmadas, por conversa. */
  const pendentes = new Map<string, number[]>();
  let cauda: Promise<void> = Promise.resolve();

  /** Para cada conversa, a época em que a cópia do servidor já foi pedida. */
  const descidas = new Map<string, number>();

  const epocaMudou = (id: string, epoca: number) =>
    epoca !== (epocas.get(id) ?? 0);
  const largar = (id: string, epoca: number) =>
    travadas.has(id) || epocaMudou(id, epoca);

  /*
   * O 409 DO SERVIDOR DESCE A CÓPIA DELE PARA O DISCO — revisão da Tarefa 15,
   * 15/09/2026. Quando quem gravou antes foi OUTRA MÁQUINA, o disco desta não
   * tem nada mais novo: a checagem do disco passa e a gravação parada chega ao
   * disco centenas de ms antes do 409. A trava só vive na memória; um F5
   * reabria do disco (a cópia parada, com hora mais nova que a do servidor),
   * ela virava a base, e a gravação seguinte passava na rota e apagava o
   * trabalho da outra máquina. Com a cópia do servidor no disco, qualquer
   * reabertura — F5, outra aba local — parte da versão certa.
   *
   * Pela fila, atrás do que ainda estava para gravar, e só se ninguém gravou o
   * disco depois desta aba: se outra aba LOCAL gravou (o disco tem versão mais
   * nova que a base), é a dela que vale, e o servidor pode estar atrasado.
   */
  function descerCopiaDoServidor(
    id: string,
    epoca: number,
    g: GanchosDaGravacao<R>,
  ) {
    if (descidas.get(id) === epoca) return;
    descidas.set(id, epoca);
    cauda = cauda
      .then(async () => {
        if (epocaMudou(id, epoca)) return;
        const base = bases.get(id);
        if (base !== undefined) {
          const deOutraAba = await g
            .lerVersaoNoDisco(id, base)
            .catch((erro) => {
              registrarFalha(erro);
              return null;
            });
          if (deOutraAba !== null) return;
        }
        const copia = await g.lerDoServidor(id);
        if (!copia || epocaMudou(id, epoca)) return;
        await g.gravarNoDisco(copia);
        g.aoDescer?.(id);
      })
      .catch(registrarFalha);
  }

  function responder(
    id: string,
    epoca: number,
    versao: number,
    resposta: RespostaDoServidor,
    g: GanchosDaGravacao<R>,
  ) {
    // Resposta de uma gravação de antes da recarga: a tela já é outra.
    if (epocaMudou(id, epoca)) return;
    if (resposta === "ok") {
      avancar(id, versao);
      return;
    }
    if (resposta !== "desatualizada") return;
    const antes = travadas.get(id);
    if (antes === undefined) travadas.set(id, "servidor");
    g.aoConflito(id, antes ?? "servidor");
    if (antes !== "disco") descerCopiaDoServidor(id, epoca, g);
  }

  function avancar(id: string, versao: number) {
    const base = Math.max(bases.get(id) ?? versao, versao);
    bases.set(id, base);
    const restantes = (pendentes.get(id) ?? []).filter((v) => v > base);
    pendentes.set(id, restantes);
  }

  return {
    gravar(rec, g) {
      if (travadas.has(rec.id)) return cauda;
      const epoca = epocas.get(rec.id) ?? 0;
      const base = bases.get(rec.id) ?? null;
      /*
       * A HORA DE CADA GRAVAÇÃO É ESTRITAMENTE CRESCENTE — 15/09/2026,
       * regressão da a3. As duas gravações de `gravarJa` saíam no mesmo
       * milissegundo, e as idas ao servidor não esperam uma pela outra: a
       * segunda chegou antes, a primeira achou guardado IGUAL à hora dela (a
       * regra "mais velha é ignorada" não pega empate) e mais novo que a base
       * dela — 409 contra a própria aba, a conversa travou e o parecer nunca
       * chegou ao disco. Com a hora sempre maior que a anterior, a que chega
       * atrasada é só "mais velha", e a rota a ignora.
       */
      const anterior = Math.max(
        base ?? -Infinity,
        horas.get(rec.id) ?? -Infinity,
      );
      const gravado =
        rec.updatedAt > anterior
          ? rec
          : ({ ...rec, updatedAt: anterior + 1 } as R);
      horas.set(rec.id, gravado.updatedAt);

      const proprias = (pendentes.get(rec.id) ?? []).filter(
        (v) => base === null || v > base,
      );
      try {
        g.enviarAoServidor(gravado, base, proprias)
          .then((r) => responder(rec.id, epoca, gravado.updatedAt, r, g))
          .catch(registrarFalha);
      } catch (erro) {
        registrarFalha(erro);
      }
      pendentes.set(
        rec.id,
        [...proprias, gravado.updatedAt].slice(-LIMITE_DE_PROPRIAS),
      );

      cauda = cauda
        .then(async () => {
          if (largar(rec.id, epoca)) return;
          // Sem base (conversa nova), a checagem nunca recusa: nem lê o disco.
          const baseDaLeitura = bases.get(rec.id);
          const noDisco =
            baseDaLeitura !== undefined
              ? await g
                  .lerVersaoNoDisco(rec.id, baseDaLeitura)
                  .catch((erro) => {
                    // Falha aberta (grava sem conferir), mas não calada.
                    registrarFalha(erro);
                    return null;
                  })
              : null;
          // A leitura é assíncrona: a trava e a base são as de DEPOIS dela.
          if (largar(rec.id, epoca)) return;
          if (
            gravacaoDesatualizada({
              guardada: noDisco,
              base: bases.get(rec.id) ?? null,
            })
          ) {
            travadas.set(rec.id, "disco");
            g.aoConflito(rec.id, "disco");
            return;
          }
          const gravou = await g.gravarNoDisco(gravado).then(
            () => true,
            () => false,
          );
          /*
           * A base só avança com a gravação NO DISCO. Se ela falhou, o disco
           * segue na versão velha, e avançar a base deixaria passar sem aviso o
           * que outra aba gravar entre as duas horas.
           */
          if (gravou) avancar(rec.id, gravado.updatedAt);
          g.depoisDoDisco(gravado, gravou);
        })
        /*
         * Um trabalho que estoura não pode travar a fila inteira: numa cadeia de
         * `then`, uma rejeição pula todos os seguintes, e a conversa pararia de
         * gravar em silêncio. Registra e segue.
         */
        .catch(registrarFalha);
      return cauda;
    },
    abrir(id, versao) {
      if (travadas.has(id)) {
        travadas.delete(id);
        epocas.set(id, (epocas.get(id) ?? 0) + 1);
        bases.set(id, versao);
        const restantes = (pendentes.get(id) ?? []).filter((v) => v > versao);
        pendentes.set(id, restantes);
        return;
      }
      /*
       * Em dia, a base não recua: uma gravação desta aba pode ter chegado ao
       * disco depois da leitura da reabertura, e voltar a base para trás dela
       * travaria a aba contra ela mesma.
       */
      avancar(id, versao);
    },
    confirmar(id, versao) {
      avancar(id, versao);
    },
    travar(id, origem) {
      // A primeira origem fica: é ela que diz de onde recarregar.
      if (!travadas.has(id)) travadas.set(id, origem);
    },
    travada(id) {
      return travadas.get(id) ?? null;
    },
    ociosa() {
      return cauda;
    },
  };
}
