# Nexo — Consequências do arrasto (sub-projeto 4B)

**Data:** 2026-07-28
**Estado:** desenho aprovado, pronto para implementar

Fecha o canvas manipulável. O 4A entregou o gesto e o 5 fez a montagem obedecê-lo;
faltam as três consequências de poder mexer: saber que o documento envelheceu,
poder desfazer a divisão manual, e ter para onde arrastar quando o tomo ainda não
existe.

| # | Sub-projeto | Estado |
|---|---|---|
| 1 | Navegação | **feito** (`0a40ebe`) |
| 2 | Document State | **feito** (`dac082b`, `523a4d5`, `d797012`) |
| 3 | Página como nó | **feito** (`5b7027d`..`c6400af`) |
| 4A | Mexer nas folhas | **feito** (`29c366b`..`bcffcef`) |
| 5 | Montagem lê os grupos e a ordem | **feito** (`625ca63`, `42385af`) |
| 4B | **Consequências do arrasto** (este) | a fazer |

## 1. A marca de desatualizado

**O problema:** arrastar uma folha para outro tomo — ou corrigir um título, desde o
sub-projeto 3 — deixa a LD e o volume já gerados descrevendo um conjunto que não
existe mais. Nada na tela avisa. Quem montar o volume nesse estado entrega um PDF
errado.

**A peça que já existe:** `estadoDoArtefato(saved, params)`
(`ConfirmationCard.tsx:183`) compara o `payload` gravado no momento da geração com
os params atuais e devolve `"pendente"` quando divergem. É exatamente a forma
certa; só falta a informação das folhas entrar nessa comparação.

**O que entra:**

```ts
/** Assinatura das folhas de um tomo: quem são, em que ordem, com que título. */
assinaturaDoTomo(doTomo: readonly Folha[]): string
```

Módulo puro (roda em Node pelado). O valor é gravado no `payload` do resultado na
hora de gerar, e recalculado a partir da projeção atual na hora de comparar.

**O que conta como mudança** (decisão do usuário): a composição do tomo, a ordem, e
o **título** de qualquer folha dele. A LD imprime o título de cada folha, então
corrigir um título deixa o PDF velho tanto quanto mover uma folha.

**Onde a marca aparece:** no nó do documento no canvas — é onde o usuário está
quando arrasta. O card do chat já mostra o estado `pendente` e continua como está.

## 2. Voltar ao automático

O 4A fez o primeiro arrasto **congelar** a divisão: toda folha ganha `grupo`. Sem
um caminho de volta, "Nº de tomos" vira um campo morto — pedir 3 tomos não
redivide nada, porque todas as folhas estão fixadas.

Um botão apaga o `grupo` de **todas** as folhas. Só ele: `ordem` e os títulos
corrigidos ficam, porque não são divisão — quem desfaz a divisão não está pedindo
para perder os títulos que reescreveu.

Aparece **só quando existe algum grupo manual**. Antes do primeiro arrasto seria um
botão que não faz nada, e a barra de tomos já é estreita.

## 3. Tomo novo pelo campo que já existe

Decisão do usuário: **não** se cria tomo arrastando para uma faixa vazia. O editor
do nó da capa já tem "Nº de tomos"; muda-se ali, a fileira nasce vazia, e aí se
arrasta para dentro dela com o gesto do 4A — nenhum código de arrasto novo.

**O que impede isso hoje:** as fileiras nascem de `agruparPorTomo(artifacts)`, ou
seja, dos documentos já gerados. Um tomo sem documento não tem fileira, e sem
fileira não há para onde arrastar.

As fileiras passam a nascer da união de três fontes:

1. os tomos que têm artefato gerado (hoje);
2. os tomos citados nos `grupo` dos ajustes (para onde o usuário já arrastou);
3. o `numTomos` gravado no `payload` dos documentos (a decisão declarada).

Com a divisão congelada, a fileira nova nasce **vazia** — nenhuma folha migra
sozinha para lá. É exatamente o comportamento desejado: o destino existe, e quem o
preenche é o gesto.

## Degradação

| Situação | Comportamento |
|---|---|
| Documento gerado ANTES desta mudança | Sem assinatura no payload: aparece como "pendente" uma vez, até a próxima geração. Risco assumido — versionar o payload custaria mais do que uma marca falsa numa conversa antiga |
| Nenhum grupo manual | O botão "voltar ao automático" não aparece |
| `numTomos` maior que os tomos com folha | As fileiras vazias aparecem; é o que dá destino ao arrasto |
| Tomo esvaziado pelo arrasto | A fileira continua existindo (tem artefato e/ou está dentro de `numTomos`), marcada como desatualizada |
| Capa e separatriz | Não listam folhas: a assinatura não entra no payload delas |

## Testes

Puros, em `scripts/test-nexo-drop.ts`:

- a assinatura muda quando uma folha entra ou sai do tomo;
- muda quando duas folhas trocam de ordem;
- muda quando o título de uma folha é corrigido;
- **não muda** quando nada mudou — é o teste que impede a marca de acender sozinha
  e virar ruído que se aprende a ignorar;
- as fileiras do canvas incluem um tomo declarado em `numTomos` que ainda não tem
  artefato nem folha.

No navegador: arrastar uma folha do tomo 1 para o tomo 2 marca as LDs dos **dois**
tomos; regerar apaga as marcas; "voltar ao automático" devolve a divisão original.

## Riscos

**A marca virar ruído.** Uma marca que acende à toa é pior que marca nenhuma —
aprende-se a ignorá-la, e aí ela não avisa quando importa. O teste de "não muda
quando nada mudou" é o que protege isso, e a marca falsa das conversas antigas
tem prazo: some na primeira geração.

**Três fontes para a mesma fileira.** Unir artefatos, ajustes e `numTomos` é onde
nasce divergência. A união é feita num lugar só, e é ela que decide — não pode
haver um segundo cálculo de "quais tomos existem" em outro ponto do canvas.
