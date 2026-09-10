# O deck como instrumento — redesenho da apresentação (spec de estrutura e visual)

> **Data:** 10/09/2026. **Estado:** aprovado em conversa, aguardando plano.
> **Autoridade sobre:** estrutura, composição, tipografia e movimento das folhas
> de `app/apresentacao` e `app/apresentacao/valores`.
> **NÃO tem autoridade sobre:** o texto falado e as notas do apresentador, que
> continuam sendo os de `2026-08-24-apresentacao-diretoria-design.md` (com as
> notas datadas de 09/09 e 10/09) e de
> `2026-09-08-folha-de-precos-e-rota-de-valores-design.md`. Nenhuma palavra do
> conteúdo muda com este spec; só a forma que a segura.

## 1. Por que refazer, e o que o autor rejeitou

O deck de 09/09 tem um sistema de movimento correto e três momentos dirigidos
(05, 08, 12), e ainda assim o autor o leu como "AI slop". Ele apontou quatro
sintomas, todos confirmados nas capturas:

1. **Blocos flutuando no meio da folha**, com vazio em cima e embaixo (04, 06,
   17, 18): `justify-content: center` no lugar de estrutura.
2. **Três colunas iguais** de número, título e texto, em cinco folhas.
3. **Lista com fade-up escalonado** em outras seis.
4. **Tudo na mesma margem esquerda, sem grade visível.**

E um quinto, de caixa: títulos, rótulos, siglas e fechos sem regra de caixa alta
que se perceba. Ele quer caixa alta onde há sistema, e a mesma regra em todo o
deck.

Decisões tomadas com ele, nesta ordem:

- **O deck continua na rota atual** (`/apresentacao`), refeito do zero por
  dentro. Slidev foi considerado e recusado: perderia o portão de admin, o orbe
  vivo (React) e o gerador da cópia offline, todos provados. O que se aproveita
  do Slidev é vocabulário de estrutura, não o código.
- **O ritmo continua automático.** Cada folha se monta sozinha ao entrar; não há
  passos por clique.
- **Direção visual escolhida em mockup: "Instrumento"**, entre três (Prancha,
  Instrumento, Grade). O título é **rótulo pequeno em caixa alta**, não título
  grande.
- **Mantém a direção visual do produto** (DESIGN.md): escuro, neutros tingidos,
  teal abaixo de 10% da superfície, IBM Plex Sans para ler e Mono para dado e
  rótulo, chanfro nas superfícies, nada de roxo, gradiente ou glow.

## 2. A ideia: a folha é um instrumento de medição

O DESIGN.md chama o Nexo de "instrumento calibrado, com um agente dentro". O
deck passa a ser isso literalmente: cada folha é um painel de leitura, com uma
**régua** que diz onde se está, uma **escala** que segura o conteúdo e uma
**leitura** que é a conclusão. Nada flutua porque tudo está preso a uma linha.

O que isto responde, ponto a ponto:

| sintoma | resposta |
|---|---|
| bloco flutuando | o conteúdo nasce na linha do rótulo e desce; nunca `center` vertical |
| colunas iguais | quatro arquétipos, escolhidos por folha; colunas só onde há escala horizontal |
| lista com fade-up | a lista vira escala vertical com tick e número; a entrada é a escala se desenhando |
| sem grade | grade de 12 colunas, régua fixa e linhas finas visíveis |
| caixa alta sem regra | três lugares e só três: rótulo-título, rótulos mono, siglas |

## 3. A armadura — igual em toda folha, fixa no palco

A armadura **não pertence à folha**: é renderizada pelo `Palco`, fora da
`<section>` da folha, e por isso não participa do crossfade. Na troca, o
conteúdo se dissolve e a armadura fica; só a marca da régua desliza um índice.

### 3.1 A régua (esquerda)

- Faixa vertical de **144 px** de largura, altura inteira, com borda direita de
  1 px (`var(--border)`).
- Os índices de todas as folhas do deck (01 a 19), em Mono 14 px, empilhados a
  partir de y = 72 com passo de **40 px** (19 × 40 = 760; termina em y = 832).
  Cor `#3d474d`; a **folha corrente** em `var(--foreground)` peso 500.
- **Marca teal**: retângulo de 16 × 40 px encostado na borda direita da régua,
  alinhado ao índice corrente. É o único teal da armadura.
