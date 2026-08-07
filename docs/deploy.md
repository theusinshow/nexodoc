# Deploy — colocar o Nexo no ar para os beta testers

Escrito em 2026-08-06. Este arquivo é a autoridade sobre deploy; onde o
`README.md` divergir, vale este. Ele cobre **dois passos**, porque um link
funcionando não precisa esperar a migração das conversas:

| Passo | Entrega | Situação |
|---|---|---|
| **1. Um container no ar** | link que abre, loga e gera documento | pronto para subir |
| **2. Conversas no servidor** | o trabalho sobrevive ao navegador do testador | feito e provado |

---

## Por que mudou de Vercel + Render para um container só

O arranjo antigo era Vercel (app) + Render (só a conversão de PDF). Três fatos
do código, não preferência:

1. **Duração.** Nenhuma rota declara `maxDuration`. A auditoria profunda roda 24
   blocos com 5 em paralelo (`NEXODOC_MAX_CHUNKS_PER_FILE`,
   `NEXODOC_CHUNK_CONCURRENCY`), e uma única conferência de volume já levou 14s
   nos logs. Função serverless morre no meio; container não tem teto.
2. **Disco.** As rotas leem os modelos ODT com o caminho montado por
   `process.cwd()`. O rastreador do Next não enxerga isso, então cada rota nova
   precisa ser declarada à mão em `outputFileTracingIncludes` — e esquecer disso
   produz um deploy que falha **só em produção**. Já aconteceu com
   `/api/capas/templates`. O container copia `templates/` inteiro.
3. **LibreOffice.** É o que vira ODT em PDF. No mesmo container ele deixa de ser
   um segundo serviço para manter e some a latência de rede da conversão.

O `render-service/` continua no repositório, e o serviço está declarado
comentado no fim do `render.yaml`: voltar ao arranjo separado é descomentar.

---

## Passo 1 — o container

### O que já está no repositório

- **`Dockerfile`** (raiz): `node:22-bookworm-slim`, três estágios
  (`deps` → `build` → `runner`). Instala `libreoffice-writer`, `fonts-dejavu` e
  `fonts-liberation`; define `LIBREOFFICE_PATH=/usr/bin/soffice`; copia
  `templates/` inteiro; sobe com
  `npx prisma migrate deploy && npm run start` — banco fora do esquema derruba o
  container de propósito, porque é pior que app fora do ar.
- **`render.yaml`**: serviço web `nexodoc`, runtime docker, `healthCheckPath:
  /api/saude`, plano `starter`.
- **`/api/saude`**: a checagem de saúde. Ver abaixo.

### As fontes não são detalhe

Sem `fonts-dejavu` e `fonts-liberation` o LibreOffice substitui a fonte na
conversão, a largura do carimbo muda e o documento deixa de bater com o modelo.
O PDF sai, parece certo, e está errado.

### A checagem de saúde vai até o fim da corrente

`/api/saude` não devolve `{ ok: true }` por reflexo. O Node subir nunca foi o
problema; o problema é o modelo ODT não vir no pacote — o app sobe, a tela abre
e a falha só aparece quando alguém tenta gerar. Então ela:

1. lê os `config.json` — **503** se não houver nenhuma prefeitura;
2. confirma que o `.odt` de **cada** uma existe no disco — o registro se contenta
   com o `config.json`, então listar prefeituras não prova nada sobre o modelo;
3. abre o primeiro `.odt` e lê o layout — prova zip, `content.xml` e leitor de
   uma vez. Depois sai do cache por data do arquivo, então repetir a cada 30s
   não custa.

O conversor de PDF entra como **informação**, não como veredito: sem ele o
software ainda entrega ODT, e derrubar o container por isso seria pior.

Os dois caminhos foram provados contra o servidor de verdade:

