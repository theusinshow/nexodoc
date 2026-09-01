# Multiplayer dos achados

**Data:** 2026-09-01
**Estado:** desenho aprovado, não implementado
**Sub-projeto 2 de 6** da revisão integrada pedida em 01/09/2026.
**Depende de:** sub-projeto 1 (`2026-09-01-identidade-do-projeto-design.md`), já na main.

---

## O que "multiplayer" quer dizer aqui

Não é acesso simultâneo ao vivo. É **comunicação entre pessoas dentro de uma
auditoria** — decidido com o Matheus em 01/09/2026:

> "o multiplayer eu me refiro a comunicação de usuários dentro de um audit, não
> necessariamente o acesso síncrono ao vivo"

O ritmo é **assíncrono**: cada um abre, muda, e o outro vê ao abrir. Sem SSE, sem
polling. O defeito real hoje não é latência — é estado privado e ausência de
canal.

## O que o código diz hoje

### 1. Não existe canal nenhum

O e-mail de aviso **não carrega o achado**, e é decisão documentada em
`lib/aviso-de-achados.ts`: *"a mensagem sai do alcance do portão de acesso no
instante em que é entregue -- fica na caixa de entrada, é encaminhada, sobrevive
ao desligamento de quem a recebeu"*.

Sobra **um** campo: `AuditFeedback.note`, string única sobrescrita pelo último que
escreve, hoje servindo de justificativa do desfecho (obrigatória no risco
assumido, ver `lib/desfecho-do-achado.ts`).

Consequência: quem recebe um achado só pode registrar um **desfecho**. Se o achado
não é dele, as opções são fechar errado ou deixar apodrecendo na fila. Não existe
"isso é do estrutural".

### 2. Um responsável por achado, por construção

`AuditFeedback` é `@@unique([auditId, targetKey])` com um `assigneeEmail`, um
`notifiedAt`, um `assignedById`. Vários responsáveis é impossível sem tabela nova.

### 3. Não há histórico

Não existe `AuditFeedbackEvent`. `atribuirAchados` sobrescreve `assigneeEmail` e
zera `notifiedAt` — quem teve o achado antes desaparece sem rastro.

### 4. "Resolvido" existe em dois lugares que se ignoram

```ts
// modules/nexo/state/conversation-store.tsx:825
const marcarAchadoResolvido = useCallback((auditId, refId, resolvido) => {
  setAchadosResolvidos(...); schedulePersist();   // → IndexedDB + JSON da conversa
}, [schedulePersist]);
```

E, em paralelo, `AuditFeedback.resolvedAt` no Postgres, gravado por
`POST /api/audits/[id]/feedback`. Nenhum sabe do outro.

`achadosResolvidos` vive no JSON da conversa, e a conversa tem **um dono**
(`NexoConversation.userEmail`). O progresso de quem marca é privado dele.

### 5. Permissão é do escritório inteiro, e binária

`lib/audit-access.ts`: quem está na organização vê toda auditoria de todo projeto
dela. Não há noção de "este projeto é meu".

### 6. Cada pessoa tem sua cópia do espaço de trabalho

`use-abrir-auditoria-por-link.ts` grava o parecer **na conversa atual** — que,
para quem chega pelo link do e-mail, é uma conversa nova, dele. O docblock já
reconhece: *"o Milton, recebendo achados do Victor, NÃO tem a conversa do Victor
na máquina dele"*.

Victor e Milton olham "a mesma auditoria" em duas conversas diferentes, cada um
com seu `achadosResolvidos` privado.

---

## O desenho

### Seção 1 — O achado vira um objeto compartilhado

`AuditFeedback` já é, de fato, a linha de estado do achado: veredito, atribuição,
aviso e desfecho. Cresceu além do nome.

**Não é renomeada.** Migração de tabela por vaidade de nomenclatura, num sistema
no ar, é risco sem retorno. Ganha um docblock dizendo o que virou.

Duas tabelas novas penduradas nela:

