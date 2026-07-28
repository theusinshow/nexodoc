# Nexo — Página como nó

**Data:** 2026-07-28
**Estado:** desenho aprovado, pronto para implementar

Terceiro de cinco sub-projetos do canvas manipulável. É o primeiro que aparece na
tela: as folhas deixam de ser uma pilha e viram nós, e a edição manual passa a
existir de fato — escrevendo em `ajustes`, a fundação que o sub-projeto 2 deixou
pronta e desligada.

| # | Sub-projeto | Depende de | Estado |
|---|---|---|---|
| 1 | Navegação | nada | **feito** (`0a40ebe`, `95311c2`) |
| 2 | Document State | nada | **feito** (`dac082b`, `523a4d5`) — mas `ajustes` está desligado |
| 3 | **Página como nó** (este) | 2 | a fazer |
| 4 | Seleção tipo AutoCAD, arrastar, agrupar | 2 e 3 | a fazer |
| 5 | Montagem lendo ordem e grupos manuais | 2 e 4 | a fazer |

## O problema

Duas coisas estão pela metade.

Na tela, as folhas de um tomo são **um** nó só — a pilha com uma lista rolável
dentro (`StackNode`, `NexoCanvas.tsx`). Uma lista dentro de um nó não é
manipulável: não dá para selecionar uma folha, endereçá-la, muito menos arrastá-la
para outro tomo depois.

No estado, `folhas(selos, ajustes)` já é o ponto único por onde LD, capa,
separatriz, volume e canvas recebem os dados — mas `ajustes` é a constante
congelada `SEM_AJUSTES` (`NexoWorkspace.tsx`). A projeção é a identidade porque
não existe ninguém que escreva ajuste. Este sub-projeto é esse alguém.

## Escopo

**Entra:**

- cada folha é um nó no canvas, dentro da fileira do seu tomo;
- o nó mostra o que o selo diz (número da folha, título) e marca `editado`;
- **abrir a página original** do PDF, em tamanho real, numa aba;
- **corrigir o título** da folha — escreve `titulo` em `ajustes`;
- `ajustes` passa a viver no `conversation-store`: persiste e volta no restore.

**Não entra** (e por quê):

| Fora | Motivo |
|---|---|
| Arrastar, seleção em bloco, agrupar | É o sub-projeto 4 inteiro |
| Reclassificar disciplina | Decisão do usuário: corrigir o título é o caso real; disciplina errada é rara |
| Descartar folha do volume | Exigiria um campo `fora` que o Document State não previu — só se aparecer a necessidade |
| Miniatura da página no nó | Decisão do usuário: o texto do selo basta para reconhecer a folha. Renderizar 200 páginas trocaria o trabalho por um trabalho sobre performance |

## Estado: `ajustes` no `conversation-store`

`ajustes: Record<FolhaId, Ajuste>` entra no store da conversa, ao lado de
`seloResults`, com um único escritor:

```ts
ajustarFolha(id: FolhaId, patch: Ajuste): void   // = aplicarAjuste, já testado
```

Vai junto no registro persistido (`StoredConversation`) e volta no
`selectConversation` — pelo mesmo caminho de `seloResults`, com o mesmo debounce.
Ajuste é texto: cabe folgado, e um `useState` local perderia 40 títulos corrigidos
num F5, o que é pior do que não ter o recurso.

No `NexoWorkspace`, `SEM_AJUSTES` some e o ponto único vira:

```ts
const selos = useMemo(() => folhas(selosLidos, conv.ajustes), [selosLidos, conv.ajustes]);
```

O memo continua sendo o **único** lugar onde a projeção é aplicada. `conv.ajustes`
precisa ser referência estável entre renders (vem do `useState` do store) pelo
mesmo motivo que `SEM_AJUSTES` era constante de módulo: um objeto novo a cada
render recria todos os nós e fecha o popover de edição no instante em que ele abre
— defeito que já aconteceu.