- **Nome do bloco** na vertical (writing-mode vertical, de baixo para cima),
  Mono 14 px caixa alta, tracking 0,14em, cor `#5f6b72`, ocupando de y = 864 a
  1032 (168 px, o bastante para POSSÍVEIS PERGUNTAS em 14 px). Trocou o bloco,
  troca o texto.
- No anexo, a régua mostra **A a F** e o bloco OS VALORES. Mesmo desenho.
- Na capa (01) a régua aparece com o 01 aceso: o deck já começa dentro do
  instrumento.

**Por que a marca desliza e não pisca.** A mudança de bloco não tem folha
separadora. O que a sala vê é a marca descer um passo e, nas fronteiras de
bloco, o nome vertical trocar. É sinal suficiente e não custa uma folha.

### 3.2 O rótulo-título (topo)

- Mono, caixa alta, **20 px**, tracking 0,14em, cor `var(--muted-foreground)`,
  em y = 80, começando em x = 224.
- À direita do rótulo, quando a folha tem subtítulo ou nome de arquivo, ele vem
  na mesma linha, Mono 20 px sem caixa alta, cor `#5f6b72`, separado por 28 px.
- Linha fina de 1 px (`var(--border)`) de x = 224 a 1840, em y = 124.
- A capa não tem rótulo-título: o nome NexoDoc é o título.

### 3.3 A leitura (base), quando a folha tem fecho

- Linha fina em y = 820, rótulo **LEITURA** (Mono 16 px caixa alta, `#5f6b72`)
  em y = 856, e a frase a partir de y = 892.
- A frase: Sans **600, 48 px**, tracking −0,02em, line-height 1,15. A **oração-
  chave em teal** (`var(--nexodoc-accent)`), o restante em `var(--foreground)`.
  Qual oração é a chave é decisão editorial por folha e fica escrita no código
  como array de segmentos `[{texto, chave: true}]`; quebras de linha continuam
  deliberadas (`Linhas`).
- Folhas sem fecho (03, 05, 09, 10, 11, 17, 18) não têm a base: o conteúdo pode
  descer até y = 1000.

### 3.4 A grade

- Área de conteúdo de x = **224 a 1840** (1616 px): 12 colunas de 112,67 px com
  calha de 24 px. Em código, `grid-template-columns: repeat(12, 1fr); gap: 24px`.
- Margens verticais: topo do conteúdo em y = **156**; fundo em y = 1000 (ou 796
  quando há leitura).
- Toda medida é múltiplo de 4 (regra do DESIGN.md).
- **Nunca** `justify-content: center` ou `align-items: center` vertical num
  contêiner que ocupe a folha. O que sobra de espaço fica embaixo, e isso é
  aceitável; o que não é aceitável é o bloco à deriva.

## 4. Regras de caixa e tipo

**Caixa alta em três lugares, e só neles:**

1. o rótulo-título de cada folha;
2. rótulos Mono (A PERGUNTA, LEITURA, PÁGINAS, MEDIDO POR EXECUÇÃO, o nome do
   bloco na régua);
3. siglas e nomes-sigla no corpo: **LD, LDs, UBS, ODT, PDF, ZIP, IA, PROSUL,
   API, OCR, SC, S/N**.

Corpo, títulos de leitura e fechos ficam em caixa de frase. Caixa alta no corpo
é proibida (regra do registro de marca da skill impeccable e do DESIGN.md).

**Tipo:**

- Sans 400 para texto de leitura, **máximo 64 caracteres por linha**
  (`max-width: 64ch`), 26 a 28 px, line-height 1,45.
- Sans 500 para o título de cada leitura ou fato (32 a 44 px conforme o
  arquétipo).
- Mono para todo dado: número, hora, nome de arquivo, cifra, código, com
  `font-variant-numeric: tabular-nums` sempre.
- A rampa da folha, do menor ao maior: 16 · 20 · 26 · 32 · 44 · 60 · 80 · 96.
  Nenhum tamanho fora dela.

**Cores:** só as do DESIGN.md. Teal (`--nexodoc-accent`) para o interativo, a
marca da régua e a oração-chave da leitura; âmbar (`--status-warning`) e coral
(`--status-critical`) só com o sentido de status que já têm no deck (premissa;
crítico); neutros `#e6eaec`, `#8a969c`, `#5f6b72`, `#3d474d`, `#1f272c`.

## 5. Os quatro arquétipos

Cada folha usa **um** arquétipo, escolhido pelo que o conteúdo é. Os três
primeiros são componentes; o quarto é composição única.

