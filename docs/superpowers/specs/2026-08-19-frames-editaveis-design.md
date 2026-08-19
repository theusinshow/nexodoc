# Os frames editáveis do chat: dois modos, e a volta ao sistema

**Data:** 2026-08-19
**Estado:** desenho aprovado, plano por escrever

## O problema, medido

Montar volume, capa, LD e separatriz acontece em frames editáveis dentro da
coluna do chat. Hoje eles estão "apertados, pequenos e muito juntos" — e isso
não é questão de gosto. É a `DESIGN.md` sendo furada em **71 lugares** nos cinco
arquivos envolvidos.

| Violação | Ocorrências | O que a DESIGN.md diz |
|---|---|---|
| `text-[11px]` | 18 | a rampa "não tem buracos… para que nenhuma tela invente um tamanho fora da escala (`text-[11px]`, `text-[15px]`)" |
| `text-[10px]` | 13 | "microrrótulos podem cair a 11px, **nunca abaixo**" |
| Espaçamento `0.5` / `1.5` / `2.5` | 40 | "Grade base de 4px; todo espaçamento é múltiplo de 4" |
| Campo com ~25px de altura | todos | "**Campos.** … altura 40px (32px compacto)" |

Arquivos: `FrameDoDocumento.tsx`, `PlanoDeGeracao.tsx`, `BlocoDaLd.tsx`,
`EditorDoNo.tsx`, `ConfirmationCard.tsx`.

## A causa, e ela é interessante

O cabeçalho do `FrameDoDocumento` promete uma coisa e o corpo faz outra:

> "Não é pré-visualização fiel (fonte e brasão são do ODT); é a ESTRUTURA, que é
> o que se confere antes de gerar."

Mas o componente tem `classeDeCorpo(paragrafo.corpo)`, que **importa o corpo da
fonte do ODT para dentro da UI**: 16pt vira `text-sm`, 13pt vira `text-xs`, e
abaixo disso vira `text-[11px]`. Ele afirma não ser fidelidade e copia a
tipografia do documento assim mesmo.

É daí que vem o "pequeno". Você está lendo uma folha A4 encolhida numa coluna de
520px — e o rodapé de 8pt do modelo vira um campo que não dá para acertar com o
cursor.

---

## Seção 1 — Um componente, dois modos

`FrameDoDocumento` ganha `modo: "campo" | "documento"`.

**O que NÃO muda entre os modos:** ordem dos parágrafos, alinhamento e número de
linhas por marcador. Os três continuam saindo do `content.xml`, que é a razão de
o frame existir — acrescentar um campo ao modelo continua bastando, sem código.

**`campo`** — o padrão, dentro do chat. `classeDeCorpo` sai; entram os degraus
nomeados da escala. Campo com 32px (o compacto documentado), espaçamento em
múltiplos de 4. Deixa de ser miniatura e passa a ser um formulário com a FORMA
do documento — que é exatamente o que o cabeçalho do componente sempre disse
que ele era.

**`documento`** — na coluna alargada. `classeDeCorpo` volta e o texto sai no
corpo do documento, porque ver o resultado é o ponto deste modo.

**Os campos continuam controláveis nos dois.** No modo `documento` o TEXTO é
fiel — sai no corpo que o ODT manda —, mas a CAIXA nunca desce dos mesmos 32px
que o modo `campo` usa. Os dois modos compartilham o piso de altura; o que varia
entre eles é só o tamanho do texto dentro.

Fidelidade total devolveria o problema por outra porta: o rodapé de 8pt do
modelo viraria um campo de 12px de altura, e o modo criado para CONFERIR seria
o mais difícil de operar de todos.

**Um prop, não dois componentes.** Duas implementações do mesmo frame é a
sincronia que se quebra na primeira mudança de modelo — e o modelo muda, que é
a premissa inteira deste componente.

---

## Seção 2 — "Ver como sai" alarga a coluna

Nenhuma superfície nova. A coluna do copiloto **já é redimensionável**
(`ShellSplitter`, `--nexo-copilot-w`, persistida em `nexo:copilot-w`), e o botão
reusa esse mecanismo:

1. guarda a largura atual;
2. aplica a largura de documento;
3. troca o frame para `modo="documento"`;
4. ao voltar, restaura a largura guardada e o modo.

O mapa e o chat continuam na tela. Não há modal para gerenciar foco, nem tela
que troca — o custo de ida e volta é uma transição de largura, e o `ShellSplitter`
já sabe fazê-la.

**A largura de documento sai medida, não escolhida:** o mínimo em que a folha
cabe sem o parágrafo mais largo do modelo quebrar. Fica em variável CSS ao lado
das outras larguras do shell, não em número solto no componente.

**O breakpoint é de CONTAINER, não de janela.** A coluna é estreita enquanto a
janela é larga; `xl:` mente aqui. Ver [[nexodoc-breakpoint-de-container]] — é
uma armadilha que este produto já pagou uma vez.

---

## Seção 3 — A dívida do sistema, nos cinco arquivos

As 71 violações voltam para a escala. Isso não é enfeite: é parar de furar o
sistema que o resto do produto segue, e é o que faz o conserto durar — um frame
"melhorado" fora da escala volta a divergir na próxima tela que alguém copiar
daqui.

- **31 tamanhos** → degraus nomeados (Mono Label 12px é o piso; 11px só em
  microrrótulo; 10px não existe).
- **40 espaçamentos** → múltiplos de 4.
- **Campos** → 32px compacto, `nx-cut-7` no wrapper, o anel de foco por dentro.

O que NÃO entra: inventar tokens, criar variante nova de componente, ou mexer
em tela fora destes cinco arquivos.

---

## Como se sabe que funcionou

| Seção | Prova |
|---|---|
| 1 | Um script conta as violações nos cinco arquivos e falha se houver `text-[10px]`, espaçamento fora da grade ou campo abaixo de 32px. O número de partida (71) fica registrado. |
| 2 | Alargar e voltar restaura a largura anterior; a folha aparece sem o parágrafo mais largo do modelo quebrar. Medido contra a caixa, não só presente no DOM — ver [[nexodoc-provar-visivel]]. |
| 3 | O contador do item 1 chega a zero. |

## Fora de escopo

- **A fidelidade de fonte e brasão.** Continua sendo do ODT; o frame nunca foi e
  não passa a ser pré-visualização fiel de tipografia.
- **Telas fora dos cinco arquivos.** A mesma dívida existe em outros lugares do
  produto; corrigi-la aqui não autoriza uma varredura geral no mesmo commit.
- **Modal ou aba nova.** Foi considerado e descartado: a coluna que alarga
  reusa o splitter que já existe e não tira o mapa da tela.