```
GET /api/saude  →  200
{"ok":true,"conversorPdf":"libreoffice local","prefeituras":4,
 "modelos":["prefchap","pmcriciuma","prefflor","prefsjose"],
 "paragrafosDoPrimeiro":35}

(com um .odt escondido)
GET /api/saude  →  503
{"ok":false,"motivo":"modelo ODT ausente: prefchap","semOdt":["prefchap"]}
```

### As variáveis, e a única que morde

No painel da Render, o `render.yaml` já declara quais existem. As que precisam de
valor (`sync: false`) são: `DATABASE_URL`, `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `NEXODOC_ADMIN_EMAILS`, `OPENAI_API_KEY`.

**A armadilha:** `NEXT_PUBLIC_NEXO_ENABLED` é `NEXT_PUBLIC_*`, ou seja, **é
embutida na compilação**. Mudá-la no painel depois do build não tem efeito
nenhum sobre o pacote servido. Quem decide é o `ARG` do `Dockerfile`, que já vem
`true`. Se o app subir com a tela do Nexo desligada, é aqui.

Duas variáveis herdadas do arranjo antigo devem ficar **vazias**:
`NEXT_PUBLIC_API_URL` e `NEXODOC_ALLOWED_ORIGINS`. Com uma origem só, elas não
têm o que fazer — e mesmo no arranjo separado só afetavam `/api/audit` e
`/api/volume`, nunca o Nexo.

### Antes de convidar alguém

- [ ] `NEXODOC_DEV_AUTH=false` (está no `render.yaml`; confira mesmo assim — é o
      atalho que pula o login).
- [ ] No console do Google Cloud, o **redirect URI** precisa incluir
      `https://<host>/api/auth/callback/google`. Sem isso o login volta para
      localhost e o erro não explica nada. `AUTH_TRUST_HOST=true` já está posto.
- [ ] `DATABASE_URL` apontando para o Neon com a string **pooled**.
- [ ] Plano `starter`, não `free`: o free hiberna aos 15 minutos e a primeira
      visita do dia paga 30-60s de cold start. Testador que espera um minuto na
      tela branca não volta.
- [ ] Abrir `/api/saude` no navegador e ver `ok: true`.
- [ ] Gerar uma capa de verdade pela interface e **abrir o PDF**. É a única prova
      de que o LibreOffice e as fontes chegaram inteiros.

---

## Passo 2 — as conversas no servidor

### O problema, em uma frase

Até 2026-08-06 a conversa inteira vivia no `IndexedDB` do navegador do testador
(`modules/nexo/lib/nexo-db.ts`, banco `nexo`, stores `conversations` e
`result_blobs`). O Postgres nunca vê nada dela: só contabilidade de tokens
(`AiUsageEvent`, que guarda o `conversationId` como rótulo solto, sem chave
estrangeira), artefatos sem os bytes (`DocumentArtifact`) e o rascunho de LD
(`LdDraft`).

Consequências que aparecem no primeiro dia de beta:

- trocar de máquina (ou de navegador) perde o trabalho;
- limpar dados do site perde o trabalho, sem aviso;
- e o pior para um beta: **não há como olhar o que o testador fez.** Se ele
  disser "gerou errado", não existe nada do lado de cá para conferir.

### O que muda

Uma tabela nova, guardando o registro que já existe:

```prisma
model NexoConversation {
  id        String   @id          // o uuid que o cliente já gera
  userEmail String
  title     String
  folderKey String?
  createdAt DateTime
  updatedAt DateTime
  auditoriaPendente Boolean       // coluna, para a lista não abrir o JSON
  data      Json                  // o StoredConversation, sem os bytes
  syncedAt  DateTime
  @@index([userEmail, updatedAt])
}
```

`data` como `Json` é deliberado, não preguiça. O `StoredConversation` já é
schemaless por projeto — campos novos entram opcionais e registros velhos
seguem válidos (o próprio `nexo-db.ts` documenta isso). Normalizar mensagem,
selo, ajuste, decisão e achado em tabelas trocaria essa propriedade por uma
migração a cada campo novo, e o Nexo ainda está ganhando campo toda semana.

