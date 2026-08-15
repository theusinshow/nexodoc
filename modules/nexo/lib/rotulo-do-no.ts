/**
 * O QUE O CANVAS DA AUDITORIA DIZ A QUEM NÃO ESTÁ OLHANDO — e a tecla que abre.
 *
 * O canvas é uma cena: páginas, cards e pilhas ligados por linhas. Quem enxerga
 * lê a cena; quem navega por teclado ou leitor de tela recebia, até aqui,
 * "grupo" e o texto solto de dentro do nó — porque o React Flow só anuncia
 * `node.ariaLabel`, e o canvas nunca o preenchia.
 *
 * A onda 1 (045197b) tirou o pin da árvore de acessibilidade argumentando que o
 * card ao lado já diz tudo e "é focalizável e anunciado". Focalizável era
 * verdade; anunciado não era, e Enter não abria nada. Este módulo é a metade que
 * faltava — e mora aqui, fora dos componentes, porque texto que um leitor de
 * tela vai ler é CONTEÚDO, não estilo: dá para prová-lo em node cru.
 *
 * OS RÓTULOS SÃO ACENTUADOS. Eles são lidos em voz alta, e "critico" sem acento
 * sai com a tônica errada no sintetizador. É o contrário da regra das mensagens
 * de commit deste repositório, e de propósito.
 *
 * PURO: sem imports.
 */

/** Espelha `AuditSeverity` de `server/nexo/audit/build-audit-graph.ts`. */
export type SeveridadeDoNo = "critico" | "tecnico" | "editorial";

/**
 * A severidade em palavra.
 *
 * A tela mostra severidade como PONTO colorido, e ponto colorido não tem
 * leitura — quem ouve a tela recebia a mesma frase para um erro crítico e para
 * um ajuste de redação.
 */
const PALAVRA_DA_SEVERIDADE: Record<SeveridadeDoNo, string> = {
  critico: "crítico",
  tecnico: "técnico",
  editorial: "editorial",
};

export interface AchadoParaRotulo {
  tipo: string;
  severity: SeveridadeDoNo;
  /** `sugestao` é o achado que a validação rebaixou. */
  tier?: string;
  pageNumber?: number | null;
  /** Disciplina crua ("estrutural"), não a sigla: a sigla é para o olho. */
  disciplina?: string;
}

/**
 * O nome de UM card de achado.
 *
 * A ordem é a da pergunta que quem revisa faz: o quanto dói, o que é, e onde. A
 * disciplina fecha porque é a pergunta seguinte (a quem cobrar), e nem sempre
 * existe — ela é lida do cabeçalho da página.
 */
export function rotuloDoAchado(achado: AchadoParaRotulo): string {
  const natureza = achado.tier === "sugestao" ? "Sugestão" : "Achado";
  const onde =
    typeof achado.pageNumber === "number" && achado.pageNumber > 0
      ? `página ${achado.pageNumber}`
      : "sem página localizada";
  const disciplina = achado.disciplina?.trim();

  return [
    `${natureza} ${PALAVRA_DA_SEVERIDADE[achado.severity]}: ${achado.tipo}`,
    onde,
    ...(disciplina ? [disciplina] : []),
  ].join(", ");
}

export interface PilhaParaRotulo {
  tipo: string;
  severity: SeveridadeDoNo;
  count: number;
  pages: readonly number[];
}

/**
 * O nome de uma PILHA de recorrente.
 *
 * O alcance vem primeiro, e é o motivo de a pilha existir: o mesmo erro em cinco
 * páginas não é cinco achados, e anunciá-lo como "Achado crítico: Numeração"
 * cinco vezes esconderia exatamente o que o desenho quer mostrar.
 */
export function rotuloDaPilha(pilha: PilhaParaRotulo): string {
  const quantas = pilha.pages.length || pilha.count;
  const paginas = quantas === 1 ? "1 página" : `${quantas} páginas`;
  return `Erro ${PALAVRA_DA_SEVERIDADE[pilha.severity]} repetido em ${paginas}: ${pilha.tipo}`;
}

/** O nome de uma página do memorial no canvas. */
export function rotuloDaPagina(pagina: { pageNumber: number; achados: number }): string {
  const quantos = pagina.achados === 1 ? "1 achado" : `${pagina.achados} achados`;
  return `Página ${pagina.pageNumber} do memorial, ${quantos}`;
}

/**
 * Esta tecla ABRE o nó que está em foco?
 *
 * Enter e Espaço, que são as duas que ativam um controle na web. As setas ficam
 * de fora de propósito: o React Flow as usa para andar pela cena, e roubar a
 * navegação de quem depende do teclado seria pior do que o defeito que isto
 * conserta.
 */
export function abreNoTeclado(tecla: string): boolean {
  return tecla === "Enter" || tecla === " " || tecla === "Spacebar";
}
