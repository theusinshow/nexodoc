# Nexo — Mexer nas folhas (sub-projeto 4A)

**Data:** 2026-07-28
**Estado:** desenho aprovado, pronto para implementar

Quarto sub-projeto do canvas manipulável, partido em dois. Este é o **4A**: o
canvas passa a aceitar seleção múltipla, arrasto entre tomos e reordenação — os
gestos que escrevem `grupo` e `ordem` em `ajustes`.

| # | Sub-projeto | Depende de | Estado |
|---|---|---|---|
| 1 | Navegação | — | **feito** (`0a40ebe`, `95311c2`) |
| 2 | Document State | — | **feito** (`dac082b`, `523a4d5`, `d797012`) |
| 3 | Página como nó | 2 | **feito** (`5b7027d`..`c6400af`) |
| 4A | **Mexer nas folhas** (este) | 2 e 3 | a fazer |
| 4B | Criar tomo novo + marca de desatualizado | 4A | a fazer |
| 5 | Montagem lendo ordem e grupos manuais | 2 e 4 | a fazer |

## Por que 4A e 4B são separados

Os quatro gestos pedidos (janela de seleção, arrastar entre tomos, reordenar,
criar tomo novo) mais a marca de "documento desatualizado" formam **dois blocos com
naturezas diferentes**.

4A mexe só no canvas: os ajustes que ele escreve já têm consumidor pronto e
testado (`gruposDasFolhas` respeita `grupo`; a projeção ordena por `ordem`). Ele é
verificável sozinho — arrastei, regerei, o volume saiu na ordem nova.

4B mexe no que hoje é decidido na **geração**: quantos tomos existem, e qual o
vínculo entre um documento gerado e as folhas que ele descreve. Criar um tomo
novo pelo canvas exige que a fileira exista sem nenhum artefato dentro dela (hoje
`agruparPorTomo(artifacts)` é quem cria fileira); a marca de desatualizado exige um
conceito que não existe no código: a assinatura das folhas de um tomo no momento
em que o documento foi gerado.

Juntar os dois seria mudar o gesto e o significado da geração no mesmo passo.

## O problema que 4A resolve

O canvas mostra as folhas mas não deixa mexer. `nodes` sai de um `useMemo`
derivado e **nada volta por `onNodesChange`** — foi por isso que a seleção precisou
ser manual (`selecionadoId` + `onNodeClick`) e por isso o minimapa não funcionou
(ele descarta nó sem `measured`, e `measured` só chega em nó que passou pelo ciclo
de mudanças do React Flow).

Janela de seleção e arrasto são exatamente as duas coisas que o React Flow entrega
**por** `onNodesChange`. Não há como ter os gestos mantendo os nós somente-leitura.

## Os nós viram estado

O canvas passa a guardar os nós em estado, reconciliados a partir da derivação:

```
projeção (folhas + ajustes)  →  derivação (nós + arestas)  →  estado dos nós  →  React Flow
                                        ↑                            │
                                        └──── effect sincroniza ─────┘
                                             (a derivação é a verdade)
```

A derivação continua sendo a verdade: quando ela muda — nova folha lida, novo
documento gerado, ajuste aplicado — o effect reconcilia o estado. A reconciliação
**preserva o que é do usuário**: quais nós estão selecionados. Substituir o array
inteiro a cada mudança apagaria a seleção no meio de um arrasto.

O risco desta troca é o canvas parar de refletir a geração (estado e derivação
divergirem). É o que a verificação no navegador tem de cobrir: gerar um documento
novo com folhas já selecionadas, e ver o documento aparecer sem a seleção sumir.

## O gesto

| Ação | Como |
|---|---|
| Selecionar uma | Clicar na folha |
| Selecionar várias | Arrastar no vazio com o botão esquerdo (`selectionOnDrag`) |
| Somar à seleção | Shift + clique |
| Mover a tela | Botão do meio, botão direito, ou espaço + arrastar (`panOnDrag={[1,2]}`) |
| Zoom | Roda, como hoje |

**Só entra na seleção quem está inteiro dentro do retângulo** (`selectionMode`
padrão do React Flow). Decisão do usuário: uma regra só, independente da direção
do arrasto — a distinção janela/cerca do AutoCAD exigiria lógica própria e, com
folhas pequenas em grade, raramente frustra.

