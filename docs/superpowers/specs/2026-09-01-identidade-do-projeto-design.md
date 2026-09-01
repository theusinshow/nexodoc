# Identidade do projeto unificada

**Data:** 2026-09-01
**Estado:** desenho aprovado, não implementado
**Sub-projeto 1 de 6** da revisão integrada pedida em 01/09/2026.

---

## O problema

Memorial auditado aparece no histórico dentro de **"Sem código no carimbo"** — e
memorial não tem carimbo. A prefeitura do projeto não é persistida, então não
serve ao histórico, à home nem a nada.

As duas queixas têm a mesma causa, e ela é arquitetural: **"projeto" é duas
coisas diferentes no NexoDoc, e elas não conversam.**

| | Onde vive | Chave | Quem lê |
|---|---|---|---|
| `Project` | Postgres | `id`, `(organizationId, code)` | home (`lib/painel.ts`), fila de achados, `/projetos` |
| `folderKey` | JSON da conversa | string `084-25-CRICIUMA` | barra lateral (`cartoes-de-projeto.ts`) |

A barra agrupa por uma string derivada no navegador; a home agrupa por chave
estrangeira no banco. Enquanto isso durar, agrupar por prefeitura, sincronizar
achados entre pessoas e redesenhar a home constroem sobre areia.

## As causas, confirmadas no código

### 1. O dossiê do memorial nunca chega ao store

`modules/nexo/state/conversation-store.tsx:514` deriva a pasta assim:

```ts
const folderKey = doVolume || pastaDoProjeto(s.identidade?.codigo, s.identidade?.orgao);
```

`corrigirIdentidade` (o único caminho para `setIdentidade`) é chamado apenas por
`NexoCanvas.tsx:343` e `PlanoDeGeracao.tsx:670` — os dois fluxos de **volume**. O
dossiê do memorial vive em `useState` local no `NexoWorkspace.tsx:288` e morre ali.

Logo: conversa só de memorial tem `identidade = {}` → `pastaDoProjeto(undefined,
undefined)` → `""` → cartão "Sem código no carimbo". O código de derivação estava
correto; o dado nunca chegava nele.

### 2. `pastaDoProjeto` exige código **e** prefeitura

`modules/nexo/lib/pasta-do-projeto.ts` recusa criar pasta sem prefeitura. A
justificativa escrita: *"uma pasta `084-25` que amanhã vira `084-25-CRICIUMA` muda
de identidade debaixo de quem está usando"*.

O argumento é correto **enquanto a identidade for a string**. Com a identidade
virando `projectId`, ele deixa de valer.

### 3. Projeto que já existe nunca ganha prefeitura

`app/api/projects/por-centro-de-custo/route.ts` faz `upsert` com `update: {}`.
Projeto criado com `client: ""` fica sem cliente para sempre, por mais memoriais
daquele centro de custo que passem por ele.

### 4. `Project.client` é texto livre, e o que está gravado não casa com nada

Medição no `nexodoc_dev` (01/09/2026):

```
999-99 | "OUTRA"    | audits: 0
040-26 | "IÇARA"    | audits: 0
099-25 | "CRICIÚMA" | audits: 0
063-26 | "CRICIÚMA" | audits: 3
```

`client` guarda o **município em caixa alta**. `matchPrefeitura`
(`server/nexo/agent/normalize.ts:137`) exige que o texto *nomeie um órgão*
(`nomeiaOrgao`): `"CRICIÚMA"` sozinho retorna `null`. Cor e agrupamento por
prefeitura derivados do que está gravado hoje não teriam de onde sair.

## A medição que dimensiona o problema

`nexodoc_dev`, 01/09/2026:

```
conversas no total ............ 72
com folderKey ................. 0
com auditorias registradas .... 0
com identidade gravada ........ 0
com selos lidos ............... 3
```

**Nenhuma conversa tem pasta** — nem de auditoria, nem de volume. "Sem código no
carimbo" não é um balde onde caem alguns casos: na prática é o único balde.

**Ressalva:** é o banco de dev, com massa de teste. Produção não foi medida.

---

## O desenho

### Seção 1 — a fonte única de identidade

**A conversa passa a guardar `projectId`** — a chave estrangeira, não uma string
derivada. `folderKey` continua existindo por um ciclo, mas vira **cache de
exibição**.

`NexoConversation` ganha:

```prisma
projectId String?   // nulo = "a endereçar"; é estado legítimo
@@index([projectId, updatedAt])
```