```prisma
/// Uma linha da CONVERSA de um achado — o que uma pessoa escreveu, ou o que o
/// sistema registrou. As duas coisas na mesma cronologia; ver a seção 2.
model AuditFindingMessage {
  id          String   @id @default(cuid())
  feedbackId  String
  /// "comentario" | "atribuiu" | "reatribuiu" | "envolveu" | "resolveu" | "reabriu".
  /// Texto e não enum: o vocabulário é de produto e muda sem merecer migração —
  /// mesma razão de `AuditLearning.type`.
  kind        String
  authorEmail String
  authorId    String?
  /// Vazio nos eventos de sistema. O que a pessoa escreveu vem aqui.
  body        String   @default("")
  /// `{de, para}` na reatribuição; `{desfecho}` no fecho. O que a frase precisa
  /// para se montar sem uma segunda consulta.
  details     Json?
  createdAt   DateTime @default(now())
  feedback    AuditFeedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@index([feedbackId, createdAt])
}

/// Quem ACOMPANHA o achado sem responder por ele. Ver a seção 3.
model AuditFindingWatcher {
  id         String    @id @default(cuid())
  feedbackId String
  /// E-mail, e não id de usuário — mesma razão de `AuditFeedback.assigneeEmail`:
  /// dá para envolver quem ainda não entrou no sistema.
  email      String
  /// POR PESSOA. Ver a seção 3: o estado de aviso não pode ser compartilhado.
  notifiedAt DateTime?
  addedById  String?
  addedAt    DateTime  @default(now())
  feedback   AuditFeedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, email])
  @@index([email, notifiedAt])
}
```

Comentar num achado que ninguém atribuiu **cria a linha de `AuditFeedback`**, pelo
mesmo caminho que `atribuirAchados` já usa: um helper compartilhado que faz o
`upsert` com o `fingerprint` calculado do relatório gravado, nunca aceito do
cliente. Sem isso a conversa órfã não teria a que se pendurar, e o `Cascade`
acima não teria dono.

### Seção 2 — O histórico **é** a conversa

Não há tabela de eventos separada. `kind` distingue o que uma pessoa escreveu do
que o sistema registrou, e as duas coisas moram na mesma cronologia.

Duas tabelas produziriam duas linhas do tempo que a tela teria que fundir — e que
poderiam discordar. Uma só entrega o que alguém quer ler ao abrir um achado:

```
Victor atribuiu ao Milton · "olha o item 14, acho que é o mesmo erro do 084"
Milton: isso é do estrutural, não meu
Victor envolveu a Carla
Carla: corrigi na revisão 3
Carla marcou como corrigido no documento
```

Isso responde de uma vez a **responsáveis**, **encaminhamento**, **acompanhamento**
e **histórico** do pedido original.

O recado que acompanha o encaminhamento **não é uma segunda funcionalidade**: é a
primeira mensagem da conversa, com `kind: "atribuiu"` e `body` preenchido. Um
mecanismo, dois momentos.

### Seção 3 — Um responsável, N envolvidos

Decisão que **diverge do pedido literal**. O pedido dizia "permitir atribuir o
mesmo achado a mais de uma pessoa". Com N responsáveis iguais, uma pergunta fica
sem resposta: **o achado está resolvido quando quem fecha?** O primeiro? Todos?
Qualquer regra produz achado que some antes de ser corrigido, ou achado que
ninguém fecha porque cada um acha que é do outro.

- **Responsável** — continua sendo `AuditFeedback.assigneeEmail`. Um. É a coluna
  que já existe, já é indexada por `@@index([assigneeEmail, resolvedAt])` e é o
  que `pendenciasDe()` consulta para montar a home. Mexer nela obrigaria a
  reescrever a fila por nenhum ganho.
- **Envolvidos** — `AuditFindingWatcher`. N. Recebem o aviso, leem, comentam.

O caso real continua atendido: um achado que toca arquitetura e estrutural avisa
os dois, os dois comentam, um responde por ele.

**Por que `notifiedAt` é por pessoa:** o docblock de `AuditFeedback.notifiedAt`
explica que reatribuir tem que zerar o aviso, senão a Carla herda o "já avisado"
que era do Milton e nunca fica sabendo. Com N pessoas, esse estado é de cada uma.

**Duas moradas para "quem está no achado" não é duplicação — a assimetria é a
decisão.** Um responde, os outros acompanham.

### Seção 4 — "Resolvido" passa a ter um dono só

O Postgres manda. `achadosResolvidos` no store local deixa de ser fonte e vira
cache de leitura, alimentado pelo `GET /api/audits/[id]/feedback` que a tela já
faz (e que já devolve `resolvedByName`, `assigneeName` e `euSou`).

**Com uma ressalva que não se pula: há marcações locais reais.** Abandonar o que
já está marcado apagaria trabalho de quem usa, em silêncio — que é o modo de
falhar que este projeto mais evita.

**Quando a empurrada roda:** uma vez por auditoria, no mesmo momento em que a tela
busca o feedback dela (`GET /api/audits/[id]/feedback`), e só para os `refId` que
estão em `achadosResolvidos[auditId]` e voltaram do servidor **sem** `resolvedAt`.
Não é uma varredura de todas as conversas no arranque: seria trabalho para uma
auditoria que ninguém abriu, e num arranque que já tem o que fazer.

Depois de empurrar, a entrada local daquela auditoria é apagada — é o que impede
a empurrada de acontecer de novo e o que faz o servidor virar a única fonte.