## O que o canvas recebe

`pranchasCount` e `pranchas: PranchaInfo[]` morrem. `PranchaInfo` era uma segunda
projeção paralela dos mesmos selos, e `Folha` já tem tudo que ela tinha mais os
dois campos que faltavam: `id` (endereçável) e `editado` (marcável).

```ts
<NexoCanvas folhas={selos} numeros={numerosDasFolhas} />
```

A prop `selos` some junto: ela alimentava a regeneração pelo nó de artefato, e
`Folha extends SeloForLd` — o canvas passa `folhas` adiante no lugar dela, sem
conversão. Fica uma prop só com os dados das folhas, que é o ponto.

`numeros: Record<FolhaId, number | null>` existe porque o número da folha **não
vem cru do selo**: sai de `resolveSheetNumbers`, que concilia a numeração entre
arquivos. É derivação dos selos, não ajuste — por isso fica no workspace e não
entra no módulo puro `folhas.ts`.

### Duas mudanças de comportamento, de propósito

1. **A ordem na tela passa a ser a ordem da projeção** (arquivo/página, com
   `ordem` manual por cima), não mais a ordenação por número de folha que a pilha
   fazia. A tela precisa mostrar a ordem em que o volume será montado — senão
   arrastar, no sub-projeto 4, reordenaria uma lista que o PDF não segue.
2. **Folha sem número e sem descrição deixa de ser escondida.** Hoje ela é
   filtrada da pilha. Ela entra no volume; omiti-la é o canvas mentir sobre o que
   vai ser montado — e é justamente a folha mal lida que o usuário precisa achar
   para corrigir.

### A divisão por tomo troca de função

O canvas fatia as folhas com `faixasDosTomos` (por quantidade). A projeção tem
`gruposDasFolhas`, que respeita `grupo` manual e só cai na divisão automática
quando não há nenhum. A troca entra **agora**, enquanto ainda não existe grupo
manual e as duas são comprovadamente idênticas (há teste para isso). Se ficasse
para depois, no sub-projeto 4 o usuário arrastaria uma folha e ela voltaria para o
lugar — porque a tela continuaria dividindo por contagem.

## O nó da folha

Caixa de ~120×56, texto puro (nenhum PDF renderizado):

- número da folha em mono tabular, ou `—` quando não há;
- título (`conteudo` da projeção) truncado;
- quando `editado`: borda âmbar e um ponto — distingue o que o sistema leu do que
  o usuário mudou, que é a razão de `editado` existir.

Clicar **seleciona** (pelo `onNodeClick` controlado que o canvas já usa — os nós
seguem `draggable: false` neste sub-projeto). Selecionado, o nó mostra duas ações:

| Ação | Efeito |
|---|---|
| Abrir a página | `window.open` do PDF original em `#page=N`, nova aba |
| Corrigir o título | Popover inline, mesmo padrão do `ArtifactNode`. Salvar chama `ajustarFolha(id, { titulo })`; limpar o campo chama com `{ titulo: undefined }` e desfaz o ajuste |

Abrir a página precisa dos bytes, que moram em `pranchaFiles` no workspace. O
canvas não os recebe: recebe um `onAbrirFolha(folha)` do workspace, que resolve o
arquivo por `fileName`, cria o object URL e o retém num cache por arquivo,
revogado no mesmo ponto onde `pranchaFiles` já é zerado (trocar de conversa,
desanexar). Revogar logo após o `open` corre o risco de matar a aba antes de ela
carregar.

## Degradação

| Situação | Comportamento |
|---|---|
| Conversa restaurada do histórico | `pranchaFiles` está vazio: **abrir a página fica desabilitado**, com "reanexe as pranchas para ver a página". Corrigir o título continua funcionando — ajuste é texto e persiste |
| Nenhuma prancha lida | Canvas igual a hoje (documentos, sem folhas) |
| Folha sem título e sem número | Nó aparece com `—`; é o que o usuário precisa achar para corrigir |
| Ajuste órfão (prancha removida) | Já resolvido na projeção: ignorado, não apagado |
| Um tomo só | Sem rótulo de fileira, como hoje |

