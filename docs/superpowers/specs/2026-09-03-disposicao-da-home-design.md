# A disposição da home — uma lista, um vocabulário

**Data:** 03/09/2026
**Origem:** o mantenedor achou "meio ruim aqueles avisos da forma que se
dispuseram". O histórico dele estava quase vazio, então a tela foi **semeada**
com seis obras em estados diferentes e fotografada — o diagnóstico abaixo é do
que apareceu, não do que eu imaginei.

---

## O que a tela populada mostrou

### 1. Três tratamentos visuais para uma coluna só

Na mesma coluna, respondendo a mesma pergunta ("o que tem aqui?"):

| conteúdo | tratamento |
|---|---|
| `1 achado · parado há 19 dias` | âmbar, preenchido |
| `1 achado` | teal, preenchido |
| `2 com Victor` | cinza, texto solto |
| `sem pendência` | cinza, texto solto |

Os dois últimos são estados legítimos — "está com outra pessoa" e "está limpo" —
mas leem como **desabilitados**, porque perderam a caixa que os dois primeiros
têm. O olho aprende que caixa = importante e passa a não ler o resto da coluna.

### 2. Duas listas, e elas não são a mesma lista

"SEUS PROJETOS ABERTOS" e "TRABALHO RECENTE" mostravam quatro dos cinco projetos
**duas vezes**, em ordens diferentes. Parecia repetição pura.

Não é. As fontes são diferentes, e isso foi **medido**:

```
ESQUERDA (projetos abertos): SIM040-26, SIM117-25, SIM088-25, SIM118-25, SIM063-26
DIREITA  (trabalho recente): SIM118-25, SIM117-25, SIM099-26, SIM088-25, SIM063-26, SIM040-26
                                                    ▲ só aqui
```

A esquerda vem de `AuditFeedback` e `Audit` (`painelDe`); a direita vem de
`NexoConversation`. Uma obra em que só se **montou volume**, sem auditoria
nenhuma, existe apenas na direita.

**Consequência que quase virou defeito:** matar a coluna da direita — que era o
plano óbvio contra a repetição — apagaria da home quem só monta volume. E
montagem é metade do uso do produto.

### 3. A tela manda continuar o que ela mesma põe em terceiro

A barra RETOMAR aponta para o `SIM118-25`. Na lista logo abaixo, ordenada por
"mais parados primeiro", ele é o **terceiro**. Duas instruções de foco que
discordam na mesma dobra.

### 4. A marca de prefeitura teve o contrato quebrado

Isto eu diagnostiquei **errado** primeiro, e o erro está registrado porque ele
muda a solução. As "barrinhas sem legenda" são a `MarcaDaPrefeitura`, e o
cabeçalho do próprio componente diz:

> "A marca é redundante por construção: em toda tela em que ela aparece, o nome
> da prefeitura está escrito a poucos pixels dela."

Na home isso não acontece: a cidade aparece na coluna da direita e **não** na
lista da esquerda, que é onde a marca está. O problema nunca foi a marca ser
muda — foi a tela esconder a palavra que a decodifica.

---

## As decisões

### Uma lista só, alimentada pelas três fontes

A lista passa a conter todo projeto com **achado em aberto, auditoria recente OU
conversa recente**. A união, não a interseção — é o que impede o `SIM099-26` de
sumir.

"Trabalho recente" deixa de ser uma coluna. A recência vira o que sempre foi: um
critério, não uma segunda lista.

### O retomar é a PRIMEIRA LINHA da lista, não uma barra

Marcado, com a mesma forma das outras linhas. Resolve os dois problemas de uma
vez: some o conflito de ordem (ele está em cima porque é o retomar, e a
ordenação começa abaixo dele) e some a repetição de mostrá-lo em dois lugares.

### Um vocabulário só na coluna de estado

Sempre chip: mesma forma, mesma altura, contorno sempre presente. Só a cor muda.

