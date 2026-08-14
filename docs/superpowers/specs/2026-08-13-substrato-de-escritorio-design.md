# Substrato de escritório — o chão que a revisão colaborativa precisa

**Data:** 2026-08-13
**Origem:** `docs/arquitetura-revisao-colaborativa.md` (escrito pelo Grok 4.5, 26 seções).
**Status:** SPEC. É daqui que o plano de implementação argumenta.
**Decisão do mantenedor:** fazer a preparação completa **mais uma prova de vida** — o
Victor entrar e enxergar o projeto da PROSUL na lista dele.

Este documento **não** implementa a revisão colaborativa. Ele constrói o terreno onde
o `FindingOccurrence` do documento do Grok vai ser plantado, e para no ponto exato em
que a Fase 0 daquele documento começa.

---

## Por que este documento existe

O documento do Grok é bom, e a maior parte dele foi lida contra o código de verdade:
o `chaveEntreVersoes` que ele propõe como fingerprint **já existe** em
`lib/diff-de-pareceres.ts:61`, com o raciocínio escrito; a separação entre julgamento
da IA e progresso do trabalho que ele manda preservar **já está** no schema, com o
motivo documentado em `prisma/schema.prisma:308`.

O erro dele é de premissa, não de desenho: o §1.1 lista "Projetos, organizações,
membros" como *o que já existe*. Existe a tabela. Não existe o escritório.

Enquanto isso for verdade, nada do fluxo Milton→Victor roda — nem em demonstração.

---

## As leis, que valem para todo lote

- Núcleo puro (só `import type`) mora em `lib/` e ganha teste `scripts/test-*.ts` que
  roda em node cru. Prova de navegador é `scripts/prova-*.mjs` (Playwright), e sai com
  código 1 quando falha.
- Migration em produção é ensaiada em cópia antes. `npm run db:backup` já existe.
- Nenhum passo de migração é irreversível sozinho.
- A rota `app/api/audit/route.ts` **não cresce**. Ela tem 3.849 linhas e é o pior lugar
  do repositório para acrescentar domínio novo.
- Regra de acesso não é chamada porque alguém lembrou. É chamada porque não há caminho
  que não passe por ela.

---

## Parte A — Premissas do documento do Grok que o código contradiz

Cinco. Cada uma derruba dependências espalhadas por aquele documento, e por isso vêm
antes do desenho.

### A.1 `OrganizationMember` é schema morto

Fora de `prisma/schema.prisma` e da migration que a criou, **nenhuma linha do
aplicativo lê ou escreve essa tabela**. Não há rota, tela ou fluxo que crie uma
organização ou um membro.

O §6 do Grok desenha uma matriz de permissões inteira sobre membros que não existem, e
o §22 estima 3–5 semanas para o P0 assumindo esse substrato pronto.

### A.2 A lista de projetos é escopada por dono

`app/api/projects/route.ts:67` filtra por `ownerEmail` e só.

O detalhe (`app/api/projects/[id]/route.ts:66`, via `lib/project-store.ts:47`) *já*
honra membership da organização — então hoje o Victor abriria o 063-26 por link
direto, mas o projeto **não aparece na lista dele**. O "Meu Trabalho" do §7.2 mostraria
achados de projetos que o usuário não consegue navegar.

### A.3 A auditoria do Nexo não tem dono nem projeto

`app/api/audit/route.ts:3205` é explícito no comentário: a autenticação só é exigida
dentro do bloco `if (projectId)` (linha 3311). Como o Nexo — a interface principal —
não manda `projectId`, **a auditoria mais usada do produto roda sem sessão exigida na
rota, sem projeto e sem organização.**

Todo achado que ela gera nasce órfão. É o chão onde o §4.2 do Grok quer plantar
`FindingOccurrence.projectId` e `organizationId`.

### A.4 `GET /api/audits/[id]` não checa nada

Nem sessão, nem dono, nem organização. Quem tiver o id lê o parecer inteiro.

O §6.3 do Grok encerra com "AuthZ sempre no server. Client não confia em status", como
se fosse um padrão existente a seguir. É um padrão a **criar** — e as rotas novas de
`assign`/`resolve`/`validate` vão nascer ao lado de rotas velhas abertas.