## Layout

Dentro da fileira do tomo, as folhas viram uma **grade** à direita da LD e à
esquerda do volume, 6 por linha. A fileira cresce para baixo, que é a direção em
que o canvas já cresce (uma fileira por tomo), e o `fitView` continua enquadrando
o projeto inteiro. Uma esteira horizontal empurraria o nó do volume para fora da
tela justamente no projeto grande.

O `y` das fileiras passa a ser **acumulado**, não `linha * 330` fixo: um tomo de
200 folhas ocupa 34 linhas de grade e invadiria a fileira de baixo.

O rótulo do tomo ganha a contagem — "Tomo 01 · 18 folhas" —, que é a informação
que a pilha dava e desaparece com ela. As fileiras navegáveis
(`NavegacaoDoCanvas`, barra e teclas 1–9) passam a incluir os ids das folhas, para
"ir para o tomo" enquadrar a fileira inteira.

## Testes

Puros, em `scripts/test-nexo-folhas.ts`:

- corrigir o título e **reler as pranchas** preserva a correção (o caso que
  justifica a separação selo/ajuste);
- `ajustarFolha` com `titulo: undefined` desfaz o ajuste e a folha volta ao que o
  selo dizia, com `editado: false`;
- título só de espaços é tratado como ausente — não vira título em branco na LD;
- **`gruposDasFolhas` e `faixasDosTomos` dão a mesma divisão quando não há grupo
  manual** — é esta igualdade que autoriza a troca no canvas.

No navegador (`shot-nexo.mjs`), o teste que importa: corrigir o título de uma
folha e **gerar a LD depois**, conferindo que o texto corrigido saiu no PDF. Ver o
nó mudar na tela não prova nada — a edição valer é a montagem ler o ajuste.

## Riscos

**Volume de nós.** Um projeto pode ter 200+ folhas, num canvas que hoje desenha
uns 15 nós. O nó é texto puro, mas isso é palpite até medir. Plano: medir com 200
folhas no navegador e, **só se engasgar**, ligar `onlyRenderVisibleElements` — que
interage mal com `fitView`, então não entra preventivamente.

**Medido em 2026-07-28** (200 folhas semeadas no IndexedDB, sem gastar IA;
`scratchpad/medir-200-folhas.mjs`): 200 nós desenhados em ~410ms, pan de 2s a
~60fps com o viewport de fato se movendo, seleção de uma folha em ~290ms, zero
erros de runtime. **`onlyRenderVisibleElements` NÃO foi ligado** — o nó de texto
puro aguentou.

**Achado da medição, ainda em aberto:** com 200 folhas a grade fica com ~34 linhas
(~2.200px de altura) e o `fitView` **não** enquadra o projeto inteiro — o
`minZoom={0.3}` do canvas trava o afastamento e a grade sai pela borda de baixo.
Ou seja, a promessa "a grade cresce em altura e o fitView continua enquadrando o
projeto inteiro" vale para volumes normais, não para os de 200 folhas. As saídas
são baixar o `minZoom` ou alargar a grade conforme a quantidade (mais colunas
quando há muita folha). Decisão adiada: não é regressão — antes disso as folhas
nem eram nós.

**Perder o que a pilha dava.** A pilha mostrava contagem e disciplina dominante de
um relance. A contagem vai para o rótulo do tomo; a disciplina dominante se perde,
e isso é aceitável — ela não era usada para decidir nada.

**A troca de props é o ponto de regressão.** `PranchaInfo` sai e `Folha` entra em
todos os pontos de uso de uma vez. É a mesma classe de defeito que já mordeu
antes: mudar um caminho e esquecer o outro. A verificação no navegador precisa
cobrir a geração, não só a tela.
