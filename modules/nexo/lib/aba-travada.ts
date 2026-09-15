/**
 * A ABA TRAVADA NÃO GASTA — revisão final da segunda rodada, 15/09/2026.
 *
 * `conflitoDeVersao` acende quando outra aba (ou máquina) gravou a conversa
 * depois que esta a abriu (jornada c3). Desde então a fila de gravação desta aba
 * descarta tudo (`fila-de-gravacao.ts`) — mas auditoria, agente e LD seguiam
 * ligados: a auditoria paga rodava até o fim e o parecer nunca era registrado.
 *
 * A regra fica aqui, pura, para o botão de confirmar, o `confirm` da auditoria e
 * o envio do chat lerem a MESMA decisão e a MESMA frase — a da faixa.
 *
 * AS DUAS ORIGENS DA TRAVA — 15/09/2026, depois da segunda rodada. Nem toda
 * trava prova que outra aba gravou. Com a base aberta do disco SEM conferir o
 * servidor (a marca "manter" de `abertura-da-conversa.ts`), um 409 pode ser a
 * gravação atrasada desta mesma aba: a fila trava sem descer a cópia do
 * servidor, justamente porque não sabe. A faixa, porém, dizia "Esta conversa
 * mudou em outra aba" — falso ali —, e o único botão ("Recarregar a conversa")
 * trocava o disco pela cópia do servidor, apagando as edições que só existem
 * nesta máquina. Agora a frase diz o que se sabe, e a recarga que pode apagar
 * pede confirmação.
 *
 * PURO e sem imports: roda no node cru.
 */
export const MOTIVO_ABA_TRAVADA =
  "Esta conversa mudou em outra aba. Recarregue a conversa para continuar — daqui, nada fica salvo.";

/**
 * O gesto foi recusado porque OUTRA conversa foi aberta enquanto ele era
 * conferido com o servidor — não há trava nenhuma (última onda da frente A).
 */
export const MOTIVO_TROCOU_DE_CONVERSA =
  "Outra conversa foi aberta enquanto isto era conferido com o servidor. Nada foi gasto — volte à conversa e tente de novo.";

export const MOTIVO_SEM_CONFERIR =
  "Não deu para confirmar com o servidor se esta conversa é a mais nova. Recarregue do servidor para continuar — daqui, nada fica salvo.";

/**
 * "outra-aba": outra aba ou máquina gravou depois da base desta — provado (o
 * disco mais novo, ou o 409 com a base conferida). "sem-conferir": o 409 veio
 * com a base não conferida, e pode ter sido esta própria aba.
 */
export type OrigemDaTrava = "outra-aba" | "sem-conferir";

/** A origem, pelo que a fila de gravação disse ao travar (`aoConflito`). */
export function origemDaTrava(args: {
  origem: "disco" | "servidor";
  vaiDescer: boolean;
}): OrigemDaTrava {
  return args.origem === "servidor" && !args.vaiDescer ? "sem-conferir" : "outra-aba";
}

/**
 * A origem de uma conversa que ABRE travada, pela marca de recusa guardada:
 * "manter" é a do 409 sem base conferida; "descer" (ou nenhuma) é recusa provada.
 */
export function origemDaTravaAoAbrir(args: {
  marca: "descer" | "manter" | null;
  /** A fila sabe que a trava da memória veio sem conferir (vale sem a marca). */
  semConferir?: boolean;
  /** A origem que esta aba lembra da última trava desta conversa. */
  origemLembrada?: OrigemDaTrava | null;
}): OrigemDaTrava {
  /*
   * PROVADA FICA PROVADA (última onda da frente A, 15/09/2026). Recarregada pela
   * faixa com a rede fora, a base volta "não conferida" — mas quem gravou foi
   * outra aba ou máquina, e a marca "descer" (ou a origem lembrada) diz isso.
   */
  if (args.marca === "descer" || args.origemLembrada === "outra-aba") return "outra-aba";
  return args.marca === "manter" || args.semConferir === true ? "sem-conferir" : "outra-aba";
}

/**
 * A trava na memória é "sem conferir" para `decidirAbertura`? Só se a base não
 * foi conferida E nada prova outra aba: nem a marca "descer", nem a origem que
 * esta aba lembra. Sem isso, uma trava provada recarregada offline passava a
 * abrir do disco sem voltar ao servidor, com a frase errada.
 */
