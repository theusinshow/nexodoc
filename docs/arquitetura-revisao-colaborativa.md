# NexoDoc — Arquitetura: Revisão Colaborativa de Achados

**Status:** especificação para análise (não implementar ainda)  
**Data:** 2026-08-14  
**Audiência:** Product / Staff Eng / agentes de implementação  
**Nome da capacidade:** Revisão colaborativa de achados (emission-oriented)  
**Não chamar de:** multiplayer, Jira, Google Docs colaborativo

---

## 0. Resumo executivo

O NexoDoc já encontra dezenas de achados numa auditoria. O valor trava quando o resultado “pertence” só a quem rodou a análise.

Queremos coordenar a **revisão técnica pós-auditoria** entre membros do escritório, ancorada no documento:

1. Milton audita o memorial do projeto 063.
2. Nexo aponta muitos problemas (ex.: estrutural).
3. Milton atribui achados ao Victor.
4. Victor entra, vê pendências, abre o achado no PDF, entende e resolve.
5. Milton valida.
6. (Paralelo) Se Y for auditar o 063 e X já estiver auditando, Y acompanha em vez de duplicar.

**Norte do produto:** liberar documento técnico com responsabilidade clara.  
**Centro da UX:** documento + achado, não board de tarefas.  
**Tarefa ≠ Notificação.**

---

## 1. Contexto do produto atual

### 1.1 O que já existe

- NexoAgent como interface principal
- Upload e interpretação de PDFs técnicos
- Auditoria de memoriais, documentos e pranchas
- Achados por impacto/severidade
- Visualização de achados no documento / canvas
- Capa, separatriz, LD, volumes
- Projetos, organizações, membros, eventos
- Feedback de achados (`AuditFeedback`)
- Auditoria incremental/delta (capítulos iguais/alterados/novos)
- Processamento assíncrono / SSE em alguns fluxos
- Conversas persistentes, monitoramento de uso de IA

### 1.2 Stack

- Next.js 16, React 19, TypeScript
- PostgreSQL + Prisma
- NextAuth
- OpenAI SDK
- React Flow / XYFlow, PDF.js / React-PDF / pdf-lib, Three.js
- Tailwind, Playwright

### 1.3 Modelos relevantes hoje

- `User`, `Organization`, `OrganizationMember`
- `Project`, `ProjectEvent`, `ProjectDocument`, `DocumentArtifact`
- `Audit`, `AuditFile`, `AuditFeedback`
- `AiTask`, `NexoConversation`
- Roles org: `OWNER | ADMIN | MEMBER`
- Findings hoje vivem principalmente no JSON `Audit.report`
- `AuditFeedback` já separa:
  - `verdict` → julgamento da IA (procede? falso positivo?)
  - `resolvedAt` → progresso do trabalho (já corrigiu?)

### 1.4 Achados hoje (contrato conceitual)

Campos típicos do finding no report:

- id posicional (`INC-001`) — **não usar como identidade entre versões**
- página, capítulo, evidência, tipo, conflito, sugestão
- impacto: `critico_documental | tecnico_contratual | revisao_editorial`
- disciplina (lida/classificada)
- prioridade/severidade derivada

Já existe matching entre pareceres por fingerprint:

```text
chaveEntreVersoes = normalize(tipo) + "|" + normalize(evidencia).slice(0, 120)
```

IDs posicionais e página sozinha **não** são identidade estável.

---

## 2. Problema e jobs

### 2.1 Problema real

Não é “colaborar em tempo real”.  
É **fechar a emissão de um documento técnico com trabalho distribuído por disciplina**, com rastreabilidade.

### 2.2 Personas e JTBD

| Persona | Job |
|---|---|
| Coordenador / responsável da emissão | Saber o que bloqueia, quem segura, o que falta para liberar |
| Autor do memorial (ex.: Milton) | Auditar, distribuir achados, validar correções |
| Especialista de disciplina (ex.: Victor) | Ver só o que é dele, abrir no documento, resolver |
| Colega que ia auditar o mesmo doc (ex.: Y) | Não duplicar auditoria; acompanhar a que já roda |
| NexoAgent | Responder estado e executar ações de rotina com permissão |

### 2.3 Fluxo canônico A — revisão de achados

```text
Milton audita memorial
  → Nexo gera achados
  → Milton atribui estruturais ao Victor
  → Victor recebe pendência (Meu Trabalho + notificação)
  → Victor abre deep-link no PDF (projeto → auditoria → página → achado)
  → Victor resolve (corrigido / falso positivo / decisão técnica)
  → Milton valida
  → gate de emissão atualiza
```

### 2.4 Fluxo canônico B — evitar auditoria duplicada

```text
X inicia auditoria do 063
  → sistema registra WorkSession RUNNING
Y abre Nexo / projeto 063
  → vê “Milton está auditando o memorial”
  → CTA Acompanhar (não inicia outra full audit)
  → quando termina, ambos veem o mesmo resultado
  → entra fluxo A se houver atribuição
```