### 5.1 Escala horizontal — fatos em linha

Para 2 a 4 fatos paralelos. Uma linha de 1 px (`#3d474d`) atravessa o conteúdo
em y = 456; um **tick** vertical de 24 px marca o início de cada fato, mais um no
fim. Acima da linha, cada fato: título Sans 500 44 px (quebra deliberada) e texto
Sans 400 26 px `#8a969c`. Os fatos ocupam colunas iguais da grade (12/n).

Folhas: **02** (a frase central à esquerda em 7 colunas; os três "não faz" como
escala em 5 colunas à direita), **06**, **07** (dois fatos, cada um com a frase
colorida como texto), **11** (dois fatos: conferência e montagem, com as quatro
linhas de cada um em Mono abaixo do texto), **18** (três, com a linha da escala
**tracejada**: não construído).

### 5.2 Escala vertical — leituras numeradas

Para listas de 3 a 6 itens. Uma linha vertical de 1 px em x = 320, de y = 156 ao
fim do conteúdo; um tick horizontal de 24 px por item; o número do item (Mono 16
px, `#5f6b72`) à esquerda da linha em x = 224; título Sans 500 32 px e texto
Sans 400 26 px à direita, a partir de x = 368. **Altura igual por item**: o
espaço disponível dividido pelo número de itens, nunca a altura do texto.

Folhas: **09** (quatro leituras; a primeira em âmbar), **10** (duas escalas lado
a lado, 6 colunas cada, três leituras em cada), **19** (três leituras, com a
leitura final e o orbe `compact` na base).

### 5.3 Confronto — a pergunta e as leituras

Para as objeções. Esquerda, 5 colunas: rótulo A PERGUNTA e a pergunta em Mono
26 a 32 px (o tamanho cai um degrau quando a pergunta passa de 160 caracteres),
entre aspas, `var(--foreground)`. Direita, a partir da coluna 7: uma escala
vertical (5.2) com as 2 ou 3 respostas. Base: leitura.

Folhas: **13, 14, 15, 16**. A 16 não tem pergunta: o lado esquerdo traz o
título "Motivo da venda" em Sans 500 44 px e a linha fina "Três fatos, ditos
antes de alguém precisar perguntar." O restante é igual.

### 5.4 Instrumento próprio — composição única

Seis folhas têm composição própria, desenhada uma a uma sobre a mesma grade:

- **01 Capa.** Régua com 01 aceso e sem bloco. O orbe `hero` à esquerda (colunas
  1 a 5), NexoDoc em Sans 500 128 px e a linha "Conferência e montagem
  documental para projetos de engenharia" à direita. Rodapé em Mono: "Apresentação
  de software · 2026 · Matheus Mendes", sobre linha fina em y = 900.
- **03 O motor.** Mantém o diagrama (motor, colchete, dois ramos, pulso), agora
  preso à grade: os dois ramos são duas escalas horizontais (5.1) com as caixas
  como fatos. O rodapé em Mono vira a leitura da folha, sem teal.
- **05 O produto.** Quatro **mostradores** em linha (Mono 80 px com rótulo
  embaixo, cada um com borda esquerda de 1 px `#3d474d`, alinhados às colunas 1,
  4, 7, 10), o mapa das 218 páginas (altura 96 px) com **escala de página**
  embaixo (p. 1 · 50 · 100 · 150 · 200 · 218), a linha descendo da p. 92 e o
  cartão de achado com o chanfro do produto. A nota "custo lido do registro"
  no canto inferior direito.
- **08 A conta.** Esquerda, 6 colunas: a equação em Mono 60 px fator a fator, a
  linha, "= 72 horas", a premissa em âmbar; embaixo, sobre linha teal, "SÓ DE
  HORAS PARADAS" e a cifra em Mono 96 px. Direita, colunas 8 a 12: escala
  vertical (5.2) com os três "o que não entra", rótulo em coral.
- **12 Como ela se paga.** Três leituras em escala vertical (5.2) na metade de
  cima; na base, no lugar da leitura, os dois números: R$ 285 em Mono 56 px
  `#8a969c` e R$ 3.600 a R$ 6.480 em Mono 96 px teal, com os rótulos na mesma
  linha de base.
- **17 Quanto custa usar.** Rótulo-título, a frase "O valor não está neste deck."
  em Sans 500 44 px na linha do conteúdo, o texto de apoio, e o botão
  `data-abre-valores` logo abaixo. Não centrar: nasce em y = 156 e para.

