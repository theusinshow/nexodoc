# Tabelas na extração — Design

> Spec fechada por brainstorm (18/08/2026). Fase 4 da
> `docs/analise-arquitetura-auditoria-2026-08-17.md`, na fatia que entrega valor
> verificável: a grade reconstruída **mais** a primeira regra que a consome.

## 1. Problema

A camada determinística inteira é ancorada em **prosa**. Os achados numéricos do
benchmark moram em **tabela**. É por isso que `runDeclaredTotalAreaRule` existe,
deveria pegar AUD-009/010/011 e não pega.

Confirmado na implementação (`lib/audit-coherence.ts`):

```js
/[áa]rea\s+(?:total\s+constru[íi]da|...)[^\d\n]{0,25}?(\d...)\s*m²/gi
```

A regra exige a **frase** "área total construída" a até 25 caracteres não
numéricos do valor. E o comentário dela explica por que foi apertada assim: sem
a âncora, ela pescava o limite normativo *"depósito com área total superior a
1.000 m²"*, que não é a área da obra. **A âncora que a torna precisa em prosa é
a mesma que a torna cega em tabela** — numa célula não há frase nenhuma antes do
número.

No 084_25 os valores em conflito são `4.448,91` no texto e `4.530,98` numa célula
de quadro de áreas. O parecer não viu.

`ExtractedPdfPage` é `{ page, text }`. O pdf.js entrega `transform[4]`/`[5]`
(x, y) por item — **os dados para reconstruir grade já chegam e são descartados**.

**Pré-requisito, já cumprido:** até 17/08/2026 a extração achatava a página numa
linha só. `mudouDeLinha` (`lib/texto-do-pdf.ts`) passou a preservar a quebra, e é
sobre essa primitiva que esta spec se apoia. Sem ela, nada aqui seria possível.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Escopo | **Fatia vertical:** extração + a primeira regra que a consome. Não é infraestrutura sem consumidor |
| Forma | **Linhas × células, sem semântica:** `{ pagina, linhas: string[][] }` |
| Cabeçalho | **Não identificado.** Nenhuma heurística decide o que é cabeçalho — heurística errada aí contamina toda regra que confiar nela |
| Reconstrução | **Linhas por `y`, colunas por fronteiras que se repetem** em linhas consecutivas |
| Tipo | `ExtractedPdfPage` ganha `tabelas?: Tabela[]` — **opcional**, nada que consome o tipo hoje muda |
| Regra consumidora | `runDeclaredTotalAreaRule`, alimentando o `found` que já existe |
| Ledger e reconciliação | **Fora**, e por decisão da própria análise: o Ledger só vale com o campo `qualificador` bem resolvido |

### Por que "linhas por y, colunas por fronteira repetida"

A alternativa natural — clusterizar o `x` de todos os itens da página — quebra
onde mais importa: numa página com prosa **e** tabela, os `x` da prosa entram no
cluster e contaminam as âncoras de coluna. Ela exigiria segmentar a região da
tabela antes, que é exatamente o que a fronteira repetida faz.

A propriedade que torna a fronteira repetida boa é **auto-seletiva**: prosa não
concorda em fronteira nenhuma de uma linha para a outra. A tabela se identifica
sozinha, sem ninguém precisar declarar onde ela começa.

Ler as bordas desenhadas (`getOperatorList`) foi descartado: muitas tabelas de
memorial não têm borda — são alinhadas por espaço em branco —, e seria uma
superfície nova e pesada do pdf.js para cobrir só o subconjunto com moldura.

## 3. Arquitetura

```
ItemDeTexto[] da página          (já existe, com x/y — lib/texto-do-pdf.ts)
   ↓
agrupar em LINHAS por y          (mudouDeLinha, já existe e já é testada)
   ↓
achar VÃOS horizontais na linha  (x do fim de um item ao início do próximo)
   ↓
fronteiras que se REPETEM em     ← a tabela se identifica sozinha aqui
linhas consecutivas
   ↓
recortar cada linha nas          Tabela = { pagina, linhas: string[][] }
fronteiras → células
   ↓
ExtractedPdfPage.tabelas?
   ↓
runDeclaredTotalAreaRule         alimenta o `found` que já existe
```

### `lib/tabela-do-pdf.ts` — novo, puro

Sem IO, sem `@/`, sem pdf.js. Recebe itens com coordenadas, devolve tabelas — o
mesmo contrato que `texto-do-pdf.ts` já cumpre, e o que permite testá-lo em node
cru sem PDF nenhum.

```ts
export type Tabela = { pagina: number; linhas: string[][] };

export function tabelasDaPagina(
  items: ItemDeTexto[],
  pagina: number,
): Tabela[];
```

**Constantes de calibragem**, todas em fração do corpo da fonte, como as de
`texto-do-pdf.ts` já são — nunca em pontos absolutos, que mudam com o zoom do
gerador do PDF:

| Constante | Papel | Valor inicial |
|---|---|---|
| `VAO_DE_COLUNA` | vão horizontal mínimo, em corpos de fonte, para separar células | `1.5` |
| `TOLERANCIA_DE_FRONTEIRA` | quanto duas fronteiras podem diferir em `x` e ainda contarem como a mesma coluna | `0.8` corpo |
| `MIN_LINHAS_DA_TABELA` | quantas linhas consecutivas precisam concordar para virar tabela | `3` |
| `MIN_FRONTEIRAS` | quantas fronteiras as linhas precisam ter em comum | `1` |

