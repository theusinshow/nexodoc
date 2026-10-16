# Corte dos tomos — arrastar onde cada tomo termina

Data: 16/10/2026. Status: desenho aprovado.

## Problema

A divisão em tomos sai de `planoPorDisciplina` (`lib/ld/ld-rules.ts:455`): uma
disciplina pequena sozinha entra com a grande vizinha e as duas se repartem por
igual. Com 5 pranchas de uma disciplina e 20 de outra, o automático dá tomos
parelhos; o engenheiro quer **tomo 1 = 5 + 10, tomo 2 = 10**.

Hoje isso só se faz arrastando prancha por prancha (ou seleção em caixa) entre
as fileiras e usando "+ Tomo". A ordem já está certa — o que falta é **escolher
onde o tomo termina** num gesto só. O canvas desenha uma fileira por tomo, cada
uma em grade (`modules/nexo/lib/layout-canvas.ts`), então não existe uma linha
reta onde um corte possa deslizar.

## Decisões (Matheus, 16/10)

1. **Régua dos tomos**: uma faixa linear com todas as pranchas em sequência e
   marcas de corte arrastáveis.
2. **Atalho na prancha**: "O tomo começa aqui" no menu da folha.
3. A ordem das pranchas não muda: só o corte.

## 1. A régua

- Faixa fina no topo do canvas, acima das fileiras, visível quando o volume tem
  pranchas. Cada prancha é uma célula pequena na cor da disciplina, na ordem da
  projeção (a mesma que a montagem lê).
- Entre o último de um tomo e o primeiro do seguinte, uma **marca de corte**
  com alça.
- **Arrastar a marca**: ela encaixa entre duas pranchas. Durante o arrasto, um
  rótulo ao vivo: "Tomo 1 · 15 folhas · Tomo 2 · 10 folhas", com o peso
  estimado quando o tamanho dos arquivos das pranchas é conhecido (pranchas
  guardadas). Tomo que passaria de `TETO_DO_TOMO_BYTES`
  (`modules/nexo/lib/entrega-do-volume.ts:16`) fica âmbar **antes** de soltar.
- **Clicar num vão** sem corte cria um corte ali (tomo novo).
- **Encostar uma marca na vizinha** junta os dois tomos (o corte some).
- Uma marca não atravessa a outra; nenhum tomo fica vazio.
- Passar o mouse numa célula mostra o número e o título da prancha; a fileira
  correspondente no canvas acende.
- Teclado: marca focada anda com ← →, Delete remove o corte.

## 2. O atalho na prancha

Item "O tomo começa aqui" no menu da folha: põe um corte imediatamente antes
dela. Desabilitado na primeira prancha e quando já há corte ali.

## 3. O que um corte grava

Puro, em `modules/nexo/lib/corte-dos-tomos.ts`:

- `cortesDasFolhas(lista, grupos) → number[]`: posições dos cortes a partir da
  divisão atual (a régua desenha isto).
- `gruposDosCortes(lista, cortes) → { id, patch: { grupo } }[]`: o tomo de cada
  folha a partir dos cortes.

Soltar uma marca chama o `moverFolhas` que já existe
(`NexoWorkspace.tsx:2972` → `conv.ajustarFolhas`) com **toda** a lista. Ou
seja, mexer no corte **congela a divisão**, exatamente como o arrasto de
prancha já faz — e "Voltar ao automático" (`voltarAoAutomatico`) desfaz igual.
O número de tomos é o número de cortes + 1 (`conv.declararTomos`).

Regenera só o afetado: capa e LD dos tomos cujo conjunto de folhas mudou — o
caminho de `moverFolhas` já faz isso (Parte 3 do desenho da montagem).

## 4. Fronteiras

- O corte pode cair **no meio de uma disciplina** (é o caso 5 + 10). Os blocos
  continuam: o tomo 2 abre com a separatriz e a LD da disciplina que continua,
  como já acontece quando o automático parte uma disciplina grande.
- Volume com uma prancha: régua sem marcas, só a célula.
- Com mais de ~120 pranchas as células encolhem até um mínimo e a régua rola na
  horizontal; a marca arrastada para a borda faz a régua rolar.

## 5. Testes

- `test:nexo:corte-dos-tomos`: ida e volta (`cortesDasFolhas` ∘
  `gruposDosCortes` = identidade), o caso 5 + 20 → cortes em 15 → [15, 10],
  juntar por encostar, criar no vão, nenhum tomo vazio, folha removida fora da
  conta.
- Prova no navegador (build de produção, `nexodoc-manifesto-recarrega-dev`):
  com um volume de 2 disciplinas, arrastar o corte, conferir as fileiras e o
  PDF de cada tomo montado. A extensão do Chrome não mede arrasto de verdade
  (`nexodoc-medir-transicao`): o arrasto se prova com eventos de ponteiro
  injetados e asserção na projeção, e o resultado na tela.

## Fora do escopo

- Reordenar pranchas ou blocos pela régua (o arrasto no canvas já faz).
- Mover pranchas entre volumes diferentes.
- Mudar a regra automática (`planoPorDisciplina`).
