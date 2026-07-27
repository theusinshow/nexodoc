# Nexo — cada tomo é um volume

**Data:** 2026-07-27
**Estado:** desenho aprovado, pronto para virar plano de implementação

## Problema

Pedir 2 tomos hoje **não produz dois documentos — produz um documento com duas
partes dentro**:

| Artefato | O que sai com `numTomos: 2` |
|---|---|
| Capa | 1 PDF com 2 páginas (uma capa por tomo) |
| LD | 1 ODT com 2 seções, `(TOMO 01)` e `(TOMO 02)` |
| Volume | 1 PDF com tudo junto: as duas capas, as duas LDs, todas as folhas |

O canvas mostra um nó de cada porque existe um artefato de cada. O escritório
entrega **um volume físico por tomo**, então o resultado atual não é usável: quem
recebe precisaria fatiar o PDF à mão.

O modelo já sabe dividir — `buildBalancedTomos` calcula a faixa de folhas de cada
tomo, e `generatePages` já emite uma página de capa por tomo. O que falta é
**emitir documentos separados**.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Quais folhas em cada tomo | **Automático e balanceado**, como hoje | É o que `buildBalancedTomos` já faz e o que a LD já usa; nenhuma decisão nova no fluxo |
| Saída do volume | **Um PDF por tomo** (`volume-tomo-01.pdf`, `volume-tomo-02.pdf`) | Cada tomo é um volume físico; foi o pedido literal |
| Identidade dos artefatos | Sufixo `:t01` **só quando há mais de um tomo** | Com um tomo os ids ficam idênticos aos de hoje: zero migração no caso comum |

## Arquitetura

### 1. O artefato passa a ser por tomo

As chaves ganham o tomo quando, e só quando, `numTomos > 1`:

```
capa:<codigo>            → capa:<codigo>:t01, capa:<codigo>:t02
ld:<codigo>:<rev>        → ld:<codigo>:<rev>:t01, …
separatriz:<codigo>      → separatriz:<codigo>:t01, …
volume:<codigo>          → volume:<codigo>:t01, …
```

Com um tomo só, nada muda — conversas existentes continuam encontrando seus
resultados sem fallback nenhum.

### 2. Um card por tomo

O `ConfirmationCard` de `capa`, `ld` e `separatriz` passa a renderizar **N cards**
quando `numTomos > 1`, um por tomo, cada um com seu id e seu número de tomo. Cada
card gera o documento **daquele** tomo:

- **Capa**: `postCapa({ …params, numTomos: 1, tomoNumero: t })`. O builder já
  suporta tomo específico — é o caminho que hoje quase não se usa.
- **Separatriz**: uma por tomo, com o mesmo título da LD.
- **LD**: precisa da fatia de folhas, ver abaixo.

O número do tomo respeita o `tomoInicial`: com `tomoInicial: 4` e `numTomos: 2`,
os cards são TOMO 04 e TOMO 05.

### 3. A LD passa a fatiar as folhas (o único código realmente novo)

Hoje `buildLdProposal` com `tomoNumero > 0` põe `(TOMO 0N)` no título mas mantém
**todas** as folhas — o que estava certo para "replicar um tomo" e está errado
para "o tomo N tem as folhas X a Y".

Ganha uma opção nova: dado `numTomos` e qual tomo é, a proposta inclui só as
linhas da faixa daquele tomo, usando as faixas que `buildBalancedTomos` já
calcula. `referenceTotal` continua sendo o total do conjunto — o selo da folha
diz "05/24" e a LD do tomo 1 precisa continuar dizendo isso, não "05/12".

Esta é a peça **pura e testável** do trabalho: dadas N folhas e T tomos, a fatia
do tomo t é a faixa esperada, as fatias são disjuntas e a união cobre tudo.

### 4. Um volume por tomo

`VolumeConfirmation` passa a montar **um volume por tomo**, cada um com a capa, a
separatriz, a LD daquele tomo e **as folhas da faixa daquele tomo**. O recorte de
páginas por arquivo que a montagem já faz é o mesmo mecanismo; muda só o conjunto
de pranchas que entra.

Nomes: `volume-tomo-01.pdf`, `volume-tomo-02.pdf`.

### 5. O canvas agrupa por tomo

Cada nó ganha o tomo a que pertence. Com mais de um tomo, o canvas desenha **uma
faixa por tomo** (capa → separatriz → LD → pranchas daquele tomo), rotulada
"TOMO 04". Com um tomo, o desenho é o de hoje — uma fileira só, sem rótulo.

## Degradação

| Situação | Comportamento |
|---|---|
| `numTomos: 1` | Tudo idêntico a hoje: ids sem sufixo, um card de cada, um volume |
| Conversa antiga com 2 tomos | Os artefatos antigos (chave sem sufixo) não casam com as chaves novas e aparecem como PROPOSTA. Gerar de novo produz o resultado correto — que é o ponto: o resultado antigo estava errado |
| Tomo sem capa ou LD gerada | O volume daquele tomo sai sem a parte ausente, como já acontece hoje; o card do volume mostra qual falta |
| Menos folhas que tomos (ex.: 2 folhas, 3 tomos) | `buildBalancedTomos` já resolve dando ao menos uma folha por tomo enquanto houver; o excedente de tomos fica sem folhas e o card avisa |

## Testes

Puros, no padrão `scripts/test-nexo-*.ts`:

- **fatia de folhas**: as fatias de T tomos são disjuntas, cobrem todas as folhas
  e respeitam a ordem; a fatia do tomo t bate com a faixa de `buildBalancedTomos`.
- **numeração**: com `tomoInicial: 4` e `numTomos: 2`, os tomos são 04 e 05 (já
  coberto por `tomoLabels`, e agora ligado à fatia).
- **ids**: com um tomo a chave não ganha sufixo; com dois, ganha.

A montagem de N volumes e o agrupamento do canvas são I/O e interação — vão para
a verificação manual.

## Riscos

**O maior é a LD do tomo mentir sobre o total.** Se a fatia mudar
`referenceTotal`, a LD do tomo 1 passa a dizer "05/12" enquanto o selo impresso na
prancha diz "05/24". O total é do conjunto, não do tomo — e essa é a diferença
que o teste precisa travar.

**O segundo é a explosão de cards.** Quatro tomos passam a render doze cards
(capa, separatriz e LD de cada). Se ficar pesado na conversa, o caminho é agrupar
por tomo num card só com as três linhas — mas isso é ajuste de apresentação,
depois de ver o volume real.
