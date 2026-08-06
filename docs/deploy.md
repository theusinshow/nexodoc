# Deploy — colocar o Nexo no ar para os beta testers

Escrito em 2026-08-06. Este arquivo é a autoridade sobre deploy; onde o
`README.md` divergir, vale este. Ele cobre **dois passos**, porque um link
funcionando não precisa esperar a migração das conversas:

| Passo | Entrega | Situação |
|---|---|---|
| **1. Um container no ar** | link que abre, loga e gera documento | pronto para subir |
| **2. Conversas no servidor** | o trabalho sobrevive ao navegador do testador | pendente |

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

Hoje a conversa inteira vive no `IndexedDB` do navegador do testador
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
  data      Json                  // o StoredConversation, sem os bytes
  @@index([userEmail, updatedAt])
}
```

`data` como `Json` é deliberado, não preguiça. O `StoredConversation` já é
schemaless por projeto — campos novos entram opcionais e registros velhos
seguem válidos (o próprio `nexo-db.ts` documenta isso). Normalizar mensagem,
selo, ajuste, decisão e achado em tabelas trocaria essa propriedade por uma
migração a cada campo novo, e o Nexo ainda está ganhando campo toda semana.

O `IndexedDB` **fica**, como cache local e como resposta offline. O servidor
passa a ser a fonte da verdade, e `updatedAt` resolve o empate.

### Os bytes ficam de fora, e isso precisa aparecer

`NEXODOC_STORAGE_PROVIDER=none`: não existe provedor de armazenamento. Os ODT,
PDF e ZIP gerados moram no `result_blobs` do navegador e não têm para onde ir no
servidor.

Então, ao abrir numa segunda máquina, a conversa volta inteira — mensagens,
selos, ajustes, identidade, decisões — mas **os arquivos gerados não**. O código
atual já lida com isso do jeito silencioso: `selectConversation` pula o arquivo
cujo blob não existe (`conversation-store.tsx:701`). Silêncio aqui é o mesmo
defeito de sempre: parece que funcionou. O artefato precisa aparecer como
"gerado neste dia, arquivo não está nesta máquina — gerar de novo", e não
sumir.

### Ordem de execução

1. Model + migração (`prisma migrate dev`, versionada — o `db:push` era do
   piloto interno).
2. `app/api/nexo/conversas/route.ts`: `GET` lista os resumos do usuário, `PUT`
   grava o registro. Auth pelo padrão da casa: `const session = await auth()` e
   401 sem `session.user`, com o **e-mail** como identificador.
3. `conversation-store.tsx`: o `persistNow` (que já tem debounce de 500ms e um
   `flushPersist` para os momentos críticos) passa a gravar nos dois lados. O
   servidor é best-effort na ida — falha de rede não pode travar o trabalho — mas
   a falha precisa ser visível, não engolida.
4. `refreshList` funde as duas listas por `updatedAt`.
5. O artefato sem bytes locais ganha o estado descrito acima.

### O que provar antes de dizer que funcionou

Não é asserção de DOM. É: gerar um volume numa janela, abrir a mesma conta numa
janela anônima e ver a conversa lá — com o artefato marcado como "não está nesta
máquina", não sumido.