Nós de **documento** seguem `draggable: false`. Só folha arrasta: capa, separatriz,
LD e volume não têm para onde ir — a posição deles é a ordem canônica do volume.

## Soltar vira ajuste

Módulo puro novo, `modules/nexo/lib/drop-folhas.ts`, sem import de runtime (roda em
Node pelado, como `folhas.ts` e `layout-canvas.ts`):

```ts
/** Uma fileira, como o canvas a desenhou: onde ela está e o que tem dentro. */
interface FileiraDoDrop {
  tomo: number;
  /** Caixa da fileira inteira, em coordenadas do canvas. */
  topo: number;
  altura: number;
  /** Canto superior esquerdo da grade de folhas. */
  gradeX: number;
  gradeY: number;
  /** Ids das folhas da fileira, na ordem em que estão desenhadas. */
  folhas: FolhaId[];
}

/**
 * Em que tomo e em que posição da grade o ponto caiu. A geometria da grade chega
 * INJETADA porque este módulo roda em Node pelado no teste, e import de runtime
 * com `.ts` não compila — a mesma razão pela qual `folhas.ts` recebe `repartir`
 * em vez de importá-lo.
 */
function alvoDoDrop(
  ponto: { x: number; y: number },
  fileiras: readonly FileiraDoDrop[],
  grade: { colunas: number; passoX: number; passoY: number },
): { tomo: number; indice: number } | null;

/** As ordens esparsas para `quantas` folhas soltas entre dois vizinhos. */
function ordensEntre(
  anterior: number | null,
  proxima: number | null,
  quantas: number,
): number[];

/** O que escrever em `ajustes` por causa deste arrasto. */
function ajusteDoDrop(
  movidas: readonly Folha[],
  alvo: { tomo: number; indice: number },
  /** As folhas do tomo de destino, para achar os vizinhos e suas chaves. */
  fileiraAlvo: readonly Folha[],
  /**
   * A divisão que está na tela. Congela o palpite: toda folha sem `grupo` ganha
   * o tomo em que já está. `null` quando não há divisão (uma fileira só) — aí
   * nenhum `grupo` é escrito.
   */
  divisaoAtual: readonly { tomo: number; folhas: readonly Folha[] }[] | null,
  /** `chaveDeOrdem` de `folhas.ts`, injetada pelo mesmo motivo que `grade`. */
  chave: (f: Folha) => number,
): { id: FolhaId; patch: Ajuste }[];
```

O canvas só reporta coordenada; a regra mora onde dá para testar. Ordem esparsa é
justamente o tipo de aritmética que erra em silêncio — folha que "volta" para o
lugar, duas folhas com a mesma ordem —, e um defeito desses só apareceria no PDF
montado.

### Congelar o palpite no primeiro arrasto

Medido durante a implementação, com 6 folhas em 2 tomos, arrastando a folha 1 do
tomo 1 para o tomo 2:

```
antes    tomo 1: [1, 2, 3]     tomo 2: [4, 5, 6]
depois   tomo 1: [2, 3, 4]     tomo 2: [1, 5, 6]
```

A folha 4 **voltou sozinha** para o tomo 1. A causa não é defeito de cálculo: só a
folha arrastada ganha `grupo` fixo, e as outras continuam na divisão automática,
que reequilibra os tomos e puxa uma folha para preencher a vaga.

**Decisão do usuário: o primeiro arrasto CONGELA o palpite.** Toda folha ganha o
`grupo` que já tinha na tela, e a partir daí só se move o que for movido à mão. É
a leitura literal de "o grupo manda; o automático é só o palpite inicial" — o
palpite vira ponto de partida no instante em que o usuário assume o comando.

Fixar só o tomo de destino foi verificado e **não** resolve: as folhas restantes
continuam se espalhando entre os tomos que sobraram.

**Consequência assumida:** depois de congelado, pedir "agora em 3 tomos" não
redivide mais nada — todas as folhas têm grupo fixo. Um "voltar ao automático"
(apagar os `grupo` dos ajustes) é o par natural disso e fica no 4B.

### O que a marca âmbar passa a significar

Congelar escreve `grupo` em todas as folhas, e `editado` é verdadeiro para
qualquer ajuste — então a marca de "corrigido à mão" acenderia no canvas inteiro
depois do primeiro arrasto, mentindo sobre o que o usuário mexeu.