### 2.5 O que NÃO construir

- Cursors, CRDT, coedição estilo Figma/Google Docs
- Board Kanban / Jira genérico
- Chat social estilo Slack
- Friend list de usuários online
- Workflow builder configurável no MVP
- Ranking individual de produtividade
- Microserviços de notificação
- Event sourcing completo

### 2.6 Teste permanente de escopo

> Isso ajuda a liberar um documento técnico com responsabilidade clara, ancorado no PDF?

Se a resposta for “ajuda a gerenciar trabalho em geral” → cortar.

---

## 3. Princípios de arquitetura

1. **Documento e achado são o centro** — não a task.
2. **Toda unidade de trabalho nasce de um achado** (ou de uma WorkSession de auditoria). Não existe task solta.
3. **Meu Trabalho ≠ Notificações**
   - Meu Trabalho = estado atual que exige ação
   - Notificação = evento passado
4. **Julgamento da IA ≠ progresso do trabalho** (já no schema; preservar).
5. **Identidade de achado entre versões = fingerprint**, não `INC-00x`.
6. **Simplicidade evolutiva** — monólito Next.js + Postgres; sem bus/CRDT/WS no MVP.
7. **Soft presence de trabalho**, não presence social.
8. **Optimistic UI + version lock**, não multiplayer merge.

---

## 4. Conceitos e entidades

### 4.1 Decisão: o que é entidade

| Conceito | Entidade de banco? | Notas |
|---|---|---|
| FindingOccurrence | **SIM** | Miolo. Materializar a partir do report JSON |
| Assignment / Task | **NÃO** (MVP) | Campos no finding: assignee + status |
| Resolution | Campos no finding | + activity |
| Validation | Campos no finding | eixo paralelo |
| FindingComment | **SIM** | Thread curta |
| FindingActivity | **SIM** | Append-only audit trail |
| Notification | **SIM** | Fan-out de eventos |
| WorkSession (em andamento) | **SIM** (leve) | Auditoria/volume em curso; anti-duplicata |
| FindingLink (versões) | **SIM** (Fase 4) | Ligação entre occurrences de audits diferentes |
| Watcher / Mention table / Label / Board | **NÃO** no MVP | Mention parseado no comment |
| Meu Trabalho | **Vista/query** | Não é tabela |

### 4.2 FindingOccurrence (primeira classe)

Campos essenciais:

```text
id
organizationId
projectId
auditId

# identidade
fingerprint              # tipo|evidencia normalizados (evolução de chaveEntreVersoes)
rootFingerprint          # linhagem estável
previousOccurrenceId?    # occurrence da versão anterior, se matched
reportLocalId            # INC-014 daquela corrida (só display)

# âncora documental
sourceFile?
page?
chapterTitle?
chapterHash?
term?
local?
# bbox/pin opcional depois

# conteúdo (snapshot do parecer)
title/label?
description
evidence
conflict
suggestion?
impact                   # critico_documental | tecnico_contratual | revisao_editorial
priority?
discipline?              # est, elt, his, ...
tier?                    # principal | sugestao
source?                  # regra | ia
confidence?

# trabalho
reviewStatus             # ver state machine
assigneeId?
assignerId?
assignedAt?

# resolução
resolutionKind?          # FIXED_IN_DOC | ACCEPTED_RISK | FALSE_POSITIVE | WONT_FIX_EDITORIAL
resolutionNote?
resolvedById?
resolvedAt?
# evidenceArtifactId? P1

# validação
validationStatus         # NOT_REQUIRED | PENDING | APPROVED | REJECTED
validatedById?
validatedAt?
validationNote?

# qualidade da IA (eixo separado)
qualityVerdict?          # CONFIRMED | FALSE_POSITIVE | WRONG_SEVERITY | null
# pode espelhar/migrar de AuditFeedback

# concorrência
version                  # int optimistic lock

createdAt
updatedAt
```

### 4.3 FindingComment

```text
id
findingId
authorId
body                     # markdown simples / plain text
parentId?                # opcional; MVP pode ser flat
createdAt
updatedAt?
deletedAt?
```

Menções: parse `@email` ou `@userId` no body → cria Notification. Sem tabela Mention no MVP.

### 4.4 FindingActivity (append-only)

```text
id
findingId
actorId?                 # null = sistema
type                     # assigned | claimed | resolved | validated | rejected |
                         # reopened | commented | linked_version | source_changed | ...
payload Json             # before/after, notes, reason
createdAt
```

### 4.5 Notification

```text
id
userId
type
title
body?
projectId?
auditId?
findingId?
actorId?
readAt?
dedupeKey                # evita spam
createdAt
```

### 4.6 WorkSession (em andamento no escritório)

```text
id
organizationId
projectId
kind                     # AUDIT | VOLUME | LD | COVER | OTHER
status                   # RUNNING | WAITING_USER | COMPLETED | FAILED | STALE | CANCELED
actorId
subject                  # "Memorial geral" | fileName
relatedType?             # Audit | ...
relatedId?               # auditId
progress?                # 0-100 ou Json
startedAt
heartbeatAt
finishedAt?
```

