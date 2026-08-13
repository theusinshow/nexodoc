# Fila de tarefas (1–10) e o diagnóstico da persistência

Data: 2026-08-13
Estado: **investigação encerrada sem conserto**; nenhuma das 10 tarefas foi implementada.

Este documento existe para a próxima sessão não repetir o que já foi feito nem
tropeçar na mesma armadilha. Leia a seção "A armadilha" antes de rodar qualquer
portão de navegador.

---

## O que JÁ foi aplicado (13/08/2026)

Nada da fila de 1 a 10. O que entrou na `main` foi o trabalho da barra do topo,
e dentro dele uma correção:

- `f4e36e0` — **correção**: `AuditoriaEmCursoInfo` ganhou `conversationId`
  (`modules/nexo/state/auditoria-store.tsx:24`) e o helper `auditoriaDaConversa`.
  Antes, trocar de conversa no meio de uma auditoria levava o `emCurso` junto e
  o exibia sobre a conversa nova.
- `fe5f9ee` — **limpeza**: o `<header>` do `AppShell` era inalcançável (único
  consumidor, `/nexo`, sempre passava `fullBleed`). Saiu com as props
  `moduleName` e `version`.
- `7a59c2d`, `728547b`, `980d528`, `91bcc9d` — a barra do topo.
  Spec em `docs/superpowers/specs/2026-08-13-barra-do-nexo-design.md`,
  plano em `docs/superpowers/plans/2026-08-13-barra-do-nexo.md`.

---

## A armadilha (leia antes de testar)

**Um processo `next dev` rodando há horas produz falhas falsas e consistentes.**

