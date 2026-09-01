# Home v3

**Data:** 2026-09-01
**Estado:** desenho aprovado, não implementado
**Sub-projeto 5 de 6** da revisão integrada pedida em 01/09/2026.
**Depende de:** sub-projetos 1 (identidade do projeto) e 4 (marca de prefeitura),
ambos na main.

---

## O que a tela mostra hoje

Medido no navegador em 01/09/2026, janela de 1440×1000, com o Victor logado. A
página tem exatamente **1000px** — uma dobra, sem rolagem.

**1. A primeira dobra é quase toda instrução.** Orbe + "CLIQUE NO ORBE PARA FALAR
COM O NEXO" + três linhas de parágrafo ocupam cerca de **290px** antes de
qualquer trabalho aparecer. Para quem entra todo dia, é ensino repetido.

**2. O cartão de retomada diz "Sem projeto".** `RETOMAR · Sem projeto · Nova
conversa · 24 conversas`. Honesto, e inútil — é o rastro das conversas vazias.

**3. A coluna direita reserva 336px e está vazia.** O grid é
`lg:grid-cols-[minmax(0,1fr)_336px]`, e ela mostra "As outras pastas em que você
mexer aparecem aqui".

**4. Cinco linhas de achado visualmente idênticas** — todas `→ Milton`, todas
`ontem`. Repetição sem diferenciação.

**5. Não há marca de prefeitura nenhuma**, e o problema não é a tela.

## O dado que falta

`lib/painel.ts` **já busca** `client` do banco (linhas 147 e 250) e o **descarta**,
colapsando três campos em um:

```ts
nome: projeto.name || projeto.client || projeto.code,
```

`ProjetoDoPainel` não tem cliente. A Home literalmente não sabe a cidade — então
a cor por prefeitura não tem de onde sair.

## Uma dívida do sub-projeto 1 que sobrou aqui

`lib/trabalho-recente.ts:64` ainda deriva o cliente quebrando a string da pasta:

```ts
export function partesDaPasta(chave: string) { … }   // "084-25-CRICIUMA"
```

É o caminho que o sub-projeto 1 substituiu por `projectId`. Deixar os dois
convivendo daria à Home **duas fontes para a mesma cidade**, e elas discordariam
no primeiro projeto renomeado em `/projetos`.

---

## O desenho

### Seção 1 — Uma lista só, ordenada por atenção

O código da Home declara uma tensão:

> *"A COLUNA DA ESQUERDA CONTINUA SENDO O PROJETO, e não a fila… lá a pergunta é
> 'o que exige ação SUA', aqui é 'onde você está trabalhando'."*

**A escolha entre as duas importa menos do que parece.** Num escritório com um
punhado de projetos ativos, "onde eu estava" e "o que precisa de mim" produzem
quase a mesma lista. O que está quebrado é hierarquia e densidade, não seleção.

Então: **a seleção de hoje fica** (projetos, inclusive sem pendência) e a
**ordenação passa a ser por atenção** — mais parado primeiro. Não é meio-termo:
é uma lista, uma ordem. E é a ordem que a tela **já promete** no canto direito
("mais parados primeiro"), sendo hoje a única promessa que ela cumpre.

### Seção 2 — O cartão para de listar achado por achado

Hoje o cartão do projeto lista cada achado aberto. Com cinco, são cinco linhas
quase idênticas.

Passa a mostrar o **estado do projeto**:

```
▸ ▪▪▪  063-26 · CRICIÚMA   Memorial descritivo — Cancha de Bocha
       5 achados · com Milton · parados há 4 dias      [NOVA AUDITORIA]
```

Achado é coisa de **agir**, e agir acontece no parecer — que desde o sub-projeto
3 abre no achado certo, com o documento do lado. Listar cinco linhas iguais na
Home é a fila vazando para dentro do cartão de projeto.

**O cartão continua abrindo.** O acordeão que já existe (`abertos`) passa a
revelar os achados — quem quer a lista tem a lista, a um clique, e a densidade
padrão volta a ser legível.

**Quando há mais de uma pessoa**, a linha diz "com 3 pessoas" em vez de nomear
todas: três nomes numa linha de resumo é a repetição de novo, com outro rosto.

### Seção 3 — A prefeitura entra, e o dado vem junto

`ProjetoDoPainel` ganha `cliente: string`. `lib/painel.ts` para de colapsar
`client` dentro de `nome` e o carrega separado — o `select` já o traz, então não
há consulta nova.