A empurrada é idempotente e sem veredito: marca `resolvedAt` e
`resolutionKind: FIXED_IN_DOC`, nunca `verdict`. Inventar um julgamento da IA a
partir de um clique que nunca julgou nada contaminaria o benchmark — exatamente o
estrago silencioso que o docblock de `lib/desfecho-do-achado.ts` descreve.

### Seção 5 — Permissão: transparência em vez de portão

**Nenhum nível de permissão novo.** Quem está no escritório e enxerga a auditoria
pode comentar, envolver, reatribuir e fechar. O escopo continua sendo o de
`lib/audit-access.ts`.

É deliberado, e segue a postura que o código já tomou em
`app/api/projects/por-centro-de-custo/route.ts`: *"o risco aceito, escrito para
não virar surpresa"*. Num escritório de um dígito de pessoas, portão gera pedido
de liberação, não segurança.

E o custo do abuso caiu: **toda ação vira linha assinada na conversa do achado**.
Antes, reatribuir apagava quem tinha o achado sem deixar rastro.

### Seção 6 — Onde a conversa aparece, e onde ela NÃO mora

Hoje o achado é atribuído **em lote**: caixinhas de seleção, um destinatário, um
botão — tudo dentro de `components/audit-result.tsx`, que tem **4.859 linhas**.
Não existe painel por achado.

A conversa exige um lugar por achado. Duas decisões:

**Um componente novo e próprio: `components/achado/conversa-do-achado.tsx`.**
Recebe `auditId`, `findingId` e a linha do tempo; devolve a lista e o campo de
escrever. Nada além do ponto de montagem entra em `audit-result.tsx` — pôr mais
umas trezentas linhas num arquivo desse tamanho é como o arquivo chegou a esse
tamanho.

**O lote sobrevive, e ganha o recado.** A seleção múltipla + destinatário continua
sendo o gesto de distribuir trinta achados numa tarde; ela passa a ter um campo de
texto opcional, e esse texto vira a primeira mensagem de **cada** achado enviado —
uma linha `kind: "atribuiu"` por achado, não uma compartilhada.

**Não redesenho a tela do parecer.** A hierarquia, a densidade e o "Ver achado" no
PDF são os sub-projetos 3 e 5. Aqui entra o painel do achado e o campo do lote; o
resto da tela fica como está.

### Seção 7 — Como se prova, sem gastar IA

**Puro, em node cru:**

- `quemAvisar()` — responsável + envolvidos, menos os já avisados, menos os
  resolvidos. É a regra que hoje mora em `PENDENTE_DE_AVISO` e passa a valer para
  N pessoas.
- `linhaDoTempo()` — monta a lista legível a partir de mensagens e eventos
  misturados, incluindo a frase de cada `kind`.
- A transição de estado do achado: o que cada ação grava e o que ela **não** toca.

**Banco, sem navegador:**

- reatribuir zera o aviso do novo e não ressuscita o do antigo;
- apagar o achado leva conversa e envolvidos junto (`Cascade`);
- comentar num achado nunca atribuído cria a linha **sem inventar veredito**;
- a empurrada do local para o servidor roda duas vezes sem duplicar nada.

**Navegador, duas pessoas:** no molde de `scripts/prova-fila-de-achados.mjs`, que
já encena Victor e Milton em contextos separados do Playwright com
`entrarComo(page, email)`. Victor manda com recado, Milton responde, Victor vê a
resposta.

---

## O que este sub-projeto NÃO faz

- **E-mail de resposta.** O aviso passa a alcançar os envolvidos, mas responder no
  achado não dispara e-mail novo. Notificação e link direto são o **sub-projeto
  3**, e é lá que essa fiação existe.
- **Ver o achado no PDF.** Sub-projeto 3.
- **Conversa compartilhada.** Victor e Milton seguem com espaços de trabalho
  separados; o *achado* é que passa a ser o mesmo objeto. O fato 6 fica intocado
  de propósito: é grande e não bloqueia isto.
- **Tempo real.** Assíncrono. A gaveta do achado recarrega ao abrir e depois de
  cada ação.
- **Chat geral da auditoria.** Conversa sobre o parecer como um todo já acontece
  no WhatsApp/Teams do escritório, e não gruda em nenhum item de trabalho. Um
  segundo chat genérico dentro do NexoDoc competiria com ferramentas melhores
  nisso.

## Riscos aceitos

- **Qualquer um do escritório fecha o achado de qualquer um.** Aceito: a conversa
  registra quem fez, e o escritório é pequeno. Se doer, o portão entra depois —
  com o histórico já pronto para dizer se doeu.
- **A conversa do achado pode crescer sem teto.** Não há paginação nesta versão.
  Um achado com quarenta mensagens é sinal de que a discussão devia ter saído do
  campo, não um caso a otimizar antes de existir.