Regras:

- Ao iniciar auditoria → upsert session RUNNING
- Heartbeat 60–120s enquanto UI/job ativo
- Sem heartbeat 15–30 min → STALE (some do hub “em andamento”)
- Complete/Fail/Cancel → fecha sessão
- Soft lock: Y é avisado e convidado a acompanhar; hard block opcional depois

### 4.7 FindingLink (Fase 4 — versionamento)

```text
id
fromOccurrenceId
toOccurrenceId
relation                 # SAME | SUPERSEDED | REOPENED_BY_DELTA | SPLIT | MERGED
createdAt
metadata?
```

### 4.8 ProjectDisciplineOwner (P1)

```text
projectId
disciplineCode           # est, elt, ...
userId
```

Permite batch assign e sugestão automática.

---

## 5. State machine

### 5.1 Por que não o fluxo ingênuo de 5 estados de ticket

`OPEN → IN_PROGRESS → FIXED → WAITING_VALIDATION → VALIDATED` mistura progresso, tipo de desfecho e necessidade de validação.

### 5.2 ReviewStatus (estado de trabalho)

| Estado | Significado |
|---|---|
| `OPEN` | Detectado; sem tratamento |
| `ASSIGNED` | Tem responsável; ainda não agiu |
| `IN_REVIEW` | Assignee assumiu / está analisando |
| `RESOLVED` | Desfecho registrado; pode aguardar validação |
| `REOPENED` | Rejeitado, delta invalidou, ou reabertura manual |
| `CLOSED` | Encerrado de forma válida |

### 5.3 resolutionKind (quando resolve)

| Kind | Uso |
|---|---|
| `FIXED_IN_DOC` | Vai corrigir / corrigiu no memorial |
| `ACCEPTED_RISK` | Decisão técnica consciente; nota obrigatória |
| `FALSE_POSITIVE` | Julga a IA; atualiza qualityVerdict |
| `WONT_FIX_EDITORIAL` | Só para `revisao_editorial` |

### 5.4 validationStatus (eixo paralelo)

`NOT_REQUIRED | PENDING | APPROVED | REJECTED`

### 5.5 Política de validação (MVP)

| Impacto | Ao resolver |
|---|---|
| `critico_documental` | `validationStatus=PENDING` → precisa validate para `CLOSED` |
| `tecnico_contratual` | idem |
| `revisao_editorial` | `NOT_REQUIRED` → resolve pode ir direto a `CLOSED` |

### 5.6 Transições

| De → Para | Quem | Evento |
|---|---|---|
| * → ASSIGNED | Author, Coordinator/Admin | `finding.assigned` |
| ASSIGNED → IN_REVIEW | Assignee | `finding.claimed` (opcional; resolve direto também pode) |
| OPEN/ASSIGNED/IN_REVIEW/REOPENED → RESOLVED | Assignee, Author, Admin | `finding.resolved` |
| RESOLVED + PENDING → CLOSED | Validator (Author/Coordinator) | `finding.validated` |
| RESOLVED → REOPENED | Validator | `finding.rejected` |
| CLOSED → REOPENED | Coordinator/Admin; sistema (delta) | `finding.reopened` |
| qualquer ativo → ASSIGNED | reassign | `finding.reassigned` |

### 5.7 Gate de emissão (projeto/auditoria)

Documento/auditoria só fica “pronto para emissão” no sentido Nexo quando:

- 0 findings `critico_documental` em estado aberto (não CLOSED)
- decisions técnicas fechadas ou risco aceito **e validado**
- editoriais não bloqueiam emissão (mas podem aparecer como dívida)

---

## 6. Permissões

### 6.1 Roles de organização (existentes)

`OWNER | ADMIN | MEMBER`

### 6.2 Capacidades contextuais (não virar role global nova no MVP)

| Capacidade | Quem |
|---|---|
| AuditAuthor | criador da auditoria |
| ProjectCoordinator | owner do projeto + org ADMIN/OWNER (+ `coordinatorId` no P1) |
| Assignee | `finding.assigneeId` |
| Validator | por padrão Author ou Coordinator |
| Participant | MEMBER ativo da org do projeto |

### 6.3 Matriz MVP

| Ação | Participant | Assignee | Author | Coordinator/Admin |
|---|---|---|---|---|
| Ver achados do projeto | ✓ | ✓ | ✓ | ✓ |
| Comentar | ✓ | ✓ | ✓ | ✓ |
| Atribuir / reatribuir | | | ✓ | ✓ |
| Resolver | | ✓ | ✓ | ✓ |
| Validar / rejeitar | | | ✓ | ✓ |
| Aceitar risco em crítico | | (+validate) | ✓ | ✓ |
| Falso positivo | | ✓ | ✓ | ✓ |
| Reabrir | | | ✓ | ✓ |
| Encerrar / gate emissão | | | ✓ | ✓ |
| Iniciar auditoria | ✓ | ✓ | ✓ | ✓ |
| Acompanhar auditoria alheia | ✓ | ✓ | ✓ | ✓ |