Os valores são **plausíveis, não medidos** (risco 2). `VAO_DE_COLUNA` em 1,5
corpo fica acima do espaço entre palavras (que `texto-do-pdf.ts` já trata em
fração menor) e abaixo do recuo típico entre colunas. `MIN_LINHAS_DA_TABELA = 3`
porque duas linhas concordando numa fronteira acontece por acaso em prosa
justificada; três, não.

O tipo `ItemDeTexto` vem de `texto-do-pdf.ts` por `import type` — apagado no
strip, então não cria dependência de runtime e o teste em node cru segue válido.

### A regra que consome

`runDeclaredTotalAreaRule` **não ganha lógica de comparação nova**. Ela já tem:
piso de plausibilidade (< 10 m² é descartado), agrupamento com tolerância de
0,5 m² para não acusar arredondamento, e o disparo em "≥ 2 valores distintos".

Ela ganha só uma **segunda fonte do mesmo fato**: para cada tabela da página,
uma linha que tenha **alguma** célula casando `/^\s*total\b/i` e **alguma** célula
numérica entra no `found` com a mesma forma dos achados de prosa.

*Alguma célula, e não a primeira:* quadro de áreas frequentemente deixa a
primeira coluna vazia na linha de fechamento e escreve `TOTAL` na segunda.
Exigir a primeira perderia justamente o caso comum.

### O guarda do qualificador

É a lição que a análise já tirou do Ledger, aplicada antes de o Ledger existir:
**estruturar sem qualificar é fábrica de falso positivo.** Uma tabela de *área de
pintura* também tem linha TOTAL em m², e compará-la com a área construída
produziria exatamente o "Escola Geral" de novo — um número certo lido como se
fosse outra coisa.

**Decisão:** só entram tabelas que se identifiquem como quadro de áreas da
edificação — alguma célula das **duas primeiras linhas** mencionando `área`,
`ambiente`, `compartimento` ou `dependência`. Duas linhas porque quadro de áreas
costuma abrir com um título que ocupa a linha inteira antes do cabeçalho de
colunas. Tabela que não se identifica é ignorada, em silêncio e de propósito.

Conservador nos dois sentidos: perder um quadro real custa um achado; comparar
grandezas diferentes custa a confiança no parecer inteiro.

## 4. Testes

Padrão do repositório: `scripts/test-*.ts` em node cru, `node:assert/strict`,
import relativo com extensão `.ts`, **verificado por exit code**.

`scripts/test-tabela-do-pdf.ts` — fixtures de `ItemDeTexto` com coordenadas
escritas à mão:

| Caso | O que trava |
|---|---|
| grade limpa, 3 colunas × 4 linhas | o caminho feliz |
| célula vazia no meio | fronteira some numa linha e a tabela não pode desmanchar |
| prosa corrida | **não** pode virar tabela — é o falso positivo estrutural |
| duas tabelas na mesma página | separadas por prosa, têm de sair como duas |
| linha só, isolada | abaixo de `MIN_LINHAS_DA_TABELA`, não é tabela |
| números com milhar e vírgula decimal | `4.530,98` não pode ser partido em duas células |

No harness `scripts/audit-precision-recall.ts`:

- **positivo:** o caso do benchmark — `4.448,91` em prosa contra `4.530,98` na
  célula TOTAL de um quadro de áreas;
- **limpo:** quadro de *área de pintura* com TOTAL divergente da área construída
  → não pode disparar (é o guarda do qualificador);
- **limpo:** quadro de áreas cujo TOTAL **bate** com a prosa → não dispara.

## 5. Riscos

1. **As fixtures são sintéticas, e este é o risco principal.** `docs/samples/`
   está vazia nesta máquina; os PDFs do 084_25 vivem noutra. A grade
   reconstruída será provada contra coordenadas que eu escrevi, e coordenadas
   que eu escrevo são mais bem-comportadas que as de um PDF real. **A regra pode
   passar no teste e errar no documento.** A cura é a Fase 0, e isto vai
   declarado no commit — não implícito.
2. **Calibragem sem documento real.** `VAO_DE_COLUNA` e
   `TOLERANCIA_DE_FRONTEIRA` nascem com valores plausíveis, não medidos. Devem
   ficar nomeados e num lugar só, para ajustar depois sem caçar número no meio
   da lógica.
3. **Custo por página.** A varredura é O(itens) por página, mas roda em todo
   documento de 218 páginas. Medir antes de assumir que é grátis.
4. **Tabela partida entre páginas** não é tratada. Um quadro de áreas que
   atravessa a quebra vira duas tabelas, e a linha TOTAL fica na segunda — o que
   ainda funciona para esta regra. Fica registrado como limite conhecido.

## 6. Fora do escopo

- **Ledger de grandezas e reconciliação.** A análise condiciona o Ledger ao campo
  `qualificador`; sem ele, "área do bloco B" e "área total" viram o mesmo fato.
  Item próprio.
- **Cabeçalho identificado e coluna nomeada.** Exigiria heurística de cabeçalho.
- **Células mescladas, tabelas aninhadas, rotacionadas.**
- **AUD-016** (a unidade `(M)` para 15,0). Depende de tabela, mas é outra regra.
