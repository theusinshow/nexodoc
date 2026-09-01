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

### Seção 2 — A abertura automática deixa de gastar a dobra

**Correção de 01/09/2026, feita antes de escrever o plano.** Esta seção dizia
que "o cartão passa a mostrar o estado em vez de listar achado por achado".
**Estava errada.** O acordeão já existe e o cartão fechado já mostra resumo, via
`Selo` (`painel-do-usuario.tsx:721`): `"5 achados"`, `"5 com outros"`,
`"sem pendência"`, ou `"3 achados · parado há 7 dias"`.

O que produziu a parede de cinco linhas na medição é outra coisa, e é uma linha:

```ts
// painel-do-usuario.tsx:124
if (primeiro) setAbertos({ [primeiro.projectId]: true });
```

**O primeiro cartão abre sozinho, sempre.** E no caso medido ele expandiu cinco
achados `enviado` — trabalho que está com OUTRAS pessoas, o tipo menos acionável
que existe. A dobra inteira foi gasta mostrando o que ninguém pode fazer agora.

**A regra passa a ser: abre sozinho só o que é PARA VOCÊ.** Um projeto cujos
achados estão todos com terceiros não precisa estar expandido — precisa de uma
linha dizendo com quem estão. Com a ordenação da Seção 1, o cartão que abre
sozinho passa a ser o mais parado que espera por você.

**E o resumo de "enviados" ganha COM QUEM.** Hoje o `Selo` diz `"5 com outros"`,
que informa a quantidade e esconde o essencial. Passa a dizer `"5 com Milton"`;
com mais de uma pessoa, `"5 com 3 pessoas"` — três nomes numa linha de resumo
seria a repetição de novo, com outro rosto.

A lista de achados **continua onde está**, dentro do acordeão. Quem quer varrer
os títulos abre o cartão.

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
- `resumoDoProjeto()` — o texto do `Selo`: "5 com Milton" com uma pessoa, "5 com
  3 pessoas" com várias, "3 achados · parado há 7 dias" quando é para você, e
  "sem pendência" quando não há nada;
- `abreSozinho()` — só o primeiro cartão, e só quando há achado PARA VOCÊ.

**Navegador, medindo o que a queixa dizia:**

- a **altura em px** do topo da página até o primeiro cartão de projeto — hoje
  ~290, e a prova registra o número novo. É a queixa "a dobra é ensino"
  transformada em medida;
- nenhum cartão nasce expandido quando o trabalho todo está com terceiros — e o
  do topo nasce expandido quando há achado para você;
- abrir o cartão revela os achados, como já revela hoje;
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

- **O cartão do topo pode passar a nascer fechado.** Quem hoje encontra os
  achados já expandidos ao abrir a Home vai precisar de um clique quando o
  projeto mais parado for de trabalho que está com terceiros. Aceito: expandir
  cinco linhas de "com o Milton" gasta a dobra mostrando o que ninguém pode
  fazer agora.
- **A ordenação por atenção muda o topo da lista.** Um projeto que estava em
  primeiro por ser recente pode descer. É o efeito pretendido, e a tela já
  anuncia a regra no canto.