Consequências:

- a barra lateral agrupa por `projectId` e lê `code`/`client` do banco;
- renomear o cliente em `/projetos` reflete na barra sem migração;
- volume e auditoria do mesmo centro de custo caem juntos **por construção**;
- home e barra passam a falar do mesmo objeto.

### Seção 2 — a prefeitura canônica

`Project` ganha:

```prisma
clientKey String @default("")   // slug estável: "criciuma", "icara", "chapeco"
@@index([organizationId, clientKey])
```

`client` continua sendo o texto que humano lê e edita. `clientKey` é o que a cor, o
agrupamento e o casamento com template usam.

Por que um segundo campo, e não normalizar `client` na leitura: a chave não pode
mudar quando alguém corrige a grafia. `"CRICIÚMA"`, `"Criciúma"` e `"Prefeitura
Municipal de Criciúma"` são o mesmo cliente, e hoje seriam três grupos e três cores.

**Não** se usa o `id` do template de capa (`pmcriciuma`) como chave: `IÇARA` não tem
template, e amarrar a identidade do cliente à existência de um modelo de capa
deixaria projetos reais sem chave. O sentido é o inverso — o template aponta para o
município.

**A cor NÃO entra aqui.** `clientKey` é a chave que uma escala de cor por
prefeitura vai usar — mas a escala em si é decisão de design system, e
`DESIGN.md:283` cobra um portão para admiti-la: *"ela tem nome, tem trabalho
declarado, tem token em `globals.css`, tem consumidor nomeado nesta tabela, e
passa no teste de não ser confundível com um sinal de status a três metros da
tela. `npm run prova:tokens` recusa o commit que esquecer a tabela."*

Além disso, as oito cores categóricas que já existem são de **disciplina**
(`--discipline-arq`, `--discipline-est`, …). Reusá-las faria o mesmo azul
significar duas coisas na mesma tela. E vale aqui a regra que já governa a
disciplina: *"a sigla mono de três letras é o portador primário; a cor é
secundária — nenhuma decisão do produto pode depender só do matiz"*.

Escolher a escala, declarar os tokens e aplicá-los é o **sub-projeto 4**. Este
entrega a chave estável de que ele depende.

### Seção 3 — o fluxo do anexo

```
memorial anexado
  └─ classificação (rota existente) → dossie { obra, orgao, municipio, codigo }
       └─ conv.corrigirIdentidade({ codigo, obra, orgao, municipio })   ← elo que falta
            └─ vinculoDoProjeto(codigo, { prefeitura, obra })
                 ├─ achado/criado → conv.vincularProjeto(projectId)
                 └─ sem código    → "A endereçar", com ação inline
                      └─ persist → NexoConversation.projectId
```

**A resolução sai do `ConfirmationCard`.** Hoje mora no `confirm()`
(`ConfirmationCard.tsx:2316`), num arquivo de 2.700 linhas que já faz o cartão de
confirmação, o plano de volume e o disparo. O endereçamento vira módulo próprio
(`modules/nexo/lib/vinculo-do-projeto.ts`), chamado do anexo; `confirm()` passa a
**ler** o vínculo em vez de resolvê-lo. É o que permite testá-lo sem navegador.

**Idempotência.** O anexo pode ser refeito (F5, reclassificação, segundo memorial).
O vínculo é `upsert` por `(organizationId, code)`, que a rota já faz. A conversa só
troca de projeto se o código lido for **diferente** do vinculado — e nesse caso o
Nexo **avisa**, não troca em silêncio: dois memoriais de projetos diferentes na
mesma conversa é erro de quem anexou, não decisão a executar.

**Não bloqueia o anexo.** Memorial sem código legível não abre pergunta modal; a
conversa nasce "A endereçar" com ação inline no cartão. O disparo da auditoria
continua cobrando a decisão, como já cobra hoje (`fraseDoImpasse`).

**"A endereçar" substitui "Sem código no carimbo"** como rótulo. Memorial não tem
carimbo — o rótulo atual é mentira de vocabulário, e o balde some por construção
assim que o dossiê chegar ao store.

### Seção 4 — como a prefeitura entra e se corrige

Precedência: **engenheiro > agente > carimbo > vazio.**