| estado | tom |
|---|---|
| achado com você, parado | âmbar |
| achado com você, fresco | teal |
| com outra pessoa | cinza, com o nome |
| sem pendência | cinza apagado |
| só montagem | neutro |

O último **não existe hoje** — é o caso que a coluna da direita cobria por
acidente, e que agora precisa de representação própria.

### A cidade entra ao lado do nome; a marca fica

A marca volta a cumprir o contrato dela. "Sem cidade" é escrito por extenso, em
vez de deixar um `·` pendurado como hoje aparece no `SIM040-26`.

### O orbe não muda

Ele come ~280px da primeira dobra e a densidade agradeceria recolhê-lo para quem
já tem histórico. **Decisão do mantenedor: fica.** É a identidade do produto, e
trocá-la por 280px é um mau negócio. A lista ganha o espaço que a fusão libera.

### O agrupamento por seções fica PRONTO, e desligado

Foi considerado e desenhado (as duas alternativas foram comparadas com 6 e com
15 obras). Com 6 obras, seções dão quatro títulos para seis linhas — a tela vira
índice de si mesma. Com 15, elas ganham.

**A expectativa declarada é 5 a 8 obras abertas**, então vale a lista única. Mas
a decisão é reversível de graça: o estado de cada projeto sai para um módulo
puro, e agrupar por ele passa a ser uma decisão de uma linha no dia em que a
lista crescer.

**A objeção que sobreviveria ao agrupamento**, e que fica registrada para o dia
em que ele for ligado: com seções, a obra **troca de seção sozinha** quando
alguém devolve um achado — some de "com outros" e reaparece em "com você" sem a
tela dizer que se mexeu. Quem ligar o agrupamento precisa resolver isso junto.

---

## Onde mora cada coisa

**`lib/estado-do-projeto.ts` — novo, PURO.** Recebe o que o projeto tem (itens
em aberto, direção de cada um, dias parados, se houve montagem) e devolve o
chip: tom e texto. É onde os cinco casos ficam provados em node cru, em vez de
morarem numa condição JSX que ninguém consegue exercitar — e é o que torna o
agrupamento futuro barato.

**`lib/painel.ts`.** `painelDe` passa a devolver **uma** lista unificada. Hoje
ela monta `projetos` (de pendências/auditorias) e `trabalho.projetos` (de
conversas) separadamente; passa a fundir as duas por `projectId`, preservando o
que cada fonte sabe. O `ondeParou` continua, porque ele é quem nomeia a primeira
linha.

**`components/home/painel-do-usuario.tsx`** e
**`components/home/onde-voce-parou.tsx`.** O desenho da lista e a absorção da
barra de retomada na primeira linha.

---

## O que NÃO se toca

- A ordenação "mais parados primeiro" — é o critério que a tela já anuncia, e
  ele continua certo.
- O cartão expansível com os achados dentro.
- `/api/trabalho/meu` e a fila de achados — é outra tela, com outra pergunta
  ("o que exige ação sua"), e ela não deve herdar as decisões desta.
- O orbe e a barra do topo.

---

## Como se prova

**Puro (`npm run test:estado-do-projeto`, node cru):** os cinco estados, a
precedência entre eles (um projeto com achado parado E montagem recente é
"parado", não "montagem"), o limiar da tarja, e o caso do projeto sem cidade.

**A fusão (`npm run test:painel` ou equivalente):** que a união traz o projeto
que só tem conversa, que ela não duplica o que está nas duas fontes, e que o
retomar não aparece duas vezes.

**Navegador, sem gastar token:** a home semeada com as seis obras, medindo que
cada linha tem **um** chip e que a coluna de estado tem uma forma só — a
armadilha que este trabalho existe para fechar é justamente a heterogeneidade
que uma asserção de DOM não vê. Medir a caixa contra a janela, como sempre.

**A cena de teste** fica versionada: o script que semeia as seis obras vale mais
que a captura, porque a próxima pessoa a mexer nesta tela precisa dela para ver
o que está mexendo. Hoje ele existe só no meu scratchpad.
