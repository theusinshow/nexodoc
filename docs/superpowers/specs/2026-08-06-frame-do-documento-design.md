# O frame do documento: perguntar com a forma do que vai sair

**Data:** 2026-08-06
**Estado:** desenho aprovado, pronto para virar plano

## O problema

Criar uma capa hoje é: o Nexo pergunta em texto → você responde no chat → ele gera →
você acha o nó no canvas → seleciona → "Editar aqui" → corrige → ele regera. O card
que resume a geração termina, literalmente, com **"Falta o título — diga qual pela
conversa."** (`PlanoDeGeracao.tsx:427`) — o produto manda escrever num chat um campo
que poderia estar ali, na forma do documento.

O frame construído em 2026-08-05 (`FrameDaCapa`) acertou a ideia e errou o lugar:
nasceu no caminho da **correção**, quando o pedido era o caminho da **pergunta**.

E há um padrão por trás de tudo que quebrou naquele dia — frame fora da tela, obra
duplicada, `{{(TOMO)}}` que nunca casava, formato de tomo ignorado, capa virando duas
páginas. **Nenhum aparecia até alguém abrir o PDF.** Não existe onde *ver* antes de
gerar.

## O que se constrói

O card "Vou gerar" deixa de ser lista de rótulo/valor e **passa a ser o documento
desenhado**, com os campos editáveis no lugar em que serão impressos, desenhado a
partir do modelo ODT de verdade.

### Decisões tomadas

1. **O frame vira o card.** Não é um botão que abre um painel: toda geração passa por
   ver o documento. Um passo escondido atrás de clique foi o que enterrou o frame de
   ontem.
2. **A LD entra empilhada abaixo da capa**, no mesmo card, rolando. Nada atrás de aba.
3. **O modelo ODT dita o desenho.** Quem edita o modelo é o engenheiro; um frame
   desenhado à mão passa a mentir no instante em que ele salva o arquivo.
4. **O mesmo componente nas duas casas** — no card antes de gerar, no nó do canvas
   depois. Dois frames divergiriam.

## Arquitetura

Três peças, cada uma com um trabalho só.

### `server/odt/layout.ts` (puro)

Recebe o `content.xml` e devolve a estrutura de impressão: para cada parágrafo, os
marcadores que contém, o texto fixo em volta, o alinhamento e o tamanho da fonte. É a
leitura que foi feita à mão para diagnosticar a obra duplicada e o marcador partido —
vira código testável.

Puro (só `import type`), para rodar em node cru como os outros módulos de `server/nexo`.

Contrato:

```ts
export interface ParagrafoDoModelo {
  /** Ordem de impressão. */
  indice: number;
  /** "center" | "end" | "start", como o ODF declara. */
  alinhamento: string;
  /** Tamanho da fonte em pt, quando o estilo o declara. */
  corpo?: number;
  /** Os pedaços em ordem: texto fixo e marcadores intercalados. */
  partes: (
    | { tipo: "texto"; valor: string }
    | { tipo: "marcador"; nome: string }
    | { tipo: "quebrado"; bruto: string }
  )[];
}

export function lerLayoutDoModelo(contentXml: string): ParagrafoDoModelo[];
```

O `tipo: "quebrado"` existe para o caso real: `{{TOMO}}` gravado como
`{{` + `<span>(</span>` + `TOMO` + `<span>)</span>` + `}}`. O leitor tira as tags de
dentro do parágrafo antes de procurar marcador, então enxerga o texto como ele é; o que
não formar um marcador válido sai sinalizado em vez de ignorado.

### `/api/capas/templates` devolve `layout`

Sem endpoint novo — o cliente já busca esta rota. **O cache do layout é chaveado pela
data de modificação do ODT.** O `getTemplateRegistry` guarda `cachedTemplates` num
módulo e nunca invalida (`registry.ts:24`); hoje isso não morde porque o ODT é lido
fresco a cada geração, mas pendurar o layout no mesmo cache faria as edições do modelo
exigirem reiniciar o servidor — exatamente o defeito que este trabalho existe para
matar.