AuthZ sempre no server. Client não confia em status.

---

## 7. UX e arquitetura de informação

### 7.1 Pós-login: Hub de trabalho (não friend list)

```text
LOGIN
  ↓
HOME / HUB
  ├── 1. Meu Trabalho              ← primário (ação)
  ├── 2. Em andamento no escritório ← consciência operacional
  ├── 3. Projetos recentes
  └── 4. Notificações (sino)        ← secundário
```

**Não** mostrar “usuários online”.  
Mostrar **trabalhos ativos**.

### 7.2 Meu Trabalho

Agrupar por urgência de emissão:

1. Bloqueia emissão — com você
2. Decisão técnica — com você
3. Aguardando sua validação
4. Editorial — com você (recolhido)
5. Aguardando outros (só contador)

Card:

```text
[063-26] Memorial · A-018
Material das ferragens contraditório
Estrutural · Bloqueia emissão · há 2h
[Abrir no documento]
```

### 7.3 Em andamento no escritório

| Projeto | O quê | Quem | Estado | CTA |
|---|---|---|---|---|
| 063-26 | Auditoria memorial | Milton | 62% | Acompanhar |
| 063-26 | 5 achados estruturais | Victor | Na fila dele | — |
| 040-26 | Volume | Ana | Montando | Abrir |

### 7.4 Projeto

Faixa de contexto:

- “Milton está auditando o memorial · Acompanhar”
- ou “12 abertos · 5 com você · 3 bloqueiam emissão”

### 7.5 Auditoria / Achado (estender viewer atual)

No card/painel do achado:

- assignee + status
- ações: Atribuir · Resolver · Validar · Comentar
- deep-link estável por `occurrenceId`

URL canônica:

```text
/projetos/[projectId]/auditorias/[auditId]?finding=[occurrenceId]&page=[n]
```

### 7.6 Jornada Victor (mínimo de passos)

```text
Login → vê “3 pendências” → Abrir → PDF na página do erro → Resolver
```

Máximo 2 saltos até o contexto documental.

### 7.7 Jornada Y (anti-duplicata)

```text
Login ou Projeto 063
  → card “Auditoria em andamento — Milton”
  → Acompanhar
  → (não cria segunda full audit)
```

---

## 8. Notificações

### 8.1 Separação obrigatória

| | Meu Trabalho | Notificação |
|---|---|---|
| Natureza | Estado que exige ação | Evento |
| Some quando | Usuário age / reassign / fecha | Lê ou expira |
| Fonte | Query de findings | Tabela Notification |

### 8.2 Classificação de eventos

**A — Exigem ação** (Meu Trabalho + notificação)

- assigned / reassigned para mim
- validation requested para mim
- rejected da minha resolução
- reopened (manual ou delta)
- menção com pedido

**B — Informativos**

- alguém resolveu o que eu atribui
- validated
- comment sem menção
- auditoria completed
- nova versão do documento

**C — Não notificar**

- ações que eu mesmo disparei
- edits cosméticos
- batch que eu executei (1 resumo no máximo)
- heartbeats

### 8.3 Delivery

| Fase | Canal |
|---|---|
| MVP | In-app only |
| P2 | E-mail digest |
| Depois | Teams/Slack |

Agrupar: “Victor resolveu 4 itens no 063-26”.

---

## 9. Realtime

| Fase | Abordagem |
|---|---|
| MVP | REST mutations + revalidate on focus + polling 30–60s em Meu Trabalho / hub |
| P1 | SSE de eventos (reusar padrão SSE do Nexo) para notifications/activity |
| Não agora | WebSocket dedicado, presence cursors, CRDT, DB realtime externo |

Concorrência:

- coluna `version` em FindingOccurrence
- update condicional
- HTTP 409 → UI recarrega painel

Optimistic updates em assign/resolve/comment.

---

## 10. Workflows detalhados

### 10.1 Do achado ao fechamento

```text
IA encontra problema
  → materializa FindingOccurrence (OPEN)
  → (P1) sugere discipline / auto-assign por mapa do projeto

Milton atribui a Victor
  → ASSIGNED
  → activity + notification A para Victor
  → entra Meu Trabalho do Victor

Victor abre deep-link
  → IN_REVIEW (claim implícito ou explícito)
  → comenta / menciona se precisar

Victor resolve
  → RESOLVED + resolutionKind + note
  → se crítico/técnico: validation PENDING
  → se editorial: pode CLOSED
  → notifica Milton (B ou A se validação)

Milton valida
  → CLOSED + APPROVED
  ou REOPENED + REJECTED + note

Gate de emissão consulta estados abertos
```

### 10.2 Auditoria compartilhada / anti-duplicata

