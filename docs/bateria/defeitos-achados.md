# Defeitos achados pela bateria

Um defeito por linha, na ordem em que foram achados. "Travado por" é o teste que
quebra se o defeito voltar.

| Data | Cenário | Defeito | Causa | Commit | Travado por |
|---|---|---|---|---|---|
| 14/09/2026 | (antes da bateria) | reauditar o mesmo memorial mostrava o parecer antigo | id da auditoria por documento | a486a53 | scripts/test-auditoria-da-proposta.ts, jornada a3 |
| 14/09/2026 | (antes da bateria) | contagem de auditoria incompleta parecia o total | nenhuma tela lia `passadas_incompletas` junto do número | 983ef51 | scripts/test-auditoria-incompleta.ts, jornada a1 |
| 14/09/2026 | a3 | reauditar o memorial: rodada 2 na tela, só a rodada 1 no IndexedDB (F5 sem /api/audits voltava à rodada 1); o mesmo desenho perdia o título do dossiê e podia regravar o bilhete residual | a gravação imediata (flushPersist) lia o snapshotRef antes do commit do React e nada gravava o estado comitado depois; agora ela pede outra gravação amarrada à geração que vai no estado junto com a mudança, cumprida só pelo commit que a carrega | 13ce603, ae3f61a, e6a7833 | scripts/test-agenda-de-gravacao.ts + a3 (disco lido 300ms depois da rodada 2; F5 sem a rede de recuperação; bilhete fora do disco) |

## Suspeitas abertas

- Na troca de conversa, se um efeito de filho (`modules/nexo/components/use-reconectar-auditoria.ts:84-85`) limpar o bilhete no mesmo commit da troca, a gravação imediata sai com o id da conversa A e `memorialMeta`/`createdAt` já da B (`modules/nexo/state/conversation-store.tsx` ~1294/1300), e a B fica com o bilhete no disco. Anterior a 13ce603. Cenário para cobrir: C5 da segunda rodada.
- `newConversation` é síncrono: uma mudança agendada no mesmo tick logo antes dele se perde (nenhum chamador real encontrado).