### A.5 As 94 provas testam um ator só

`lib/dev-auth.ts:11` resolve o usuário de teste a partir de `NEXODOC_DEV_AUTH_EMAIL` —
uma variável de ambiente, um usuário fixo. Encenar duas pessoas exigiria reiniciar o
servidor no meio do teste.

Não é desleixo da suíte: **não havia como testar dois.** E o fluxo Milton→Victor é, por
definição, dois atores.

---

## Parte B — Decisões fechadas

Tomadas pelo mantenedor nesta sessão. Não são reabertas pelo plano.

| # | Decisão | Consequência |
|---|---|---|
| B.1 | O projeto é do **escritório**, não de quem criou | `Project.organizationId` vira `NOT NULL`; `@@unique([organizationId, code])` |
| B.2 | Organização nasce por **ato de admin** | Sem autoatendimento. Na prática: uma linha semeada |
| B.3 | Existe **uma** organização: a PROSUL | Sem seletor de escritório, sem "org ativa" na sessão |
| B.4 | Toda auditoria pertence a um **projeto existente** | Sem rascunho, sem adoção, sem dois estados na tela do achado |
| B.5 | O projeto é identificado por **centro de custo + prefeitura** | `099-25` + `CRICIÚMA`. `code` é o CC e deixa de aceitar vazio |
| B.6 | Há **histórico real em produção** que não pode sumir | Migração em 3 passos, com diagnóstico antes do backfill |

Sobre B.3: a tabela `Organization` **permanece**, com uma linha. Ela já existe, o
`organizationId` já está em `Project`, e o custo de manter é uma coluna preenchida. O
que ela compra é que o segundo escritório comprador seja cadastro, e não reescrita.

---

## Parte C — O desenho

### C.1 Quem é dono do quê

Nenhum papel novo. Os dois eixos já existem no schema e nunca foram usados juntos:

| Eixo | Enum | Quem | Para quê |
|---|---|---|---|
| Plataforma | `UserRole { ADMIN, USER }` (`schema.prisma:9`) | o mantenedor | cadastrar o escritório, ver tudo em `/admin` |
| Escritório | `OrganizationRole { OWNER, ADMIN, MEMBER }` (`schema.prisma:40`) | PROSUL | `ADMIN` cadastra projeto e coordena emissão; `MEMBER` é projetista |

Milton e Victor são `MEMBER`. Quem cadastra o 063-26 é `ADMIN` da organização — ou o
mantenedor, pela plataforma.

O terceiro eixo (quem é assignee, quem valida um achado) é **por achado**, não é papel,
e não entra aqui. É o §6.2 do Grok, e ele acertou nisso.

**`Project` troca de eixo de posse:**

```prisma
model Project {
  organizationId String   // era String?  →  NOT NULL
  createdById    String?  // era ownerId — a semântica muda: criou ≠ é dono
  code           String   // centro de custo: "099-25". Deixa de aceitar vazio
  client         String   // prefeitura: "CRICIÚMA"
  @@unique([organizationId, code])   // era @@unique([ownerEmail, code])
}
```

`code` já é normalizado em maiúscula (`lib/project-store.ts:25`) e já aparece em fonte
mono na UI: o slot do centro de custo existe, só nunca foi tratado como identidade.

"Deixa de aceitar vazio" quer dizer duas coisas, e as duas são necessárias: o
`@default("")` sai do schema, e o cadastro de projeto recusa `code` em branco antes de
gravar. Só a validação deixaria a porta aberta para escrita direta; só o schema daria
erro de banco em vez de mensagem legível.

`ownerEmail` e `ownerName` deixam de ser posse e passam a registrar quem criou. Nenhuma
query filtra por eles, e o `@@index([ownerEmail, updatedAt])` sai. As colunas
permanecem — apagá-las não serve ao objetivo e complica a migração.

**`OrganizationMember` ganha uso real.** É a única tabela do schema que hoje é letra
morta. Convite por e-mail nasce `INVITED` (`OrganizationMemberStatus`, `schema.prisma:46`);
no primeiro login o `userId` é preenchido e o status vira `ACTIVE`.