export function travaSemConferirAoAbrir(args: {
  travadaNaMemoria: boolean;
  baseConferida: boolean;
  marca: "descer" | "manter" | null;
  origemLembrada: OrigemDaTrava | null;
}): boolean {
  return (
    args.travadaNaMemoria &&
    !args.baseConferida &&
    args.marca !== "descer" &&
    args.origemLembrada !== "outra-aba"
  );
}

/** Uma trava provada não volta a "sem conferir"; a sem conferir pode ser provada depois. */
export function juntarOrigens(
  atual: OrigemDaTrava | null,
  nova: OrigemDaTrava,
): OrigemDaTrava {
  return atual === "outra-aba" ? atual : nova;
}

export function podeGastar(estado: { conflitoDeVersao: boolean }): boolean {
  return !estado.conflitoDeVersao;
}

export function motivoParaNaoGastar(estado: {
  conflitoDeVersao: boolean;
  origem?: OrigemDaTrava | null;
}): string | null {
  if (podeGastar(estado)) return null;
  return estado.origem === "sem-conferir" ? MOTIVO_SEM_CONFERIR : MOTIVO_ABA_TRAVADA;
}

/**
 * O motivo de um gesto recusado por `conferirAntesDeGastar`: a troca de
 * conversa no meio tem frase própria; a trava fala pela origem.
 */
export function motivoDaRecusaAntesDeGastar(args: {
  trocouDeConversa: boolean;
  origem: OrigemDaTrava | null;
}): string {
  if (args.trocouDeConversa) return MOTIVO_TROCOU_DE_CONVERSA;
  return args.origem === "sem-conferir" ? MOTIVO_SEM_CONFERIR : MOTIVO_ABA_TRAVADA;
}

/**
 * A LEITURA PAGA DO DROP (selo das pranchas, delta do memorial) numa aba
 * travada: `null` lê; o texto é o porquê de não ler. Síncrono de propósito — só
 * a trava já acesa, sem ida à rede: o drop não espera o servidor.
 */
export function recusaDeLeituraPaga(trava: OrigemDaTrava | null): string | null {
  return motivoParaNaoGastar({ conflitoDeVersao: trava !== null, origem: trava });
}

/** As frases da faixa de bloqueio, por origem. */
export function textoDaFaixa(origem: OrigemDaTrava): {
  titulo: string;
  corpo: string;
  botao: string;
  confirmacao: string;
  botaoConfirmar: string;
  botaoCancelar: string;
} {
  const confirmacao = {
    confirmacao:
      "A cópia desta conversa guardada neste navegador é diferente da do servidor. Recarregar do servidor troca uma pela outra: o que foi feito aqui e não chegou ao servidor se perde.",
    botaoConfirmar: "Trocar pela do servidor",
    botaoCancelar: "Continuar travada",
  };
  if (origem === "sem-conferir") {
    return {
      titulo: "Não deu para confirmar se esta conversa é a mais nova",
      corpo:
        "O servidor recusou uma gravação desta aba, e não dá para saber se foi outra aba (ou outro computador) ou uma gravação atrasada daqui mesmo. Para não apagar nada, esta aba parou de guardar a conversa: a cópia deste navegador ficou como estava, e o que for feito aqui a partir de agora não fica salvo.",
      botao: "Recarregar do servidor",
      ...confirmacao,
    };
  }
  return {
    titulo: "Esta conversa mudou em outra aba",
    corpo:
      "Outra aba (ou outro computador) gravou esta conversa depois que ela foi aberta aqui. Para não apagar o que foi feito lá, esta aba parou de guardar a conversa: o que foi feito aqui desde então não fica salvo — recarregue para continuar da versão mais nova.",
    botao: "Recarregar a conversa",
    ...confirmacao,
  };
}

/**
 * "Recarregar" troca o disco desta máquina pela cópia do servidor. Na trava
 * provada é o combinado (o servidor tem o trabalho da outra aba). Sem conferir,
 * só vai direto quando o disco não tem outra versão: igual à do servidor, ou
 * vazio. Versão diferente — mais nova ou mais velha, as duas podem ter edições
 * que o servidor não tem — ou a do servidor desconhecida: confirma antes.
 */
export function recargaPedeConfirmacao(args: {
  origem: OrigemDaTrava;
  disco: number | null;
  servidor: number | null;
}): boolean {
  if (args.origem === "outra-aba") return false;
  if (args.disco === null) return false;
  return args.disco !== args.servidor;
}
