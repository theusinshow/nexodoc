# Persistência IndexedDB + Histórico na sidebar (item 4)

**Data:** 2026-07-24
**Escopo:** Conversas do Nexo persistem no navegador (IndexedDB) e aparecem na
sidebar; clicar restaura a conversa (mensagens + cards) e os downloads dos
documentos GERADOS. Camada de persistência HEADLESS (a refatoração de UI do chat
vem depois e só reestiliza por cima).

## Decisões (usuário)
- Restaurar TUDO estilo ChatGPT (mensagens + cards + downloads dos gerados).
- Persistir só os GERADOS (LD/capa/volume/auditoria). Os arquivos de ENTRADA
  (pranchas/memorial, pesados) NÃO persistem — restaurar volume/auditoria pede
  reanexar (raro).

## Fatos que simplificam
- `SeloResult` é 100% serializável → persiste/restaura direto.
- `NexoCanvas` lê `useArtifactStore()` → mantido intacto; no restore o
  conversation-store reidrata o canvas via `addArtifact`.

## Arquitetura

### `lib/nexo-db.ts` — wrapper IndexedDB (sem dep nova)
DB `nexo` v1, dois stores:
- `conversations` (keyPath `id`): LEVE — `{ id, title, createdAt, updatedAt,
  messages, seloResults, results: StoredResultMeta[] }` (tudo JSON; sem blobs).
  Index `updatedAt` p/ ordenar a lista.
- `result_blobs` (keyPath `key` = `${convId}:${artifactId}:${fileLabel}`): os
  Blobs dos arquivos gerados (fora do registro leve p/ a lista não carregá-los).

`StoredResultMeta`: `{ artifactId, kind, summary, canvas?, files:[{label, name,
mime, blobKey, primary?}] }`.

### `state/conversation-store.tsx` — provider headless (durável)
Fonte única do DURÁVEL da conversa ativa: `conversationId`, `title`, `messages`,
`seloResults`, `results` (mapa por artifactId). Métodos: `appendMessage`,
`setSeloResults`, `saveResult`, `getResult`, `newConversation`,
`selectConversation(id)`, e a lista `conversations` (resumos p/ a sidebar).
Persiste debounced no IndexedDB. Cunha `id`/timestamps aqui (camada IO, não é o
reducer puro).

### Fiação
- `NexoWorkspace` split: função externa monta os providers (Conversation +
  Artifact + Composer); `NexoWorkspaceInner` roda a lógica e usa o store.
  `seloResults` migra p/ o store (fonte única); `pranchaFiles`/`memorialFile`
  seguem locais/efêmeros (não persistem).
- `NexoChat`: mensagens via store (append/read), em vez de `useState` local.
- `NexoSidebar`: lista real (título por obra/disciplina + data), clique →
  `selectConversation`; "Nova conversa" → `newConversation`.
- Cards (`ConfirmationCard`): `saveResult` no clique + `getResult` na render →
  downloads reidratam no restore. Continuam chamando `addArtifact` (canvas).

## Entrega (2 commits verdes)
- **4A**: nexo-db (stores) + conversation-store (mensagens+selos+lista) + split
  + NexoChat via store + sidebar lista/troca. Restaura texto + cards; cards
  regeram dos selos. (results/blobs ainda não persistem.)
- **4B**: `result_blobs` + `saveResult`/`getResult` + reidratação dos downloads
  nos cards + canvas repovoado no restore.

## Fora de escopo
Bytes das pranchas/memorial. Wiring do `session-reducer` completo (outro PR).
Refatoração visual do chat (vem depois, pedido do usuário).

## Verificação
`tsc` + `eslint` verdes; suíte Nexo passa. E2E ao vivo pelo usuário (persistência
real precisa do browser).
