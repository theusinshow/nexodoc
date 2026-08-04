/**
 * O ROTEIRO do tour guiado — dado puro, sem React, para o texto poder ser lido,
 * revisado e testado sem abrir o app.
 *
 * Cada passo aponta para um elemento REAL da tela pelo atributo `data-tour`.
 * Nada de balão explicando o que ainda não existe: o tour roda sobre o projeto
 * de exemplo semeado (ver `projeto-exemplo.ts`), então em todo passo há o que
 * mostrar funcionando.
 *
 * Regra do texto: uma frase diz O QUE é, a outra diz o que a PESSOA faz. Sem
 * "clique aqui" solto, sem emoji, sem tom de marketing.
 */
import type { LadoDoBalao } from "./posicao-do-balao.ts";

export interface PassoDoTour {
  id: string;
  titulo: string;
  corpo: string;
  /**
   * Seletor do alvo (`[data-tour="..."]`). Ausente = balão no centro, para a
   * abertura e o fecho, que falam do todo e não de um canto da tela.
   */
  alvo?: string;
  lado?: LadoDoBalao;
  /**
   * Elemento a CLICAR antes de mostrar o passo — o tour dirige a tela como o
   * usuário dirigiria, em vez de manipular estado por dentro. Se o alvo não
   * existir, o passo simplesmente não clica nada.
   */
  clicarAntes?: string;
}

export const PASSOS_DO_TOUR: PassoDoTour[] = [
  {
    id: "abertura",
    titulo: "Um projeto de exemplo, para começar",
    corpo:
      "Abri uma obra fictícia com quatro pranchas e um memorial já auditado. Nada aqui é projeto seu, e apago tudo quando terminarmos. Use as setas do teclado ou os botões; Esc sai a qualquer momento.",
  },
  {
    id: "orbe",
    titulo: "O Nexo",
    corpo:
      "É com ele que se conversa. Ele lê os documentos, propõe o que fazer e monta o volume — o brilho muda quando está pensando, gerando ou esperando você.",
    alvo: '[data-tour="orbe"]',
    lado: "esquerda",
  },
  {
    id: "composer",
    titulo: "Tudo começa soltando PDFs",
    corpo:
      "Arraste as pranchas ou o memorial para o campo, ou peça em português: \"monta o volume\", \"audita o memorial\". Não há formulário para preencher antes.",
    alvo: '[data-tour="composer"]',
    lado: "acima",
  },
  {
    id: "selo",
    titulo: "Ele lê o selo de cada folha",
    corpo:
      "De cada prancha saem obra, disciplina, número da folha e conteúdo. É dessa leitura que vêm a capa, a separatriz e a lista de documentos — ninguém redigita nada.",
    alvo: '[data-tour="resposta"]',
    lado: "esquerda",
  },
  {
    id: "mapa-do-volume",
    titulo: "O mapa do volume",
    corpo:
      "As folhas lidas e os documentos gerados ficam aqui, na ordem em que o volume será emitido. Arrastar uma folha muda o tomo dela, e a montagem obedece ao que estiver no mapa.",
    alvo: '[data-tour="palco"]',
    lado: "esquerda",
    clicarAntes: '[data-tour="chip-mapa"]',
  },
  {
    id: "auditoria-parecer",
    titulo: "A auditoria do memorial",
    corpo:
      "O parecer separa o que é achado sólido do que é sugestão da IA, e cada achado traz a página e o trecho que o sustenta.",
    alvo: '[data-tour="palco"]',
    lado: "esquerda",
    clicarAntes: '[data-tour="chip-auditoria"]',
  },
  {
    id: "veredito",
    titulo: "O veredito é o que se lê primeiro",
    corpo:
      "Vermelho é incongruência crítica de identidade: não emita. Âmbar pede conferência. E se alguma etapa da análise não completar, ele avisa em vez de fingir que está tudo certo.",
    alvo: '[data-tour="veredito-parecer"]',
    lado: "abaixo",
  },
  {
    id: "no-documento",
    titulo: "A mesma auditoria, sobre o documento",
    corpo:
      "Cada página com achado vira uma miniatura real do memorial, com o ponto marcando o trecho no lugar onde ele está escrito.",
    alvo: '[data-tour="chip-no-documento"]',
    lado: "abaixo",
    clicarAntes: '[data-tour="chip-no-documento"]',
  },
  {
    id: "pilha-recorrente",
    titulo: "O mesmo erro em várias páginas",
    corpo:
      "Texto reaproveitado repete o engano. A pilha conta quantas vezes e liga uma linha a cada página — um problema só, espalhado, em vez de vários iguais.",
    alvo: '[data-tour="palco"]',
    lado: "esquerda",
  },
  {
    id: "parecer-completo",
    titulo: "O parecer inteiro, sem largar o documento",
    corpo:
      "Ele abre por cima e fecha com Esc. As páginas continuam montadas atrás, no mesmo lugar onde você estava.",
    alvo: '[data-tour="abrir-parecer"]',
    lado: "abaixo",
  },
  {
    id: "fecho",
    titulo: "É isso",
    corpo:
      "Vou apagar o exemplo e deixar a tela limpa para o seu primeiro projeto. Para rever este passo a passo, o botão fica no rodapé da barra lateral.",
  },
];