Pré-computar o layout num arquivo ao lado do `config.json` foi descartado pelo mesmo
motivo: ficaria velho justamente quando o modelo muda.

### `FrameDoDocumento` (cliente)

Um componente, desenhado a partir do `layout`:

- cada marcador editável vira um campo;
- parágrafo com texto fixo em volta (`VOLUME {{VOLUME}} – {{TITULO_CAPA}}`) desenha o
  texto e o campo na mesma linha;
- marcador repetido vira uma linha por ocorrência, como o gerador faz desde
  `distribuirNosMarcadores`;
- alinhamento e tamanho relativo saem do modelo.

Substitui o `FrameDaCapa`, que era esqueleto em CSS fixo. **É usado nas duas casas** —
pelo `PlanoDeGeracao` antes de gerar e pelo `EditorDoNo` depois de gerado — e é o mesmo
código nas duas, que é o que impede de divergirem.

### A LD

Empilhada no mesmo card: cabeçalho pelo mesmo mecanismo e, abaixo, a lista de folhas.

A lista **já existe e está órfã**: o servidor manda `ldPreview` (folha, arquivo,
descrição, total, total de referência) em todo turno, o chat guarda na mensagem, e há um
`FolhaPreview` pronto para desenhar — mas o `ConfirmationCard` que a renderizava só
recebe propostas que não são capa/LD/separatriz desde que o `PlanoDeGeracao` assumiu
esse caminho (`NexoChat.tsx:368`). Os dados e o desenho existem; perderam a casa.

## Onde a edição mora e quem vence

A seção que, se ficar vaga, reproduz o defeito que já aconteceu duas vezes neste
projeto: **correção aceita e revertida sem aviso.**

Os params vivem numa *mensagem* do chat. Uma edição guardada ali morre no turno
seguinte: o agente responde, nasce mensagem nova com propostas novas, e o card antigo
vira histórico.

**Edição é decisão, e decisão é da conversa.** O frame escreve em dois lugares de nível
de conversa:

- **`identidade`** (obra, bairro, código, órgão, secretaria, fase, revisão) — já existe
  (`corrigirIdentidade`). Vale para a capa e para a LD do mesmo volume. **Mantém a regra
  que já tem** e não passa pela precedência abaixo: campo vazio significa "vale o
  carimbo", e é assim que se desfaz uma correção. O agente não propõe identidade, então
  não há disputa a resolver.
- **`decisoes`** (título, volume, mês, ano, nº de tomos, tomo inicial, prefeitura) —
  novo. Estes o agente **propõe** a cada turno, e por isso precisam da regra de
  precedência. O `PlanoDeGeracao` mescla as decisões por cima dos params da proposta, e é
  a mescla que gera.

### A regra de precedência

Não pode ser "a decisão sempre vence" (pedir "muda o título para X" no chat pararia de
funcionar) nem "o agente sempre vence" (a edição sumiria).

> Cada decisão guarda **o valor do agente que ela substituiu**. No turno seguinte: se o
> valor novo do agente difere do que a decisão substituiu, o agente mudou de ideia e
> vence — a decisão cai. Se o agente repetiu o mesmo valor, a decisão fica.

```ts
interface Decisao {
  valor: string;
  /** O que o agente propunha quando esta decisão foi tomada. */
  sobre: string;
}

export function mesclarDecisoes(
  decisoes: Record<string, Decisao>,
  paramsDoAgente: Record<string, string>,
): { valores: Record<string, string>; decisoesVivas: Record<string, Decisao> };
```

Função pura, testável em node cru. Sem ela o `numTomos` é o caso feio: o agente
recalcula os 6 tomos todo turno, e a troca manual para 4 seria desfeita em silêncio a
cada mensagem.

