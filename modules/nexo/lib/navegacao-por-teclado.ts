/**
 * ANDAR PELO CANVAS SEM O MOUSE — só a decisão, sem React e sem xyflow.
 *
 * Conferir um lote é uma tarefa de repetição: olhar a folha, comparar com o
 * carimbo, ir para a próxima. Com duzentas pranchas, obrigar a mão a sair do
 * teclado a cada folha é o que faz a conferência ser adiada — e adiada é como
 * ela chega à prefeitura.
 *
 * A ORDEM É A DO CANVAS, e não uma inventada aqui. Os nós já nascem em ordem de
 * leitura (fileira do tomo, depois a ordem canônica do volume, depois a grade
 * das folhas); andar pelo array é andar pelo documento. Uma segunda ordenação
 * neste arquivo seria uma segunda verdade sobre "qual é a próxima".
 *
 * PURO: roda no node cru.
 */

export interface PassoDoTeclado {
  /** Quem passa a estar selecionado. `null` = a tecla não navega. */
  proximo: string | null;
  /** A tecla foi consumida — quem chama deve impedir o comportamento padrão. */
  consumiu: boolean;
}

const AVANCA = new Set(["ArrowRight", "ArrowDown"]);
const RECUA = new Set(["ArrowLeft", "ArrowUp"]);

/**
 * Qual nó a tecla seleciona.
 *
 * SEM DAR A VOLTA. Chegar ao fim e reaparecer no começo é desorientador numa
 * lista longa: quem confere perde o lugar e não sabe que perdeu. A ponta segura
 * — a seta continua respondendo, e nada muda.
 *
 * NADA SELECIONADO + seta = o PRIMEIRO (ou o último, se veio de trás). É o que
 * permite entrar no canvas pelo teclado sem clicar antes em coisa nenhuma.
 */
export function passoDoTeclado(
  tecla: string,
  ids: readonly string[],
  selecionado: string | null,
): PassoDoTeclado {
  if (ids.length === 0) return { proximo: null, consumiu: false };

  const avanca = AVANCA.has(tecla);
  const recua = RECUA.has(tecla);
  if (!avanca && !recua) return { proximo: null, consumiu: false };

  const atual = selecionado ? ids.indexOf(selecionado) : -1;

  if (atual === -1) {
    return { proximo: avanca ? ids[0] : ids[ids.length - 1], consumiu: true };
  }

  const alvo = avanca
    ? Math.min(atual + 1, ids.length - 1)
    : Math.max(atual - 1, 0);
  return { proximo: ids[alvo], consumiu: true };
}

/**
 * O EVENTO É PARA O CANVAS, ou é para quem está escrevendo?
 *
 * O Nexo tem um compositor de conversa na mesma tela. Sem esta guarda, a seta
 * que move o cursor dentro de uma frase passaria a pular de folha — e o `E` de
 * "editar" viraria uma letra que some. Um atalho de canvas que rouba tecla de
 * campo de texto não é atalho, é defeito.
 */
export function ehDigitacao(
  alvo: {
    tagName?: string;
    isContentEditable?: boolean;
  } | null,
): boolean {
  if (!alvo) return false;
  if (alvo.isContentEditable) return true;
  const tag = (alvo.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