Isso resolve, de graça, um problema que o documento do Grok não viu: o §4.2 dele modela
`assigneeId` apontando para `User`, e um projetista convidado **não tem `User` até
entrar pela primeira vez**. Atribuir um achado ao Victor antes disso seria impossível.
Atribuição mira o *membro*; o `User` é resolvido quando ele chega.

### C.2 O acesso deixa de ser opcional

O problema não é falta de checagem — é que a checagem é voluntária. `assertProjectAccess`
existe, é boa, e quem esquece de chamar vaza. Há três esquecimentos ativos:

| Rota | O que falta |
|---|---|
| `GET /api/audits/[id]` | tudo. Nem sessão |
| `POST /api/audit` | sessão só dentro do `if (projectId)`, e o Nexo não manda `projectId` |
| `GET /api/projects` | monta o próprio `where` com `ownerEmail`, contornando o helper |

Corrigir os três é o mínimo. O que resolve é fazer o quarto esquecimento impossível.

**Um portão único, não um helper opcional.** Toda rota sob `app/api/` começa resolvendo
ator + escritório num ponto só, estendendo `lib/access-control.ts` — que já existe, já
resolve `isAdmin` (`lib/access-control.ts:16`) e já guarda o `/admin`
(`app/admin/layout.tsx:21`). A rota não recebe `session`: recebe um ator já validado,
ou não roda.

Para não haver dúvida na implementação: o portão é uma **função chamada no início do
handler**, que devolve o ator resolvido ou lança — não é `middleware.ts` do Next. O
middleware roda em runtime de borda, não alcança o Prisma de forma confiável, e já é
usado para outra coisa (o `authorized` de `auth.ts`, que só distingue logado de
deslogado). Autorização precisa do banco; autenticação não.

**Uma prova que reprova rota aberta.** `scripts/prova-nenhuma-rota-aberta.mjs` varre
todos os `route.ts` sob `app/api/` e falha se algum não passar pelo portão. Rota
deliberadamente pública (`/api/auth/...`, `/api/saude`) fica numa lista explícita, com
o motivo escrito ao lado.

No dia em que alguém criar `/api/findings/[id]/assign` e esquecer o guard, a prova
quebra antes do deploy — e não depois da venda.

**O isolamento entre escritórios precisa ser provável mesmo com um escritório só.**
Com a PROSUL sozinha, um vazamento entre organizações não tem como aparecer. Por isso
as provas semeiam um segundo escritório fantasma com um projeto próprio, e exigem `404`
quando um membro da PROSUL tenta abri-lo. Custa pouco agora; é a diferença entre vender
para o segundo escritório e ter que auditar tudo de novo antes.

### C.3 Toda auditoria com endereço

Quase tudo já está desenhado, só nunca foi ligado:

- `modules/nexo/types.ts:36` — o dossiê do Nexo **já tem** `projectId`
- `modules/nexo/types.ts:28` — `NexoFact.origem` já distingue `"extraido" | "projeto" | "usuario" | "sugerido"`, e `confirmado` já existe
- `lib/cross-document-audit.ts:87` — já extrai `municipio` do padrão "prefeitura municipal de X"
- `lib/cross-document-audit.ts:134` — já extrai `codigo` ("código do projeto")
- `app/api/audit/route.ts:3225` — a rota já aceita `gabaritoCentroCusto`

O que falta: `modules/nexo/lib/audit.ts:80` monta o formulário com `gabaritoObra`,
`gabaritoPrefeitura` e `gabaritoMunicipio`, e **não manda nem `projectId` nem
`gabaritoCentroCusto`**.

**A resolução do projeto, em três desfechos.** Na hora de auditar, procura-se
`Project(organizationId: PROSUL, code: <codigo do dossiê>)`:

| Desfecho | O que acontece |
|---|---|
| Achou | anexa e segue. Zero perguntas. A barra mostra `099-25 · CRICIÚMA`, `origem: "projeto"` |
| Não achou | para: *"centro de custo 099-25 não está cadastrado na PROSUL"*. Se quem está ali é `ADMIN` da org, cadastra no mesmo lugar. Se é `MEMBER`, a mensagem diz a quem pedir |
| Sem código legível | escolher na lista da PROSUL. Sem palpite |