A marca entra na forma **selo**, que é a que o próprio módulo destina a esta
superfície:

> *"SELO (13×5) em linha com o texto, para SUPERFÍCIES LARGAS — faixa do topo,
> cartão de projeto, cabeçalhos."*

**Nenhuma forma nova, nenhuma cor nova.** `MarcaDaPrefeitura` aceita a pasta, o
campo cliente do carimbo ou o município cru — o cliente do `Project` serve como
está.

**A Home qualifica pela regra do módulo** (*"a marca aparece onde a cidade é uma
PERGUNTA EM ABERTO"*): é uma lista de projetos de cidades diferentes, e é
exatamente onde a cor separa.

### Seção 4 — A dobra devolve espaço ao trabalho

**O orbe fica onde está.** É a identidade do produto, o código explica a escada
que o trouxe até aqui, e ele não é o problema.

O que encolhe é o **parágrafo de três linhas** do `ConviteDoOrbe`. Ele ensina o
que pedir ao Nexo — e quem abre a Home pela décima vez já sabe. Vira uma linha.

`PrimeirosPassos` **continua inteiro**: quem nunca usou recebe as seis fichas de
capacidade, e o ensino tem lugar. O lugar é lá, não na dobra de quem trabalha.

### Seção 5 — A coluna direita some quando está vazia

Hoje ela reserva 336px para dizer que um dia terá algo. Coluna vazia com legenda
é pior que coluna nenhuma: ocupa o espaço e não paga por ele.

Com conteúdo, ela fica como está. Sem, o grid vira uma coluna só e a lista de
projetos ocupa a largura inteira.

### Seção 6 — A dívida do `partesDaPasta`

`lib/trabalho-recente.ts` passa a ler o cliente do **projeto vinculado**
(`NexoConversation.projectId` → `Project.client`), e não da string da pasta.

`partesDaPasta` **não é apagada**: conversa legada sem `projectId` ainda tem
`folderKey`, e é dela que sai o nome. Ela vira o **degrau de trás**, com o
docblock dizendo isso — o mesmo arranjo que `cartoes-de-projeto.ts` já usa em
`enderecoDa`.

### Seção 7 — Como se prova

**Puro, em node cru:**

- `ordemDaAtencao()` — a ordenação dos projetos: mais parado primeiro, empate
  desfeito por data, projeto sem pendência depois dos com pendência;
- `resumoDoProjeto()` — a linha de estado: "5 achados · com Milton · parados há
  4 dias"; "com 3 pessoas" quando há mais de uma; e o que ela diz quando não há
  achado nenhum.

**Navegador, medindo o que a queixa dizia:**

- a **altura em px** do topo da página até o primeiro cartão de projeto — hoje
  ~290, e a prova registra o número novo. É a queixa "a dobra é ensino"
  transformada em medida;
- o cartão fechado tem **uma** linha de estado, e não cinco;
- abrir o cartão revela os achados;
- a marca aparece no cartão, e duas cidades diferentes têm cores diferentes;
- sem trabalho recente, **não existe** coluna de 336px reservada.

---

## O que este sub-projeto NÃO faz

- **Não mexe no orbe nem na barra do topo.** Não são o problema, e são a
  identidade.
- **Não cria cor nem forma nova.** A escala de prefeitura já existe e já passa
  pelo `npm run prova:tokens`.
- **Não inventa contagem de críticos por projeto.** `lib/fila-de-achados.ts`
  documenta ter recusado isso — *"caro, e por um número que não muda a decisão de
  quem abre"* —, e reintroduzi-lo pela Home seria desfazer a decisão sem o
  argumento.
- **Não limpa as 24 conversas vazias.** Elas aparecem na retomada ("Sem projeto ·
  24 conversas") e são problema conhecido, de outra frente.
- **Não redesenha `/projetos`.** A Home aponta para lá e o link fica.

## Riscos aceitos

- **Tirar os achados do cartão fechado é a mudança que mais se sente.** Quem
  hoje varre a Home lendo os cinco títulos passa a ver um número e precisa abrir.
  Aceito porque a lista continua a um clique e porque cinco linhas idênticas não
  são leitura — são ruído com formato de dado.
- **A ordenação por atenção muda o topo da lista.** Um projeto que estava em
  primeiro por ser recente pode descer. É o efeito pretendido, e a tela já
  anuncia a regra no canto.
