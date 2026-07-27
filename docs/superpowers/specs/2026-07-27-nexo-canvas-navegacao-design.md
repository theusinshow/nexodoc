# Nexo — navegação do canvas

**Data:** 2026-07-27
**Estado:** desenho aprovado, pronto para implementar

Primeiro de cinco sub-projetos do canvas manipulável. É o único **independente**
— não depende do Document State — e por isso vem antes.

## Contexto: o pedido maior e o que ele reverte

O pedido completo era: navegação, seleção múltipla tipo AutoCAD, arrastar,
agrupar, renomear e reclassificar páginas, com tudo editável por chat e canvas.
Isso reverte três decisões anteriores, e a decomposição existe para que cada uma
seja assumida de propósito:

1. **Pranchas voltam a ser manipuláveis** — antes definidas como entrada
   somente-leitura, o que motivou cortar `Sheet[]`/`Order` do escopo.
2. **Agrupar à mão contradiz a divisão automática** — resolvido: **o grupo
   manda, o automático vira só o palpite inicial.** Se o automático mandasse, a
   próxima geração desfaria o arrasto, e o canvas mostraria uma organização que o
   PDF não respeita — pior que não ter o recurso.
3. **Uma página por nó reverte o "nunca N frames pesados"** registrado no
   cabeçalho de `NexoCanvas.tsx` — 24 pranchas viram 24 miniaturas renderizadas
   por `pdf.js`.

### Os cinco sub-projetos

| # | Sub-projeto | Depende de |
|---|---|---|
| 1 | **Navegação** (este) | nada |
| 2 | Document State (`Sheet[]` com ordem, título, classificação) | nada |
| 3 | Página como nó | 2 |
| 4 | Seleção tipo AutoCAD, arrastar, agrupar | 2 e 3 |
| 5 | Montagem lendo ordem e grupos manuais | 2 e 4 |

## O que já existe (não será reconstruído)

Zoom (+/−) e "ajustar à tela" já vêm do `<Controls />` do React Flow, no canto
inferior esquerdo. O que falta é **orientação**, não ampliação — o canvas agora
tem uma fileira por tomo, e o problema é saber onde se está.

## Escopo

**1. ~~Minimapa~~ — TENTADO E REMOVIDO.** `<MiniMap />` descarta todo nó cujo
objeto não declare dimensões (`nodeHasDimensions(userNode)`), lendo-as do nó que
passamos e não do interno já medido. Como os nós saem de um `useMemo` derivado e
não voltam por `onNodesChange`, ele desenhava só a moldura e o retângulo do
viewport — vazio. Corrigir exigiria fixar width/height em cada nó (passando a
ditar o tamanho hoje dado pelo conteúdo) ou tornar os nós estado mutável, que é o
que o Document State e "página como nó" fazem. **O minimapa volta no
sub-projeto 3.** A orientação ficou toda com a barra de tomos.

**2. Ir para o tomo.** Barra discreta no topo do canvas com um botão por fileira
(`TOMO 01`, `TOMO 02`, `Fora da divisão`). Clicar enquadra aquela fileira. Some
quando há uma fileira só — com um tomo seria ruído.

**3. Atalhos de teclado.** `+`/`−` zoom, `0` ajustar à tela, `1`–`9` ir para o
tomo N, `Esc` limpar seleção. Ativos só quando o foco não está num campo de
texto: senão digitar "0" no chat reenquadraria o canvas.

**4. Reenquadrar quando o conteúdo cresce.** Ao gerar documentos, os nós novos
nascem fora do enquadramento atual. Passa a reenquadrar **apenas quando o número
de nós aumenta** — nunca durante interação, nunca ao só mudar seleção, senão o
canvas briga com quem está navegando.

**Fora de escopo:** seleção múltipla, arrastar, agrupar, renomear, reclassificar.
São os sub-projetos 3 a 5.

## Arquitetura

O canvas usa React Flow, e navegar programaticamente exige a instância do fluxo.
Duas peças:

- `NexoCanvas` envolve o conteúdo num `<ReactFlowProvider>` (hoje não há), para
  que os controles usem `useReactFlow()` e chamem `fitBounds`/`zoomIn`/`zoomOut`.
- `NavegacaoDoCanvas` — componente com a barra de tomos e o registro dos
  atalhos. Recebe as fileiras já calculadas (`{ tomo, ids }[]`) e enquadra pelo
  `fitBounds` das posições daqueles nós.

O cálculo de "quais nós são deste tomo" já existe: `agruparPorTomo`, puro e
testado. A navegação consome, não recalcula.

## Degradação

| Situação | Comportamento |
|---|---|
| Uma fileira só (sem divisão) | A barra de tomos não aparece |
| Canvas vazio | Nada disso renderiza — o estado vazio segue como está |
| Foco num campo de texto | Atalhos inertes |
| Tomo sem nenhum nó | Não vira botão |

## Testes

No `shot-nexo.mjs`, no navegador:

- o minimapa existe;
- clicar em `TOMO 02` **muda o enquadramento** (comparo o `transform` do viewport
  antes e depois — é o que prova que navegou, não só que o botão existe);
- `0` reenquadra;
- gerar documento novo traz os nós novos para dentro da tela.

## Riscos

**O reenquadramento automático é o que mais pode irritar.** Se disparar em
qualquer mudança de estado, o canvas pula sob o cursor de quem está navegando.
Por isso a condição é estrita — só quando o número de nós **aumenta** — e é o
primeiro item a revisar se o canvas parecer inquieto no uso.