**A rota passa a exigir.** `POST /api/audit` exige sessão **e** `projectId`, sempre. O
bloco `if (projectId)` de `app/api/audit/route.ts:3311` deixa de existir, e com ele o
caminho anônimo. É a quebra mais visível de toda a preparação, e é ela que garante que
nenhum `FindingOccurrence` futuro nasça órfão.

**Match errado é pior que match nenhum.** Código lido de PDF erra, e anexar a auditoria
ao centro de custo errado contamina a fila de outro projeto sem ninguém perceber. Quando
o vínculo vier de `origem: "extraido"`, ele aparece na barra de forma reversível —
`099-25 · CRICIÚMA`, com "não é esse?" ao lado — em vez de um modal de confirmação.
Certo: fricção zero. Errado: correção de um clique, antes de a auditoria rodar.

**Uma extração cirúrgica, e só uma.** O bloco de `app/api/audit/route.ts` que grava a
`Audit` no complete é exatamente onde a materialização de achados vai se pendurar. Esse
bloco sai para `lib/audit-store.ts`, irmão do `lib/project-store.ts` que já existe e já
funciona. O resto do arquivo não é tocado — seria refactor sem relação com o objetivo.

Quando o `FindingOccurrence` chegar, ele nasce em `lib/finding-store.ts`. Não lá dentro.

---

## Parte D — A migração

### D.1 Dois problemas reais, que só aparecem quando o eixo troca

`prisma/schema.prisma` declara `code String @default("")` com `@@unique([ownerEmail, code])`.
Hoje isso permite **um projeto sem código por dono**. Com `@@unique([organizationId, code])`,
passa a caber **um projeto sem código na PROSUL inteira**, e todos os outros quebram a
migration. O mesmo vale para dois donos que tenham cadastrado "099-25" cada um.

Isto não é hipótese: é a consequência aritmética de juntar vários donos numa
organização. Quantos são, não dá para saber sem o banco.

### D.2 Três deploys, cada um reversível sozinho

**Passo 1 — aditivo.** Cria a PROSUL. `organizationId` continua nullable. Nada muda de
comportamento. Rollback: apagar uma linha.

**Passo 2 — diagnóstico, depois backfill.** Primeiro conta e **imprime a lista**:
projetos sem código, códigos repetidos entre donos. Se der zero, o resto é mecânico. Se
não der, o mantenedor decide caso a caso com os nomes na tela — e não descobre pelo erro
do Postgres às três da manhã.

Depois: aponta os projetos para a PROSUL, cria os `OrganizationMember` a partir dos
donos distintos, com contagem antes e depois. Ensaiado em cópia do banco de produção
antes de tocar produção.

Legado sem código recebe marcador visível (`SEM-CC-001`, `SEM-CC-002`) em vez de
palpite: fica claro na lista da PROSUL o que precisa de gente, e nada é adivinhado.

**Passo 3 — aperto.** `organizationId NOT NULL`, `@@unique([organizationId, code])`,
o unique velho cai. Só roda depois de o passo 2 ter fechado as contas.

### D.3 As auditorias órfãs do histórico

A regra "toda auditoria tem projeto" é do **portão de entrada, não da coluna**:
`Audit.projectId` continua nullable por causa do passado.

As auditorias antigas do Nexo continuam legíveis exatamente como hoje, e ficam fora da
fila de revisão — não recebem atribuição nem entram no gate de emissão. Adivinhar o
centro de custo delas pelo texto do parecer seria o mesmo erro do match automático, só
que em lote e sem ninguém olhando.

Recuperá-las, se um dia for preciso, é ferramenta de admin com um humano confirmando
uma a uma. Não entra aqui.

---

## Parte E — As provas

### E.1 A mudança de três linhas que destrava tudo

`lib/dev-auth.ts` passa a aceitar o e-mail como credencial, e não só via
`NEXODOC_DEV_AUTH_EMAIL`. Só quando `isDevAuthEnabled()`, que exige `NODE_ENV`
diferente de `production` **e** `NEXODOC_DEV_AUTH === "true"`: em produção o primeiro
já basta para desligar, independentemente de como a variável esteja.

Com isso uma prova abre dois contextos de navegador e entra como duas pessoas.

Sem isso, toda a colaboração do documento do Grok seria construída sem uma única prova
capaz de falhar quando o isolamento entre pessoas quebrar.