**As decisões vão no pedido do próximo turno**, para o resolvedor de slots as considerar
preenchidas — senão o Nexo volta a perguntar no chat o título que acabou de ser digitado
no frame.

**Nada de mensagem no histórico a cada tecla.** O editor do nó escreve uma, porque lá o
documento existe e a mudança é um evento. No card ainda não se gerou nada.

## Casos-limite

**Marcador partido** → sinalizado como aviso visível no card, em vez de campo. O defeito
silencioso vira linha vermelha.

**Marcador inventado** (`{{RESPONSAVEL}}` acrescentado ao ODT) → campo de texto livre no
frame, e o gerador ganha um **canal genérico** para substituí-lo. Sem isso a promessa "o
modelo dita" seria meia-verdade: hoje um marcador desconhecido é impresso literal na
capa.

**Marcadores derivados não são campo.** `{{CODIGO_EXIBIDO}}`, `{{MES_ANO}}`,
`{{VOLUME}}`, `{{TOMO}}`, `{{FASE}}` vêm do carimbo, do nome do arquivo ou da divisão. O
frame os desenha como texto cinza no lugar certo, com a procedência ("do carimbo", "da
divisão"), como o código e o tomo já fazem.

**Volume misto.** Uma capa; uma LD por disciplina. Empilhar quatro LDs inteiras faria um
card absurdo — cada disciplina ganha um bloco compacto: título editável, código,
revisão, as três primeiras folhas e "+ N folhas". A separatriz continua lista de
títulos: não tem modelo ODT, é gerada em código.

**Sem prefeitura escolhida não há layout** → o primeiro campo do frame é a prefeitura.

**Falha ao ler o modelo** → o card cai para a lista de rótulo/valor de hoje. Degradar é
melhor que sumir.

## Fora de escopo, de propósito

- **Orçamento de linhas** ("cabe/não cabe" enquanto digita): precisa de métrica de texto
  para valer, e um palpite errado é pior que nenhum.
- **Guard de contagem de páginas** depois de gerar: valioso e independente — merece o
  próprio trabalho. (Hoje uma capa que vira duas páginas entra no volume calada e
  desloca todas as pranchas.)
- **Reescrever o editor do canvas** além de trocar o componente do frame.

## Como se prova

**Puros, em node cru.** O leitor do layout roda contra **os quatro modelos reais** em
`templates/capas/*`, afirmando invariantes em vez de estruturas fixas: todo modelo
produz ao menos um marcador, todo marcador é válido ou está sinalizado, ordem e
alinhamento vêm preenchidos. Assim o teste acusa uma edição que quebre um modelo sem
quebrar a cada ajuste de espaçamento. Mais uma fixture com o `{{TOMO}}` partido em
spans, para garantir que ele é detectado.

A regra de precedência tem teste próprio: agente repete → decisão fica; agente muda →
agente vence; campo apagado → volta ao do agente.

**No navegador, sem gastar token**, encenando o carimbo e o turno do agente:

1. **O card desenhado a partir do modelo** — campo do título aceso, digitar, gerar e
   **ler o PDF que sai**, conferindo que o que estava no frame saiu no documento. Com as
   duas asserções que faltavam: a caixa cabe na janela, e a leitura é do PDF, não do DOM.
2. **A precedência de ponta a ponta** — editar o título no card, mandar outra mensagem
   no chat, afirmar que o título continua. Este defeito já aconteceu duas vezes; merece
   prova de ponta a ponta.

**O que teste nenhum pega** é se o frame *parece* uma capa. Isso continua sendo print +
olho humano — foi o print que mostrou o rótulo encavalando o campo, coisa que nenhuma
asserção veria.

## O que este trabalho remove

- `FrameDaCapa` (esqueleto em CSS fixo);
- a lista de rótulo/valor do `PlanoDeGeracao`;
- a frase "Falta o título — diga qual pela conversa";
- `LdConfirmation` e `FolhaPreview` inalcançáveis — revividos no lugar certo.