O `IndexedDB` **fica**, e não como detalhe: é ele que sustenta o F5 e o trabalho
sem rede. O servidor é o que faz a conversa atravessar máquinas, e `updatedAt`
resolve o empate entre os dois.

### Os bytes ficam de fora, e isso precisa aparecer

`NEXODOC_STORAGE_PROVIDER=none`: não existe provedor de armazenamento. Os ODT,
PDF e ZIP gerados moram no `result_blobs` do navegador e não têm para onde ir no
servidor.

Então, ao abrir numa segunda máquina, a conversa volta inteira — mensagens,
selos, ajustes, identidade, decisões — mas **os arquivos gerados não**. O código
lidava com isso do jeito silencioso: `selectConversation` pulava o arquivo cujo
blob não existe, e o artefato aparecia mudo. Agora a ausência sobe como
`bytesAusentes` e vira texto no card.

**Quando isto deixará de ser verdade:** no dia em que houver um provedor de
armazenamento (S3, R2, o disco do container). Aí `saveResult` manda os bytes
junto e a marca some sozinha. Não é para agora — o volume montado de uma obra
real passa de 100 MB, e essa conta precisa de decisão antes de código.

### O que ficou construído

| Peça | Onde |
|---|---|
| Tabela e migração | `prisma/schema.prisma`, `prisma/migrations/20260806120000_nexo_conversation/` |
| Regras puras (validar, medir, fundir) | `server/nexo/conversa-remota.ts` |
| Rotas | `app/api/nexo/conversas/route.ts` (GET lista, PUT grava) e `[id]/route.ts` (GET um, DELETE) |
| Camada de rede do cliente | `modules/nexo/lib/nexo-sync.ts` |
| Fiação | `modules/nexo/state/conversation-store.tsx` |

Como funciona, em quatro frases:

- **o disco primeiro, sempre.** O `persistNow` grava no IndexedDB e só então
  manda ao servidor. O IndexedDB é o que faz um F5 não perder nada e o que
  funciona sem rede; o servidor é o que faz o trabalho sobreviver a trocar de
  máquina;
- **a lista é fundida, nunca substituída** (`fundirListas`). O mais novo vence
  por `updatedAt`, empate resolve para o local, e **ausência no servidor jamais
  vira ordem de apagar o local** — é indistinguível de "ainda não subiu";
- **abrir prefere o disco.** Só vai ao servidor quando a conversa não está aqui,
  e o que vem desce para o disco na hora;
- **a lista lê colunas, não o JSON.** `title`, `folderKey`, datas e
  `auditoriaPendente` são colunas de verdade; desenhar a barra lateral não
  arrasta megabytes.

### As três coisas que aparecem na tela

Todas existem por causa do mesmo defeito recorrente deste projeto: falhar em
silêncio parece ter dado certo.

1. **Falha ao sincronizar** vira um aviso âmbar na barra lateral, e o texto diz
   as duas coisas: "salvo nesta máquina, mas não no servidor". Sucesso não
   desenha nada — gravar é o esperado, e o esperado não merece pixel.
2. **Conversa que veio do servidor** leva uma nuvem cinza ao lado da hora.
3. **Artefato sem os bytes locais** diz "gerado em outra máquina — gere de novo
   para baixar", em vez de aparecer mudo. O `ResultLinks` recebe o resultado
   inteiro justamente para que nenhum dos quatro lugares que o chamam consiga
   esquecer o aviso.

### O que foi provado, e como