```text
X start audit(project, docs)
  → cria Audit PROCESSING
  → cria WorkSession RUNNING
  → hub/projeto mostram sessão

Y tenta auditar mesmo escopo
  → API/UI detecta session ativa
  → oferece Acompanhar
  → não enfileira segunda full audit (MVP: soft prevent)

Audit completa
  → materializa findings
  → WorkSession COMPLETED
  → notification B para watchers implícitos (actor, project members ativos opcional)
```

### 10.3 Nova versão do documento (Fase 4)

```text
V1 finding resolvido por Victor
V2 memorial enviado + reaudit delta
  → match fingerprint
  → SAME/persistente: herda assignee, thread lineage, resolução se ainda válida
  → ausente e era FIXED: confirmar close + activity
  → capítulo da âncora mudou com resolução prévia:
        REOPENED reason=SOURCE_CHANGED
        notifica assignee (A)
```

---

## 11. Versionamento e delta

### 11.1 Regras

1. Nunca casar por `INC-001` entre audits.
2. Casar por fingerprint tipo+evidência (e chapterHash quando confiável).
3. Página não é identidade; serve de âncora de UI e reancora entre versões.
4. Occurrence antiga permanece imutável no conteúdo da IA; trabalho/linha do tempo preservados.
5. Nova occurrence aponta `previousOccurrenceId` + mesmo `rootFingerprint` quando matched.

### 11.2 O que preservar

- resolução anterior
- responsável
- comentários / activity
- decisão técnica / falso positivo
- rastreabilidade completa

### 11.3 O que evitar

- link automático por embedding/semântica no MVP (falso match é pior que miss)
- apagar histórico da V1

---

## 12. Audit trail

Registrar sempre (FindingActivity e, quando fizer sentido, ProjectEvent):

- finding detectado (sistema)
- assign / reassign / claim
- comment / mention
- resolve (+ kind + note)
- validate / reject
- reopen (manual / delta)
- aceitação de risco
- falso positivo
- link entre versões
- start/complete audit (WorkSession)
- gate de emissão / encerramento

Formato: **estado atual na row + log append-only**.  
Não event sourcing completo.

Exemplo de trilha:

```text
10:32 Nexo encontrou divergência
10:35 Milton atribuiu para Victor
11:02 Victor iniciou análise
11:18 Victor marcou FIXED_IN_DOC
13:40 Milton validou
sex    Nova versão do memorial
14:03 Nexo detectou alteração no capítulo
14:04 Pendência reaberta (SOURCE_CHANGED) para Victor
```

---

## 13. NexoAgent — participação e limites

### Pode

- “Quais pendências tenho?”
- “O que bloqueia a emissão do 063-26?”
- “Passe os itens estruturais para o Victor” (com confirmação)
- “Quem está segurando a emissão?”
- “Alguém já está auditando o 063?”
- “Algo que eu resolvi mudou na última versão?”
- abrir deep-links

### Não pode

- validar crítico sozinho
- aceitar risco técnico sozinho
- marcar falso positivo sem humano
- encerrar auditoria / liberar emissão sozinho
- inventar responsável
- alterar severidade/impacto em silêncio

Agente = operador de coordenação + leitura, **não** responsável técnico.

---

## 14. Métricas

### Úteis (projeto/documento/disciplina)

- % prontidão de emissão (críticos fechados)
- tempo até first assign / resolve / validate
- aging de bloqueadores
- taxa de reopen (manual e por delta)
- achados por disciplina (carga)
- false positive rate do motor
- rework: resolve → reject
- auditorias duplicadas evitadas (sessions accompanied vs started)

### Evitar

- ranking individual de velocidade
- productivity score por pessoa
- gamificação de tickets fechados

Métricas pessoais: só para o próprio usuário (“sua fila”). Gestão: agregar por projeto/disciplina.

---

## 15. Modelo de dados Prisma (proposto)

> Proposta alvo. Nomes podem ajustar na implementação, mas o desenho deve permanecer.

