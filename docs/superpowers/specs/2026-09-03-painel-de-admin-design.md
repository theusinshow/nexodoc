# O painel de admin repaginado — e o expurgo que alcança as duas pontas

**Data:** 03/09/2026
**Origem:** leitura do painel inteiro a pedido do mantenedor ("está muito
solto"), mais a falta declarada por ele: poder zerar o histórico e o banco dos
volumes e memoriais montados que ficam no histórico do chat.

Os quatro incômodos foram confirmados por ele, todos: sete abas rasas com cada
tela virando ilha, a Config como depósito de nove seções, ver muito e poder
pouco, e um visual que parece template. Este spec fecha os quatro e acrescenta o
expurgo.

---

## Parte 1 — a arquitetura

### O problema

Sete links no mesmo nível (`components/admin/admin-nav.tsx`), ordenados pela
frequência de uso mas ainda rasos: nada agrupa, nada tem hierarquia. A Visão
geral é vitrine de cartões que só linkam para as outras telas. De nenhum número
se chega ao dado — da lista de auditorias **não se abre a auditoria**, do custo
por obra não se vai à obra. O token é pedido em cada uma das sete telas para uma
sessão que já está aberta no `sessionStorage`. E `app/admin/config/page.tsx` tem
1.104 linhas com nove seções de naturezas diferentes empilhadas na ordem em que
foram escritas.

### Decisão: cockpit mais quatro destinos, com trilho fixo

Cinco rotas no lugar de sete. As sete antigas redirecionam.

| Rota | O que é | Absorve |
|---|---|---|
| `/admin` | **Cockpit** | veredito (`statusDoSistema`), a faixa "exige ação" (`resumoDeAtencao`, hoje escondida dentro da Config), gasto contra teto, últimas auditorias/LDs, últimas ações administrativas |
| `/admin/dinheiro` | **Dinheiro** | consumo (usage/costs), consumo interno, custo por obra, cotação, **teto de gasto** |
| `/admin/motor` | **Motor** | qualidade e metas, modelos por fluxo, provedores e incidentes, **limites de leitura**, **vazão**, teste de conectividade, chaves, ambiente |
| `/admin/pessoas` | **Pessoas** | usuários, vínculo de escritório, **freio do cadastro automático** |
| `/admin/dados` | **Dados** | auditorias, LDs, conversas por obra, **expurgo** |

O agrupamento é pela pergunta que se faz, não pela ordem em que as telas
nasceram. "Quanto custou" é uma pergunta; "o motor está melhorando" é outra;
"quem entra" é outra; "o que o banco guarda" é a quarta.

**A Config deixa de existir.** Não é renomeada nem reordenada: as nove seções
se distribuem pela natureza de cada uma. Metas vão junto de Qualidade porque
meta é a régua da qualidade. Cotação vai para Dinheiro porque é o câmbio do
gasto. Chaves e limites vão para Motor porque são o que a máquina usa para
pensar. Um depósito reordenado continua sendo depósito.

### As três regras que valem para as cinco telas

**1. O token é do shell, não da tela.** Pedido uma vez, no trilho, e o trilho
persiste entre destinos. `AdminTokenForm` continua com o comportamento de
colapsar depois de autenticar e continua sem afirmar validade que não apurou —
só deixa de ser repetido cinco vezes.

**2. Todo número leva ao dado.** É o que mata a ilha, e é onde está o trabalho
real desta parte:

- Cockpit e Dados: a linha da auditoria abre a auditoria. **Hoje não existe
  link nenhum** — `/admin/audits` só filtra e apaga.
- Dinheiro: a linha do custo por obra abre a obra.
- Dados: a linha da conversa abre a conversa no Nexo.

**3. O admin entra no sistema visual.** Chanfro (`nx-edge-6`, `nx-cut-5`) e
tokens da `DESIGN.md`; `Badge` com as variantes de status em vez de cor à mão;
teal apenas no interativo e no atual (a regra do acento único); sem
métrica-herói colorida. Paga a dívida datada de quando `app/admin/**` foi
excluído do escopo do chanfro por decisão registrada — só o cromo compartilhado
(`admin-page-shell.tsx`) tinha sido remediado.

---

## Parte 2 — o expurgo

### O problema, e a armadilha que ele esconde

Um volume montado não vive num lugar só. O Postgres guarda a conversa
(`NexoConversation.data`: mensagens e **metadados** dos resultados); os **bytes**
dos ODT/PDF/ZIP ficam no IndexedDB da máquina que montou (`result_blobs`, base
`nexo`), porque `NEXODOC_STORAGE_PROVIDER=none`.

E a fusão tem uma regra que não pode ser afrouxada: *ausência no servidor NUNCA
vira ordem de apagar o local* — ela é indistinguível de "ainda não subiu".

Somadas, as duas coisas condenam qualquer expurgo que só toque no Postgres:

1. a lista continua inteira na máquina de quem montou;
2. **a primeira edição re-sobe a conversa** — `conversation-store.tsx` chama
   `gravarNoServidor(rec)` a cada persistência.

Um botão "zerar" que não trata isso não limpa nada; ele mente.

### Alcance: o que vai, e o que fica

Três alcances, na mesma tela: **seleção** de conversas, **obra inteira**, e
**tudo**.

**Vai embora:**

- `NexoConversation`;
- `Audit` — e por cascade já existente no schema: `AuditFile`, `AuditText`,
  `AuditFeedback`, e daí `AuditFindingMessage` e `AuditFindingWatcher`;
- `LdDraft` — e por cascade `LdDraftEvent`;
- `DocumentArtifact` — **explicitamente**, porque a relação é `SetNull` e o
  artefato sobreviveria órfão;
- `StoredFile` — com a ressalva abaixo, que é a parte difícil.

**Fica, e a tela diz que fica:** `AiUsageEvent` (o histórico de gasto),
`ProjectEvent`, o `Project`, contas, vínculos e toda a configuração.

**Consequência assumida:** preservado o consumo, o custo por obra passará a
listar essas obras como *"conversa removida"*. `lib/custo-por-obra.ts` já trata
esse caso de propósito ("ausência é fato, não sujeira a esconder"), então não há
código novo — mas é uma mudança visível na tela de Dinheiro, e o spec a registra
para que ninguém a leia depois como defeito.

### A ressalva do `StoredFile` — a chave é o conteúdo

`StoredFile` não tem chave estrangeira nenhuma: a chave primária é o
`checksumSha256`. O mesmo memorial usado em duas obras é **uma linha só**.
Apagar os bytes junto com uma obra apagaria o memorial da outra.

Quatro tabelas apontam para lá por checksum: `ProjectDocument`,
`ProjectUpload`, `AuditFile` e `DocumentArtifact`.

**A ordem importa:** o expurgo apaga primeiro tudo o que referencia, e **só
então** recolhe os checksums que ficaram sem nenhuma referência nas quatro. É a
primeira regra de expurgo que este modelo terá — o comentário no schema diz
"sustenta a regra de expurgo no dia em que ela existir. Não há nenhuma hoje".

### A lápide — como a máquina do outro obedece

Tabela nova:

```prisma
model ConversaExpurgada {
  id           String   @id   // o id da conversa apagada
  userEmail    String
  expurgadaEm  DateTime @default(now())
  expurgadaPor String        // e-mail do admin que executou
  @@index([userEmail, expurgadaEm])
}
```

O painel é da plataforma: o expurgo atravessa donos, e o "tudo" alcança as
conversas de todo mundo. A lápide, não — ela é gravada por conversa com o
`userEmail` dela, e o cliente de cada pessoa só recebe e só obedece às suas. É o
mesmo escopo que a rota de conversas já aplica.

- `GET /api/nexo/conversas` passa a devolver as lápides **do usuário da sessão**
  junto da lista.
- `fundirListas` (em `server/nexo/conversa-remota.ts`) ganha um terceiro
  argumento e passa a devolver também **o que apagar** no disco local: a
  conversa e os `result_blobs` de prefixo `${id}:`. Continua pura, continua
  provada em node cru.
- **A regra da fusão não afrouxa.** Ausência segue não sendo ordem. Lápide *é*
  ordem — explícita, com autor e hora.

**A corrida está fechada:** o `PUT` de conversas passa a recusar id com lápide
(409, com motivo). Sem isso, a máquina que editasse entre o expurgo e a próxima
leitura re-subiria a conversa, e o expurgo desfaria a si mesmo em silêncio.

**A lápide não é podada.** São ~100 bytes por conversa apagada. Podar reabriria
o furo exatamente para o caso que a lápide existe para cobrir: a máquina que
ficou muito tempo sem abrir o sistema.

### A prévia é consulta, nunca estimativa

`GET /api/admin/dados/previa?alcance=…` conta no banco, na hora, e devolve o que
a gaveta mostra: o que vai embora, quebrado por tabela e com o total em bytes; o
que fica; e quantas máquinas receberão lápide. A **decisão** de quais ids entram
em cada alcance é função pura, provada em node cru; a **contagem** é do Prisma.

Confirmação por digitação do alvo: o nome da obra, ou `ZERAR TUDO` no alcance
global. Digitar o alvo específico — e não uma palavra genérica — é o que impede
o acidente clássico de confirmar o gesto certo no objeto errado.

Descartados, com motivo: a janela de "desfazer" de 30 s troca um gesto simples
por um estado intermediário no banco, e este produto já tem histórico de coisas
que *pareciam* ter dado certo; o download de backup antes de apagar mente sobre
ser backup enquanto os bytes dos arquivos não couberem nele.

### A trilha

```prisma
model AcaoAdministrativa {
  id        String   @id @default(cuid())
  quando    DateTime @default(now())
  quem      String        // e-mail, vindo do portão
  acao      String        // "expurgo" | "modelo" | "teto" | ...
  alcance   String        // "selecao" | "obra:088-25" | "tudo"
  resumo    Json          // as contagens do que foi apagado/alterado
  @@index([quando])
}
```

Todo gesto destrutivo e toda mudança de configuração são registrados, e o
Cockpit mostra os últimos. Hoje **nada** é gravado: quem promoveu quem, quem
apagou cinquenta auditorias.

De quebra corrige um defeito que já está no código: `upsertAiModelConfig` e
`disableAiModelConfig` gravam `updatedBy: "admin"` fixo, embora
`checkAdminRequest` já devolva o e-mail de quem chamou. O dado está na mão e é
jogado fora.

---

## Parte 3 — os controles que saem do ambiente

Quatro controles hoje só editáveis por variável de ambiente passam para o
painel, todos na escada **banco → ambiente → constante** já usada por
`AiModelConfig`, `CambioConfig` e `MetaQualidadeConfig`, e todos com piso e teto
no campo.

**Uma tabela só para os quatro**, e não quatro tabelas:

```prisma
model ConfiguracaoDaPlataforma {
  chave        String   @id   // "teto.mensal.usd", "vazao.global", ...
  valor        Json
  declaradaPor String
  atualizadaEm DateTime @updatedAt
}
```

`CambioConfig` e `MetaQualidadeConfig` ganharam tabela própria cada uma porque
cada uma tem forma própria e nasceu sozinha. Repetir isso quatro vezes criaria
quatro migrações, quatro leitores e quatro lugares para esquecer a escada — para
valores que são, todos, um número com piso e teto. As duas tabelas existentes
ficam onde estão: movê-las seria migração sem ganho.

**1. Teto de gasto** (`NEXODOC_MONTHLY_BUDGET_USD` e o global) — por conta e
global. É o que o cockpit precisa para desenhar a régua; sem ele o painel mostra
gasto sem parâmetro. A tela diz o que `lib/ai-budget.ts` já sabe: o teto mede o
que **já foi registrado**, então é barreira de entrada, não freio no meio de uma
auditoria em voo.

**2. Vazão** (`NEXODOC_MAX_AUDITORIAS_SIMULTANEAS` e `_GLOBAL`) — por usuário e
global. É o que protege a RAM; o teto de gasto protege a fatura e não protege a
máquina. A tela diz que a conta **vive no processo**: com mais de uma instância,
cada uma conta a sua. Sem esse aviso o número mente.

**3. Freio do cadastro automático** (`NEXODOC_ESCRITORIO_PADRAO`) — interruptor
de **três** estados, porque a semântica atual é tri e achatá-la em booleano
perderia um caso: ausente = quem chega entra na PROSUL como `MEMBER`;
definida-e-vazia = exige convite; definida = outra organização. Com o aviso do
que a porta aberta significa: o login é Google, então *qualquer* conta Google
que abrir o site vira membro e passa a enxergar os projetos.

**4. Limites de leitura** — `NEXODOC_MAX_CHUNKS_PER_FILE`,
`NEXODOC_CHUNK_CONCURRENCY`, `NEXODOC_CHUNK_TIMEOUT_MS` e
`NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS`.

### O acoplamento com a versão do auditor, e o preço

`versaoDoAuditor` faz hash de `prompt`, dos três modelos, do `esforco` e do
`tamanhoDoBloco`. **`maxChunksPerFile` e `deepChunkMaxOutputTokens` não estão
no hash** — e os dois mudam o que a auditoria acha: o primeiro é cobertura, o
segundo é o teto de saída que já produziu auditoria parcial silenciosa.

Enquanto eram variáveis de ambiente, mexer neles exigia deploy e alguém sabia.
Editáveis num painel, alguém muda a cobertura à tarde e o reuso continua
servindo base produzida sob outro regime — que é exatamente o modo de falha que
`versao-do-auditor.ts` foi escrito para impedir ("disciplina manual que já
falhou na primeira oportunidade não é guarda; é armadilha").

**Decisão:** os dois entram em `ConfiguracaoDoAuditor`, e portanto no hash.

**O preço, dito na cara:** acrescentar campo ao hash muda a versão de todo
auditor, mesmo com os valores nos padrões de hoje — **o acervo de reuso é
invalidado uma vez**. O reuso rende 86–95% no memorial real, então a próxima
auditoria de cada memorial paga cheio, e depois volta ao normal. A alternativa
era deixá-los fora do hash e conviver com reuso que mente. Pagamos a
invalidação única.

`chunkConcurrency` e `chunkTimeoutMs` ficam fora do hash: são operacionais e não
mudam o conteúdo do que se acha.

---

## Como se prova

No padrão do projeto: regra pura em node cru, tela em prova de navegador sem
gastar token.

**Puro (`npm run test:*`, sem banco, sem bundler):**

- a decisão de quais ids entram em cada alcance do expurgo;
- `fundirListas` com lápide — inclusive o caso que garante que ausência
  continua não apagando nada;
- as guardas de piso e teto dos quatro controles novos;
- os três estados do freio do cadastro automático;
- a contagem de referências que decide se um `StoredFile` pode morrer.

**Navegador (`AUDIT_REUSE=1` e estado semeado no IndexedDB, molde do
`shot-audit-reconexao.mjs`):**

- a gaveta do expurgo mostra a prévia contada e o botão só acorda com o alvo
  digitado;
- a segunda sessão, com lápide no servidor, perde a conversa e os blobs do
  disco local;
- os cinco destinos e o trilho, **medindo a caixa contra a janela** — asserção
  de DOM passa verde com o painel fora da tela.

---

## Ordem de execução

1. **Fundação**: as três tabelas novas (`ConversaExpurgada`,
   `AcaoAdministrativa`, `ConfiguracaoDaPlataforma`), a trilha ligada, e o
   `updatedBy` corrigido.
2. **A casca nova, vazia**: as cinco rotas, o trilho fixo, os
   redirecionamentos das sete antigas e o token no shell. As telas ainda
   servem o conteúdo de hoje, movido de lugar sem ser reescrito.
3. **Expurgo, servidor**: prévia, execução, contagem de referências do
   `StoredFile`, lápide, e o 409 no `PUT` de conversas.
4. **Expurgo, cliente**: `fundirListas` com lápide e a limpeza do IndexedDB.
5. **A tela de Dados**, já na casca do passo 2 — a lista por obra, os três
   alcances e a gaveta de confirmação.
6. **Os quatro controles**, com o hash do auditor estendido.
7. **O acabamento**: a dissolução da Config pelas quatro telas, os links que
   levam ao dado, e o chanfro.

**A casca vem antes do expurgo de propósito.** Ela é barata (rotas, trilho,
redirecionamento) e é o que garante que a tela de Dados nasça no lugar
definitivo — sem ela, o gesto destrutivo seria construído numa tela que a
repaginação moveria depois, que é exatamente o retrabalho que decidimos evitar
ao juntar as duas mudanças num spec só. O que fica para o fim é o **acabamento**,
não a estrutura: mover as nove seções da Config e passar o chanfro não bloqueiam
nada, e podem ser feitos tela a tela.