| Situação | `Project.client` |
|---|---|
| Projeto nasce agora | grava `client` = órgão lido, `clientKey` = slug do município |
| Projeto existe, `client` **vazio** | **preenche** |
| Projeto existe, `client` preenchido | **não sobrescreve**; registra divergência |
| Engenheiro corrige em `/projetos` | vence tudo; `clientKey` recalculado |

A linha 2 é a inversão da regra escrita hoje em `por-centro-de-custo/route.ts`. O
comentário atual — *"o cadastro de quem o criou vale mais do que a leitura de um PDF
qualquer"* — continua certo. Mas **vazio não é cadastro**. Preencher um campo em
branco não desrespeita decisão nenhuma, e é o único jeito de o dado existir: ninguém
digita prefeitura em lugar nenhum hoje.

A divergência da linha 3 **não** vira pergunta no fluxo. Vira `ProjectEvent`, visível
na tela do projeto. Interromper a auditoria porque o PDF escreveu "Pref. Mun. de
Criciúma" e o cadastro diz "Prefeitura Municipal de Criciúma" seria atrito por ruído
de grafia.

### Seção 5 — migração

Não há backfill elaborado, e a medição é o motivo: zero conversas têm `auditorias`
ou `identidade` no JSON. Não há de onde inferir projeto retroativamente.

- `Project.clientKey` — migração determinística: slug do `client` existente.
- `NexoConversation.projectId` — nasce nulo. Script *best-effort* liga a conversa ao
  projeto **quando** o JSON tiver auditoria registrada (`data->'auditorias'` →
  `Audit.projectId`). Em dev resolve zero. Não adivinha além disso.
- O resto fica "A endereçar", com ação inline.

**Nada de casamento por semelhança.** É exatamente o erro que
`lib/resolucao-de-projeto.ts` existe para evitar: *"`099-26` não vira `099-25` por ser
parecido"*.

**Fora de escopo, mas ficará visível:** 69 das 72 conversas são cascas vazias ("Nova
conversa" sem conteúdo). É o problema de conversas duplicadas já tratado antes.
Depois desta mudança elas param de se esconder no monte.

### Seção 6 — como se prova

Nenhum nível gasta token de IA.

**Puro, em node cru** (como `resolucao-de-projeto.ts` e `pasta-do-projeto.ts` já são
testados):

- `slugDoCliente()` — `"CRICIÚMA"`, `"Criciúma"`, `"Prefeitura Municipal de
  Criciúma"` → `criciuma`; `"IÇARA"` → `icara`; vazio → `""`.
- `vinculoDoProjeto()` — as quatro linhas da tabela da seção 4.

**Banco, sem navegador** — cria projeto com `client` vazio, roda o vínculo duas vezes
e prova que (a) preencheu na primeira, (b) a segunda não duplicou projeto nem
sobrescreveu, (c) código diferente não troca o vínculo em silêncio.

**Navegador, sem IA** — semeia o IndexedDB com uma conversa de memorial e prova que o
cartão mostra `063-26 · CRICIÚMA`, não "Sem código no carimbo". Medindo a **caixa
contra a janela**, não só presença no DOM: asserção de DOM passa verde com o painel
fora da tela.

---

## O que este sub-projeto NÃO faz

Cada um tem spec próprio:

| # | Sub-projeto | Depende de |
|---|---|---|
| 2 | Multiplayer dos achados — responsáveis N:N, status, histórico, permissões | 1 |
| 3 | Achado navegável — "Ver achado" no PDF, deep-link, e-mail apontando pra lá | 2 |
| 4 | Prefeitura como eixo visual — escala de cor, portador curto, agrupamento do histórico | 1 |
| 5 | Home v3 | 1, 4 |
| 6 | Varredura de UI — contraste, estados, tokens | — |

Aqui entra a **chave** (`clientKey`). Escolher a escala de cor, declarar os tokens
em `globals.css` e aplicá-los na barra, no histórico e na home é o sub-projeto 4.

## Riscos aceitos

- **Projeto vazio em `/projetos`.** Criar o vínculo no anexo faz todo memorial
  arrastado criar pasta, inclusive o anexado por engano. Aceito: é reversível
  (projeto vazio é apagável, e dá para escondê-lo enquanto não tiver auditoria nem
  documento). A alternativa — vínculo só local — mantém a duplicidade que este
  trabalho existe para eliminar, e essa **não** é reversível.
- **Código torto vira projeto paralelo.** Risco já aceito e documentado em
  `por-centro-de-custo/route.ts`; este trabalho não o aumenta, só o antecipa do
  disparo para o anexo.