```prisma
enum FindingReviewStatus {
  OPEN
  ASSIGNED
  IN_REVIEW
  RESOLVED
  REOPENED
  CLOSED
}

enum FindingResolutionKind {
  FIXED_IN_DOC
  ACCEPTED_RISK
  FALSE_POSITIVE
  WONT_FIX_EDITORIAL
}

enum FindingValidationStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  REJECTED
}

enum FindingImpact {
  critico_documental
  tecnico_contratual
  revisao_editorial
}

enum WorkSessionKind {
  AUDIT
  VOLUME
  LD
  COVER
  OTHER
}

enum WorkSessionStatus {
  RUNNING
  WAITING_USER
  COMPLETED
  FAILED
  STALE
  CANCELED
}

enum FindingLinkRelation {
  SAME
  SUPERSEDED
  REOPENED_BY_DELTA
  SPLIT
  MERGED
}

model FindingOccurrence {
  id                   String                   @id @default(cuid())
  organizationId       String?
  projectId            String?
  auditId              String
  fingerprint          String
  rootFingerprint      String
  previousOccurrenceId String?
  reportLocalId        String?
  sourceFile           String?
  page                 String?
  chapterTitle         String?
  chapterHash          String?
  term                 String?
  local                String?
  description          String
  evidence             String
  conflict             String
  suggestion           String?
  impact               FindingImpact
  priority             String?
  discipline           String?
  tier                 String?
  source               String?
  confidence           String?
  reviewStatus         FindingReviewStatus      @default(OPEN)
  assigneeId           String?
  assignerId           String?
  assignedAt           DateTime?
  resolutionKind       FindingResolutionKind?
  resolutionNote       String?
  resolvedById         String?
  resolvedAt           DateTime?
  validationStatus     FindingValidationStatus  @default(NOT_REQUIRED)
  validatedById        String?
  validatedAt          DateTime?
  validationNote       String?
  qualityVerdict       AuditFeedbackVerdict?
  version              Int                      @default(1)
  createdAt            DateTime                 @default(now())
  updatedAt            DateTime                 @updatedAt

  audit                Audit                    @relation(fields: [auditId], references: [id], onDelete: Cascade)
  comments             FindingComment[]
  activities           FindingActivity[]

  @@index([assigneeId, reviewStatus, updatedAt])
  @@index([projectId, reviewStatus, impact])
  @@index([auditId, reportLocalId])
  @@index([fingerprint])
  @@index([rootFingerprint])
  @@index([organizationId, updatedAt])
}

model FindingComment {
  id        String   @id @default(cuid())
  findingId String
  authorId  String
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  finding   FindingOccurrence @relation(fields: [findingId], references: [id], onDelete: Cascade)

  @@index([findingId, createdAt])
  @@index([authorId, createdAt])
}

model FindingActivity {
  id        String   @id @default(cuid())
  findingId String
  actorId   String?
  type      String
  payload   Json?
  createdAt DateTime @default(now())
  finding   FindingOccurrence @relation(fields: [findingId], references: [id], onDelete: Cascade)

  @@index([findingId, createdAt])
  @@index([actorId, createdAt])
  @@index([type, createdAt])
}

model Notification {
  id        String    @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String    @default("")
  projectId String?
  auditId   String?
  findingId String?
  actorId   String?
  readAt    DateTime?
  dedupeKey String?
  createdAt DateTime  @default(now())

  @@index([userId, readAt, createdAt])
  @@unique([userId, dedupeKey])
  @@index([findingId])
}

model WorkSession {
  id             String            @id @default(cuid())
  organizationId String?
  projectId      String
  kind           WorkSessionKind
  status         WorkSessionStatus @default(RUNNING)
  actorId        String
  subject        String
  relatedType    String?
  relatedId      String?
  progress       Json?
  startedAt      DateTime          @default(now())
  heartbeatAt    DateTime          @default(now())
  finishedAt     DateTime?

  @@index([projectId, status, startedAt])
  @@index([organizationId, status, heartbeatAt])
  @@index([actorId, status])
  @@index([relatedType, relatedId])
}
```

`AuditFeedback` permanece no curto prazo para não quebrar qualidade/benchmark; occurrences devem ser preenchidas a partir dele no backfill. Médio prazo: qualityVerdict na occurrence é a fonte de verdade de trabalho+qualidade por achado.

---

## 16. APIs (contrato inicial)

Todas autenticadas; authz server-side.

### Findings

```text
GET    /api/work/mine
GET    /api/projects/:projectId/findings?status&impact&assignee&discipline
GET    /api/audits/:auditId/findings
GET    /api/findings/:id
POST   /api/findings/:id/assign          { assigneeId }
POST   /api/findings/:id/claim
POST   /api/findings/:id/resolve         { resolutionKind, note, expectedVersion }
POST   /api/findings/:id/validate        { decision: approve|reject, note, expectedVersion }
POST   /api/findings/:id/reopen          { note, expectedVersion }
GET    /api/findings/:id/activity
GET    /api/findings/:id/comments
POST   /api/findings/:id/comments        { body }
```

### Work sessions / hub

```text
GET    /api/work/hub                     # mine + active sessions + recent projects summary
GET    /api/projects/:projectId/active-work
POST   /api/work-sessions/:id/heartbeat
```

### Notifications

```text
GET    /api/notifications?unread=1
POST   /api/notifications/mark-read      { ids: [] }
```

### Audit start (anti-duplicata)

```text
POST   /api/audit                        # existente; passar a:
                                         # 1) checar WorkSession ativa no escopo
                                         # 2) retornar { existingSession, auditId? }
                                         # 3) UI decide Acompanhar vs forçar (admin)
```

Idempotência: `dedupeKey` em notifications; assign repetido não multiplica eventos.

---

## 17. Arquitetura técnica