### 5.5 O anexo A–F

Mesma armadura e mesmos arquétipos: **A** confronto sem pergunta (o que entra e
o que peço); **B** e **C** duas escalas verticais lado a lado com os totais na
base; **D** escala vertical de campos (Modalidade, Prazo, Valor, Inclui, Não
inclui) com a leitura; **E** escala vertical à esquerda e o mostrador R$ 10.000
à direita; **F** frase única em Sans 500 44 px e leitura.

## 6. Movimento

O sistema `--ap-*` de `palco.css` (cinco durações, três curvas, máscara de
linha, crossfade de 260 ms) continua sendo a autoridade. O que muda:

- **A armadura não anima.** Régua, rótulo-título e linhas da armadura ficam
  fixos na troca. Só a marca da régua desliza um índice (`transform`, 260 ms,
  `--ap-entra`).
- **A escala se desenha antes do conteúdo.** Linha (`ap-risca` ou `ap-desce`) e
  ticks aparecem primeiro; os fatos ou leituras assentam sobre ela em cascata
  (`--ap-passo-largo`). É a ordem de um instrumento: primeiro a escala, depois a
  agulha.
- **Máscara de linha** para título de leitura, mostradores e fecho; **surge**
  para o orbe; **pulso** só no motor.
- Movimento reduzido mostra tudo no estado final, imediatamente, inclusive os
  contadores (regra de 10/09).
- Automático em todas as folhas: nenhum passo por clique.

## 7. Código

- `palco.tsx`: passa a renderizar a **régua** fora da `<section>`, alimentada
  pelo índice corrente e pela lista de folhas (número e bloco). A régua é parte
  do palco de 1920 e escala com ele; a moldura não muda.
- `palco.css`: ganha a armadura (`.ap-regua-deck`, `.ap-rotulo`, `.ap-leitura`,
  `.ap-grade`) e perde `.ap-cabeca`, `.ap-titulo`, `.ap-folha--denso` (não há
  mais folha densa: a grade decide).
- `pecas.tsx`: ganha os arquétipos **EscalaHorizontal**, **EscalaVertical**,
  **Confronto** e **Leitura**, e as peças **Mostrador** e **Tick**. Perde
  `Marcador`, `Titulo` e `Fecho`. `Linhas`, `Contador` e `Entra` ficam.
- `slides.tsx` (2.248 linhas) é dividido: `folhas/o-que-e.tsx` (01 a 05),
  `folhas/o-problema.tsx` (06 a 08), `folhas/o-que-existe.tsx` (09 a 11),
  `folhas/o-dinheiro.tsx` (12, 17), `folhas/possiveis-perguntas.tsx` (13 a 16),
  `folhas/o-pedido.tsx` (18, 19), e `slides.tsx` só concatena na ordem. As
  **notas** e o **texto** são copiados sem alteração.
- `valores/slides-valores.tsx` é refeito nos mesmos arquétipos.
- O gerador offline continua lendo a folha corrente; a régua entra na
  serialização como parte do palco.

## 8. Provas, todas sem token

- `node scripts/shot-apresentacao-todas.mjs` e `REDUZIDO=1`: toda folha inteira,
  nos dois modos.
- `node scripts/medir-folga-apresentacao.mjs`: nenhum conteúdo abaixo de y = 1000
  (ou 796 com leitura); rótulo-título em y = 80 em toda folha.
- **Nova, `prova:deck-caixa`**: percorre o texto renderizado de cada folha e
  falha se encontrar uma sigla da lista da §4 em minúscula, ou caixa alta fora
  dos três lugares permitidos (heurística: palavra de 4+ letras toda em caixa
  alta fora de elemento Mono e fora de sigla da lista).
- **Nova, `prova:deck-regua`**: em cada folha, o índice aceso na régua é o
  número da folha, e o nome do bloco vertical é o bloco da folha.
- `node scripts/shot-apresentacao-folhas.mjs`: as 17 asserções de conteúdo
  continuam valendo (o texto não mudou).
- `npm run apresentacao:offline`: regenerar e passar na autoconferência.
- Conferência visual final pelo autor, navegando a sequência inteira.

## 9. Fora de escopo

- Texto das folhas, notas, ordem e numeração.
- Passos por clique (recusado).
- Rota, portão de admin, atalhos de teclado, painel de notas.
- Qualquer mudança em `DESIGN.md`.