### E.2 O que passa a ser provável

| Prova | O que exige |
|---|---|
| `prova-nenhuma-rota-aberta.mjs` | toda rota sob `app/api/` passa pelo portão, ou está na lista de exceções justificadas |
| `prova-escritorio.mjs` | Victor (`MEMBER`) entra e **vê o 063-26 na lista** — a prova de vida |
| `prova-escritorio.mjs` | membro da PROSUL leva `404` no projeto do escritório fantasma |
| `prova-alcada.mjs` | `MEMBER` não cadastra projeto; `ADMIN` da org cadastra |
| `prova-auditoria-com-endereco.mjs` | auditoria sem `projectId` é recusada; com CC casado, anexa sozinha; com CC desconhecido, para e explica |
| `test-resolucao-de-projeto.ts` | o casamento CC→projeto, em node cru, sem navegador |
| ensaio de migração | contagem antes/depois em cópia do banco, com o diagnóstico de D.1 impresso |

---

## Parte F — O que este documento NÃO faz

Fica tudo para depois, e nesta ordem, conforme o documento do Grok:

- `FindingOccurrence` e a materialização dos achados (Fase 0 dele)
- `reviewStatus`, `assignee`, `resolve`, `validate` (Fases 1–2)
- Meu Trabalho, deep-link, comentários, notificações
- `WorkSession` e o anti-duplicata
- Gate de emissão
- Linhagem entre versões

---

## Parte G — Correções a levar para o documento do Grok

Achados desta análise que aquele documento precisa absorver quando a Fase 0 começar.
Registrados aqui para não se perderem.

1. **`impacto` é opcional** em `lib/audit-report.ts`, e o Prisma do §15 declara
   `impact FindingImpact` `NOT NULL` — com a política de validação (§5.5) e o gate de
   emissão (§5.7) pendurados nele. A materialização precisa aplicar o
   `classifyFindingImpact` que a tela já usa como recurso (`components/audit-result.tsx:843`),
   senão o backfill de parecer antigo quebra.
2. **`qualityVerdict AuditFeedbackVerdict?`** admite `MISSING_FINDING`, que é veredito
   sobre o parecer ("faltou um achado"), não sobre uma ocorrência que existe. O texto do
   §4.2 lista corretamente só três valores; o bloco Prisma do §15 contradiz o texto.
   Enum próprio.
3. **`AuditFeedback.targetKey`** é `finding:INC-00x` com unique por `(auditId, targetKey)`
   (`app/api/audits/[id]/feedback/route.ts:111`). Casa dentro da mesma auditoria, e só.
   O §18.4 funciona, mas o documento precisa dizer explicitamente que feedback **não**
   casa entre versões por `findingId`.
4. **`Audit.userId` e `Audit.projectId` são `onDelete: SetNull`.** O "AuditAuthor =
   criador da auditoria" do §6.2 pode virar nulo. O Validator precisa de recurso para
   Coordinator.
5. **`assigneeId` deve mirar o membro, não o `User`** — ver C.1.

---

## Ordem de execução

```text
LOTE 1  Portão de acesso único + prova-nenhuma-rota-aberta
          + fechar as três rotas abertas (A.2, A.3, A.4)
   ↓
LOTE 2  dev-auth multi-ator + escritório fantasma nas provas
   ↓
LOTE 3  Migração passo 1 (PROSUL semeada, aditivo)
   ↓
LOTE 4  Migração passo 2 (diagnóstico → backfill, ensaiado em cópia)
   ↓
LOTE 5  Migração passo 3 (NOT NULL + unique novo)
          + lista de projetos passa a ler por organização  ← prova de vida
   ↓
LOTE 6  Resolução CC→projeto + rota de auditoria exigindo projectId
          + extração de lib/audit-store.ts
```

O lote 1 vem antes de tudo porque é o único que corrige exposição já existente, e não
depende de migração nenhuma. O lote 2 vem antes dos de migração porque é ele que
permite provar que os de migração funcionaram.

---

**Fim da especificação.**
Próximo passo: plano de implementação (`superpowers:writing-plans`), um documento por
lote ou um só com os seis, conforme o tamanho couber.