```text
┌─────────────────────────────────────────────┐
│ Next.js App Router                          │
│  RSC: Hub, Meu Trabalho, Projeto            │
│  Client: viewer, painel do achado, optimistic│
└─────────────────┬───────────────────────────┘
                  │ Route Handlers
┌─────────────────▼───────────────────────────┐
│ Domain services                             │
│  materializeFindingsFromReport              │
│  assignFinding / resolveFinding / validate  │
│  workSession.start/heartbeat/finish         │
│  notificationFanout                         │
│  matchFindingsAcrossAudits (Fase 4)         │
└─────────────────┬───────────────────────────┘
                  │ Prisma
┌─────────────────▼───────────────────────────┐
│ PostgreSQL                                  │
│  FindingOccurrence, comments, activities    │
│  Notification, WorkSession                  │
│  Audit.report JSON permanece snapshot IA    │
└─────────────────────────────────────────────┘
```

### Decisões técnicas fechadas

| Tema | Decisão |
|---|---|
| Banco | Postgres único |
| Materialização | no complete da Audit |
| Cache | contador Meu Trabalho por user; invalidate on write |
| Jobs | no fluxo atual de audit complete; sem broker novo no MVP |
| Realtime MVP | polling + focus revalidate |
| Realtime P1 | SSE notifications |
| Concorrência | version column + 409 |
| Auth | session NextAuth + checagem org/project |
| Boundaries | mutações só server |
| Bus/microservices | não |
| CRDT | não |

### Server/client

- Listagens e contadores: server
- Painel do achado: client com mutations
- PDF viewer: client; recebe occurrenceId e ancora página/termo
- Nunca confiar em assignee/status vindos só do client para authz

---

## 18. Migração

1. Criar tabelas novas (feature flag `collaborative_review` por org).
2. No complete de audits novas: materializar findings.
3. Backfill batch de audits COMPLETED:
   - ler `report.incongruencias[]`
   - criar FindingOccurrence
   - fingerprint + reportLocalId
4. Mapear `AuditFeedback` → qualityVerdict / resolvedAt / note quando `findingId` casar.
5. Feedback antigo sem userId: resolvedBy null; activity `system_migration`.
6. UI:
   - flag on → lê DB
   - flag off / sem rows → fallback read-only do JSON atual
7. Não apagar JSON do report.
8. Conversas Nexo intocadas.
9. WorkSession só para audits novas a partir do deploy.

Compatibilidade: pareceres antigos continuam legíveis; colaboração habilita progressivamente.

---

## 19. MVP e fases

### P0 — obrigatório (Fases 0–2)

1. Materializar FindingOccurrence ao completar auditoria
2. reviewStatus + assignee + resolve kinds + validate crítico/técnico
3. Meu Trabalho + contador no hub
4. Deep-link occurrence → PDF
5. Comentário simples
6. Activity básica
7. Notifications in-app (assign, mention, validate request, resolve do que eu atribui)
8. WorkSession + “Em andamento” + Acompanhar (anti-duplicata soft)
9. Permissões Author/Assignee/Coordinator
10. Backfill + feature flag

### P1 — importante

- ProjectDisciplineOwner + batch assign por disciplina
- Gate visual de emissão no projeto
- SSE de notifications
- Agent tools de fila/assign/active-work
- Anexar evidência na resolução
- Claim automático / heartbeat mais fino

### P2 — depois

- FindingLink + herança forte + reopen SOURCE_CHANGED
- E-mail digest
- Teams/Slack
- Match semântico sugerido (aceite humano)
- Validator por finding
- Presence “alguém está neste achado”
- Regras configuráveis por escritório

### Não fazer agora

- Multiplayer de edição
- CRDT / WS presence social
- Kanban/Jira
- Friend list
- Microserviços
- Workflow engine

### Roadmap com dependências

```text
FASE 0  Materialize FindingOccurrence + fingerprint + backfill
   ↓
FASE 1  reviewStatus + resolve/validate (single-player elevado)
   ↓
FASE 2  assignee + Meu Trabalho + deep-link + comments + notif in-app
   ↓
FASE 2b WorkSession + hub “Em andamento” + anti-duplicata
   ↓
FASE 3  Gate emissão + batch assign por disciplina
   ↓
FASE 4  Version lineage (FindingLink + reopen por delta)
   ↓
FASE 5  Agent tools + SSE
   ↓
FASE 6  Canais externos
```

Sem Fase 0, o resto é cosmético em JSON.

---

## 20. Testes

### Unit

- transitions ilegais da state machine
- fingerprint estável
- política de validação por impacto
- matriz authz
- dedupe de notification
- stale de WorkSession

### Integration

- materialize on audit complete
- assign → notification → aparece em Meu Trabalho
- resolve FIXED + validate → CLOSED
- editorial resolve → CLOSED sem validate
- concurrent resolve → 409
- start audit com session ativa → retorna existing
- backfill + feedback mapping

### Playwright

- login Victor → badge/contador → open finding na página correta
- Milton assign → Victor resolve → Milton validate
- Y tenta auditar 063 em curso → vê Acompanhar, não duplica
- membro de outra org não acessa

### Cenários críticos