A projeção passa a distinguir: `editado` continua sendo "tem algum ajuste", e
`editadoTexto` diz se **título ou disciplina** foram trocados. O nó da folha usa
`editadoTexto` — a marca existe para separar o que o sistema leu do que o usuário
reescreveu, e posição não é leitura de carimbo.

### A regra da ordem

A chave de ordenação de uma folha é `ordem ?? posição natural` (definição do
Document State). Ao soltar entre duas folhas, a ordem nova é a **média** das chaves
dos vizinhos; sem vizinho anterior, `próxima - 1`; sem próxima, `anterior + 1`.
Várias folhas soltas juntas repartem o intervalo em partes iguais, preservando a
ordem relativa que tinham entre si.

Mover uma folha não renumera as outras — é o que faz dois arrastos seguidos não
brigarem.

## Escrita em bloco

O `conversation-store` ganha:

```ts
ajustarFolhas: (entradas: { id: FolhaId; patch: Ajuste }[]) => void
```

Dobra a lista inteira num `setState` só. Chamar `ajustarFolha` num laço
funcionaria — `aplicarAjuste` é puro e compõe —, mas um arrasto de 30 folhas viraria
30 renders e 30 agendamentos de persistência.

## O que 4A NÃO faz

**Arrastar uma folha para o tomo 2 deixa a LD do tomo 1 mentindo até você mandar
regerar, sem aviso na tela.** É a mesma dívida que corrigir o título já tem hoje, e
ela é paga no 4B. Está escrito aqui porque uma dívida assumida por um sub-projeto
precisa estar visível: se o volume for montado sem regerar, o PDF sai errado.

Também ficam fora: criar tomo novo pelo canvas (4B) e o minimapa — que volta a ser
possível agora que os nós são estado, mas não é o que se pediu.

## Degradação

| Situação | Comportamento |
|---|---|
| Soltar fora de qualquer fileira | Nada muda: a folha volta para o lugar. Não se inventa tomo (isso é 4B) |
| Soltar na mesma posição de onde saiu | Nenhum ajuste escrito — não vale sujar o estado |
| Arrastar com um tomo só | Reordena dentro da única fileira, **seja ela o tomo 1 ou a "fora da divisão"** (com um tomo só, é ela que carrega todas as folhas); `grupo` não é escrito |
| Soltar na "fora da divisão" havendo tomos de verdade | Ignorado: aí aquela fileira é resto de geração anterior e não tem folha nenhuma, logo não é destino |
| Folha com ajuste órfão | Já resolvido na projeção: ignorado, não apagado |

## Testes

Puros, em `scripts/test-nexo-drop.ts`:

- `ordensEntre` intercala entre dois vizinhos sem colidir com nenhum dos dois;
- várias folhas soltas juntas mantêm entre si a ordem que tinham, e todas caem no
  intervalo;
- sem vizinho anterior e sem próximo, a ordem ainda sai coerente (extremos);
- `alvoDoDrop` acerta a fileira quando o ponto cai na folga entre a grade e o nó do
  volume;
- ponto fora de qualquer fileira devolve `null`;
- **o teste que amarra tudo:** aplicar o ajuste de um drop e ver
  `gruposDasFolhas` devolver a folha no tomo de destino, na posição de destino.

No navegador (`shot-nexo.mjs` ou script equivalente): arrastar uma folha do tomo 1
para o tomo 2, **regerar**, e conferir que o PDF da LD do tomo 2 lista aquela folha.
Ver o nó mudar de lugar não prova nada — o que importa é a montagem ler o ajuste.

## Riscos

**Estado x derivação.** É a troca estrutural do sub-projeto. Um erro de
reconciliação faz o canvas parar de mostrar o que foi gerado, ou apagar a seleção
no meio do gesto. A verificação no navegador precisa cobrir os dois: gerar com
seleção viva, e ajustar com documento novo na tela.

**O botão esquerdo troca de dono.** Quem já usa o canvas arrasta a tela com o
esquerdo; depois disso, o esquerdo seleciona. É mudança de hábito assumida — foi o
que o usuário pediu ao dizer "tipo AutoCAD" — mas é a primeira coisa a estranhar.

**Arrasto de seleção grande.** 200 folhas selecionadas e arrastadas juntas são 200
ajustes num `setState`. A escrita em bloco existe por isso; se ainda pesar, o lugar
de medir é o mesmo da medição de 200 folhas (`scratchpad/medir-200-folhas.mjs`),
não o palpite.