Durante esta sessão, o portão `scripts/shot-nexo-conversa-servidor.mjs` falhou em
duas asserções ("as mensagens da conversa voltaram", "a conversa desceu para este
disco") e uma requisição a `/api/nexo/conversas/[id]` devolveu **500**. Rodei o
portão em dois commits diferentes, obtive a mesma falha, e conclui "regressão
consistente".

Era o mesmo servidor doente servindo os dois testes. O log trazia
`Jest worker encountered 2 child process exceptions, exceeding retry limit`, e o
corpo do 500 era **HTML de página de erro do Next**, não o JSON que o `catch` da
rota devolve — sinal de que o módulo nem chegou a rodar.

Com um `next dev` recém-subido, o mesmo portão passa **13 de 13** e o 500 não
reproduz.

**Regra:** antes de acreditar numa falha de portão, reinicie o servidor de dev e
rode de novo. Se o corpo de um 500 vier em HTML, é o dev quebrado, não a rota.

---

## O diagnóstico da Tarefa 1 (persistência)

### A premissa da tarefa está errada

O enunciado diz que "o memorial auditado não está persistindo no banco". Ele
está, e em dois lugares independentes:

1. **Tabela `Audit`** (`prisma/schema.prisma:266-292`). `persistCompletedAudit`
   (`lib/audit-persistence.ts:100-113`) grava `report` (o `AuditReport` inteiro) e
   `result` (o texto do parecer) ao concluir. Chamada em
   `app/api/audit/route.ts:3634-3643`.
2. **`NexoConversation.data`** (`prisma/schema.prisma:582`). O registro inteiro da
   conversa, com `results[].payload` junto — `app/api/nexo/conversas/route.ts:140`.
   O cliente sobe tudo em `persistNow` (`conversation-store.tsx:466`), sem filtrar
   payload (`conversation-store.tsx:414`).

**Verificado no banco**: seis conversas com auditoria e payload completo — 42, 39,
33, 28, 23 e 10 incongruências, uma delas com 44.045 caracteres de parecer.

### O que foi testado e funcionou

- Portão de troca de máquina (`shot-nexo-conversa-servidor.mjs`): 13/13.
- Abrir conversa que existe **só no servidor**: abre, `started=true`, palco
  montado, miolo reidratado (`selectConversation`, `conversation-store.tsx:804-891`;
  o payload volta na linha 854).
- F5 na mesma máquina com o registro no IndexedDB: o registro sobrevive intacto
  (`results:1`, `temPayload:true`, 42 achados).

**A perda relatada não foi reproduzida.**

### Os riscos reais que restam (achados por leitura de código, não reproduzidos)

1. **Teto de 4 MB por conversa.** `LIMITE_BYTES = 4_000_000` em
   `server/nexo/conversa-remota.ts:59`; acima disso o registro é recusado
   **inteiro** com 413 (`app/api/nexo/conversas/route.ts:104-105`). O comentário do
   próprio arquivo (`conversa-remota.ts:51-58`) nomeia o culpado: *"o que engorda
   uma conversa não são as mensagens: são os `payload` das auditorias"*. Com
   pareceres de 44 mil caracteres, duas ou três auditorias na mesma conversa
   estouram o teto — e a conversa para de subir **em silêncio**. É o suspeito
   número um da perda relatada.

2. **`Audit` e `NexoConversation` são arquivos paralelos sem chave de junção.**
   Não existe `conversationId` em `Audit` (`prisma/schema.prisma:266-292`). A UI
   só alcança um parecer pelo JSON da conversa. Se a conversa não subir ou o
   `results` se perder, o parecer fica no Postgres **inalcançável**, porque o
   único gatilho que consultaria `/api/audits/[id]` é o bilhete
   `auditoriaPendente` — apagado assim que a auditoria termina bem
   (`use-reconectar-auditoria.ts:96`, `ConfirmationCard.tsx:2296`).

3. **`/api/audits/recent` não tem consumidor de UI.** A rota devolve `report` e
   `result` completos (`app/api/audits/recent/route.ts:59-60`), e nenhuma tela a
   chama. É a peça que fecharia o buraco do item 2. Está bloqueada em produção
   salvo `NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true`, e não filtra por usuário.

### O que falta para fechar

Da próxima vez que a perda acontecer, anotar o **título da conversa** e qualquer
aviso na lateral. Com o id dá para consultar o banco e dizer em minutos se o
parecer está lá e por que não voltou. Sem isso, qualquer conserto é chute.

**Não implementar a Tarefa 1 como escrita** — um segundo caminho de gravação
criaria duas verdades sobre a mesma auditoria e não resolveria o que não foi
localizado.

---

## As outras tarefas: o que conferir antes de começar

### Tarefa 2 — texto fragmentado do PDF ("r espingos", "d a pia")
Problema real e independente. Achar o ponto de extração e normalizar ali, com
teste puro em `scripts/` (o repo já tem dezenas de moldes). Ganho duplo: limpa a
evidência exibida e reduz os falsos positivos de português da Tarefa 4.

### Tarefa 3 — disciplina pelo cabeçalho da folha
Regra objetiva, portanto pertence ao motor determinístico, não à IA. Conferir se
a extração já segmenta por página antes de propor parser novo.

### Tarefa 4 — granularidade de erros de português
Duas coisas separadas: (a) o agrupamento numa string corrida é problema de
**formato de saída** do auditor; (b) os falsos positivos são consequência da
Tarefa 2. Fazer a 2 antes de mexer no prompt, senão o prompt é calibrado contra
lixo de extração.

### Tarefa 5 — re-auditoria e diff entre versões
Já existe base: `nexodoc-auditoria-incremental` e o delta do memorial
(`prova:delta`). Conferir o que a etapa 2 do delta já entrega antes de desenhar
versionamento novo.

### Tarefa 6 — canvas como carro-chefe
O canvas da auditoria foi entregue no PR7 (pin, cards, pilhas, drawer). A queixa
de "achado aparece num e some no outro" precisa ser **reproduzida** antes de
"unificar a fonte de dados" — pode ser filtro, não divergência de estado.

### Tarefa 7 — visualizador de PDF
**Provavelmente já existe boa parte.** `AuditResult` recebe `pdfSources` e sabe
abrir a página exata e grifar o trecho; o palco passa o memorial retido
(`PalcoDoNexo.tsx:52-68`). Conferir o que falta de fato — pode ser só a barra de
zoom e navegação, não um leitor novo.

### Tarefa 8 — matriz de severidade
Cuidado com o histórico: já houve uma rodada em que "regras que mandavam calar"
foram removidas porque escondiam achado
(ver `nexodoc-pecar-pelo-excesso`, 12/08/2026 — reportar tudo e classificar por
consequência). Endurecer severidade não pode virar censura de novo. O campo
`severity_reason` pedido na tarefa é bom justamente porque torna o critério
auditável.

### Tarefa 9 — chat esticado
A mais barata e mais isolada: é layout, não toca dado nem IA. Boa candidata para
começar. Atenção às duas armadilhas de CSS já documentadas: regra fora de
`@layer` vence as utilities e mata `border-*` em silêncio; e no palco do Nexo o
painel é estreito com a janela larga, então `xl:` mente — usar `@container`.

### Tarefa 10 — validação de achados (procedente / falso positivo / resolvido)
Já existe metade: `achadosResolvidos` por `auditId` no conversation-store e
`marcarAchadoResolvido`. Falta "falso positivo" e "confirmado", e a persistência
no banco (hoje o resolvido vive só na conversa). Existe `AuditFeedback`
(`prisma/schema.prisma:294-310`) e a rota
`app/api/audits/[id]/feedback/route.ts` — conferir se é o lugar certo antes de
criar tabela nova.

---

## Ordem sugerida para a próxima sessão

1. **Tarefa 9** (chat esticado) — barata, isolada, entrega visível.
2. **Tarefa 2** (extração de texto) — destrava a 4 e melhora a evidência.
3. **Tarefa 1** — só depois de um caso reproduzível com id da conversa; o
   suspeito é o teto de 4 MB.
4. O resto conforme a fila original.