1. Crítico sem validate não passa no gate
2. FALSE_POSITIVE fecha trabalho e alimenta qualidade
3. ACCEPTED_RISK exige note não vazia
4. Reassign remove da fila do anterior e entra na do novo
5. V2 match (Fase 4) não duplica thread indevidamente
6. Heartbeat parado marca STALE e libera nova audit

---

## 21. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Virar Jira | Task só a partir de finding; UX no documento |
| Notification fatigue | classes A/B/C + agrupamento |
| Friend-list scope creep | WorkSession por trabalho, não user online |
| Match errado entre versões | fingerprint conservador; semântica só P2 com aceite |
| Perda de resolução no delta | lineage + reopen explícito |
| Corrida validate/resolve | version + 409 |
| Achado sem dono eterno | fila “não atribuídos” + aging no coordinator |
| Falso positivo como atalho | validate em crítico; métrica visível |
| Auditoria zumbi travando projeto | TTL STALE em WorkSession |
| Vigilância de funcionários | métricas agregadas; sem ranking individual |
| Migração cara/errada | flag + backfill + fallback JSON |

---

## 22. Custo e dificuldade (ordem de grandeza)

| Fatia | Esforço | Dificuldade |
|---|---|---|
| P0 Fases 0–2 + 2b | ~3–5 semanas eng sênior | Média-alta |
| P1 | +2–3 semanas | Média |
| P2 version lineage | +2–4 semanas | Alta |
| Integrações externas | depois | Baixa–média |

**80% do valor comercial do fluxo Milton→Victor:** assign + Meu Trabalho + deep-link + resolve/validate.  
**Custo principal:** materializar findings + authz + UX no viewer — não realtime.  
**Anti-duplicata (WorkSession)** é barata e forte em demo; incluir no P0/P0.5.

---

## 23. Crítica da ideia

1. **Vale a pena?** Sim para escritório multi-disciplina. Para uso 100% solo, só Fase 1 já ajuda.
2. **80% do valor:** Meu Trabalho + assign + abrir no documento + gate de bloqueadores (+ anti-duplicata).
3. **Demo-only a adiar:** presence fina, boards, match semântico, chat integrations.
4. **Complexidade desnecessária:** entidade Task, muitos estados, “multiplayer”, friend list.
5. **Alternativa simples demais:** só share read-only da audit — barata, mas não fecha responsabilidade.
6. **Versão ideal:** document-centric review coordination + soft active-work sessions.
7. **Nome:** Revisão colaborativa / Fila de achados / Coordenação de emissão — **não** multiplayer.
8. **Posicionamento:** eleva NexoDoc de “IA que acha problema” para “sistema de prontidão documental do escritório”.

---

## 24. Recomendação final (proposta única)

Construir **Revisão colaborativa de achados**, emission-oriented:

1. Materializar `FindingOccurrence` no Postgres.
2. Trabalho = estado do achado (sem tabela Task).
3. Hub pós-login = **Meu Trabalho + Em andamento + Projetos** (sem friend list).
4. Victor: notificação **e** pendência em Meu Trabalho; deep-link no PDF.
5. Milton: assign + validate.
6. Y: vê WorkSession e acompanha; não duplica full audit.
7. State machine: `OPEN → ASSIGNED → IN_REVIEW → RESOLVED → CLOSED` (+ `REOPENED`); validation e resolutionKind paralelos.
8. MVP sem CRDT/WS; REST + version lock + polling; SSE depois.
9. Delta/lineage forte na Fase 4; fingerprint já nasce na Fase 0.
10. Agent despacha e explica; não valida risco.
11. Feature flag por org; JSON do report permanece snapshot da IA.
12. Toda feature nova passa no teste do documento/emissão.

---

## 25. Perguntas em aberto (para decisão humana)

1. Validator padrão é sempre o Author da audit ou o Coordinator do projeto?
2. Dois usuários podem ser assignees de um mesmo achado no futuro, ou 1:1 para sempre?
3. Anti-duplicata: soft (avisar) ou hard block da segunda audit no MVP?
4. Editorial entra em Meu Trabalho por padrão ou só se atribuído explicitamente?
5. Nome de UI final: “Meu Trabalho”, “Pendências”, ou “Fila técnica”?

---

## 26. Anexo — mapa mental rápido

```text
                    ┌──────────── Hub ────────────┐
                    │ Meu Trabalho │ Em andamento │
                    └──────┬─────────────┬────────┘
                           │             │
              findings assigned a mim    WorkSessions da org
                           │             │
                           ▼             ▼
                    Finding painel    Audit progress
                           │
                           ▼
                    PDF page + pin
                           │
              resolve / comment / validate
                           │
                           ▼
                    Activity + Notifications
                           │
                           ▼
                    Emission readiness gate
```

---

**Fim da especificação.**  
Próximo passo sugerido após análise: ADRs curtos (Fase 0 materialize, state machine, hub IA) + schema Prisma final + contratos OpenAPI/TS das rotas P0.
`)