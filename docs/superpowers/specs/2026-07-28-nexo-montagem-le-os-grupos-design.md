# Nexo — A montagem lê os grupos e a ordem (sub-projeto 5)

**Data:** 2026-07-28
**Estado:** desenho aprovado, pronto para implementar

Último sub-projeto do canvas manipulável. Fecha a promessa do 4A: o que foi
arrastado na tela passa a valer no PDF montado.

## O problema

O 4A entregou o gesto — arrastar folhas entre tomos e reordená-las escreve `grupo`
e `ordem` em `ajustes`, e o canvas desenha o resultado. Mas a montagem **ignora os
dois**:

- `server/nexo/build-ld-proposal.ts:199` fatia o tomo por `faixasDosTomos`, ou
  seja, por QUANTIDADE — o `grupo` não é consultado;
- a mesma função, na linha 189, reordena as linhas por número de folha do carimbo
  antes de fatiar — a `ordem` manual se perde;
- `ConfirmationCard.tsx:935` fatia o volume por `faixasDosTomos` também.

Com 6 folhas em 2 tomos, depois de arrastar a folha 1 para o tomo 2:

```
canvas   tomo 1: [2, 3]        tomo 2: [4, 1, 5, 6]
PDF      tomo 1: [2, 3, 4]     tomo 2: [1, 5, 6]
```

O canvas mostra uma organização que o documento não segue — que é, pela decisão
tomada no Document State, **pior do que não ter o recurso**.

## Grupo: quem decide a divisão muda de lado

O servidor já tem o caminho certo embutido: quando a requisição traz
`tomoNumero > 0`, ele põe `numTomos = 1` e **não fatia nada**
(`build-ld-proposal.ts:137-141`). Basta o cliente mandar **só as folhas daquele
tomo**, que ele já conhece por `gruposDasFolhas` — a mesma divisão que o canvas
desenha.

Nenhuma regra nova no servidor. O que muda é quem decide, e a decisão passa a
existir num lugar só.

## Ordem: o carimbo manda, salvo se o usuário mexeu

O servidor ordena as linhas por número de folha do carimbo. Isso continua certo
quando ninguém arrastou nada — é o comportamento validado à mão, e trocá-lo
mudaria o resultado de projetos que já estavam corretos.

Entra uma opção na requisição:

```ts
/** Mantém a ordem em que as folhas chegaram, em vez de ordenar pelo carimbo. */
respeitarOrdem?: boolean;
```

**Quem decide ligá-la é o cliente**, porque é ele que sabe se alguma folha daquele
tomo tem `ordem` manual. A regra escolhida pelo usuário — "número do carimbo,
salvo se você reordenou" — fica num lugar só, do lado do canvas.

## Volume

`ConfirmationCard.tsx:932-937` troca `faixasDosTomos` por `gruposDasFolhas`. O
filtro dos arquivos logo abaixo deriva dos selos do tomo, então acompanha sozinho
— e era ele que impedia o volume do tomo 2 de sair com as 24 folhas.

## O que NÃO muda

Capa e separatriz não listam folhas: continuam como estão.

## Testes

Puro, em `scripts/test-nexo-drop.ts` (é lá que mora a regra do arrasto):

- `folhasDoTomo(projecao, tomo, numTomos)` devolve exatamente o que
  `gruposDasFolhas` devolve para aquele tomo, na ordem da projeção;
- sem nenhum ajuste, o resultado é idêntico ao que `faixasDosTomos` daria — a
  garantia de não-regressão de todo projeto que nunca foi arrastado;
- `precisaRespeitarOrdem(folhasDoTomo)` é falso sem `ordem` manual e verdadeiro
  com uma folha reordenada.

No navegador: arrastar a folha 1 do tomo 1 para o tomo 2, regerar, e conferir no
PDF da LD do tomo 2 que ela está listada — e que sumiu da do tomo 1. É a prova de
que o gesto vale.

## Riscos

**Regressão em projeto sem arrasto nenhum.** Todo o valor do sub-projeto está em
mudar o que sai do PDF; o teste de não-regressão (sem ajustes, a divisão é
idêntica à de hoje) é o que separa "passou a respeitar o manual" de "mudou o
resultado de todo mundo".

**Dois caminhos de geração.** LD e volume fatiam em lugares diferentes (servidor e
cliente). Mudar um e esquecer o outro é a classe de defeito que já mordeu neste
módulo — o volume do tomo 2 saindo com as 24 folhas. A prova no navegador precisa
olhar o PDF, não a tela.