`node scripts/shot-nexo-conversa-servidor.mjs` (= `npm run
qa:nexo:conversa-servidor`) roda **duas sessões de navegador separadas**, com o
IndexedDB da segunda virgem — que é o que "outra máquina" significa. Não gasta
token: nenhuma chamada de modelo, e o envio é disparado pelo gesto real ("Nova
conversa" faz o flush da conversa atual), não por uma chamada à rota. As 12
verificações passam, e a linha do banco é apagada no fim.

Complementando, `node scripts/test-nexo-conversa-remota.ts` prova as 22 regras
puras sem banco, sem rede e sem tela — inclusive a que mais custaria caro: a
fusão não perde conversa.

**O que NÃO está provado no navegador:** o texto "gerado em outra máquina". A
condição que o dispara está provada (o registro atravessa, o blob não), mas o
render em si depende de um card de proposta na conversa, que o teste não
fabrica.

---

## O passo a passo, do jeito operacional

Nada aqui começa do zero. Levantado e conferido em 2026-08-07.

### O que JÁ existe (não recriar)

| Coisa | Situação |
|---|---|
| **Neon Postgres** | de pé em `sa-east-1`, string **pooled**, schema em dia — 5 migrações aplicadas, incluindo `20260806120000_nexo_conversation` |
| **App Google OAuth** | `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` já emitidos |
| **`AUTH_SECRET`, `OPENAI_API_KEY`, `NEXODOC_ADMIN_EMAILS`** | já existem |
| **Conta Render** | existe (o serviço do conversor antigo mora nela) |
| **Código** | `Dockerfile`, `render.yaml`, `/api/saude` e as conversas no servidor, tudo na `main` |

Uma dúvida antecipada e resolvida: **`prisma migrate deploy` funciona pela URL
pooled do Neon.** Prisma Migrate costuma exigir conexão direta por causa do
advisory lock, e o normal seria precisar de uma `DIRECT_URL` só para migrar.
Testado contra o banco de verdade: passa. Não há segunda URL para configurar.

### O que FALTA

**1. Criar o serviço na Render.**
New → Blueprint → apontar para o repositório → ele lê o `render.yaml` e propõe o
serviço `nexodoc`. É um serviço **novo**; o conversor antigo não vira ele.

**2. Preencher as cinco variáveis marcadas `sync: false`:**
`DATABASE_URL` (a mesma string pooled do `.env.local`), `AUTH_GOOGLE_ID`,
`AUTH_GOOGLE_SECRET`, `OPENAI_API_KEY`, `NEXODOC_ADMIN_EMAILS`.
`AUTH_SECRET` a Render gera sozinha. `DOCUMENT_CONVERTER_URL` fica **vazia** — o
LibreOffice está dentro do container.

**3. Deixar a primeira build rodar (~10 min).**
Não há Docker nesta máquina, então esta é a primeira vez que a imagem é
montada de verdade. O que dá para adiantar sem Docker já foi adiantado:
`npm run build` passa localmente, e é o estágio que costuma quebrar.

**4. Liberar o redirect no Google Cloud.**
Credenciais → o cliente OAuth → **Authorized redirect URIs** →
`https://<host-da-render>/api/auth/callback/google`. Guarde o de localhost
também. Sem isto o login volta para localhost e o erro não explica nada.

**5. Conferir `/api/saude`** — precisa dizer `ok: true` e listar as 4
prefeituras.

**6. Gerar uma capa pela interface e ABRIR o PDF.** É a única prova de que o
LibreOffice e as fontes chegaram inteiros no container. Rodar a checagem de
saúde não substitui isto.

**7. Decidir o que fazer com o que sobrou do arranjo antigo.** Se ainda existir
projeto na Vercel apontando para esta `main`, ele vai continuar publicando uma
versão que não roda direito, num link que talvez já esteja com alguém. Pausar ou
apagar. O mesmo vale para o serviço `nexodoc-converter`, que deixa de ter função.

**8. Domínio** — opcional para o beta, mas o link é o que circula. Ver a seção
seguinte.

### Custo

Plano `starter` da Render: US$ 7/mês. O `free` hiberna aos 15 minutos e cobra
30-60s de cold start da primeira visita do dia. Neon tem camada gratuita que
aguenta um beta.
