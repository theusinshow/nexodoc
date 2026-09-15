# Defeitos achados pela bateria

Um defeito por linha, na ordem em que foram achados. "Travado por" é o teste que
quebra se o defeito voltar.

| Data | Cenário | Defeito | Causa | Commit | Travado por |
|---|---|---|---|---|---|
| 14/09/2026 | (antes da bateria) | reauditar o mesmo memorial mostrava o parecer antigo | id da auditoria por documento | a486a53 | scripts/test-auditoria-da-proposta.ts, jornada a3 |
| 14/09/2026 | (antes da bateria) | contagem de auditoria incompleta parecia o total | nenhuma tela lia `passadas_incompletas` junto do número | 983ef51 | scripts/test-auditoria-incompleta.ts, jornada a1 |
| 14/09/2026 | a3 | reauditar o memorial: rodada 2 na tela, só a rodada 1 no IndexedDB (F5 sem /api/audits voltava à rodada 1); o mesmo desenho perdia o título do dossiê e podia regravar o bilhete residual | a gravação imediata (flushPersist) lia o snapshotRef antes do commit do React e nada gravava o estado comitado depois; agora ela pede outra gravação amarrada à geração que vai no estado junto com a mudança, cumprida só pelo commit que a carrega | 13ce603, ae3f61a, e6a7833 | scripts/test-agenda-de-gravacao.ts + a3 (disco lido 300ms depois da rodada 2; F5 sem a rede de recuperação; bilhete fora do disco) |
| 15/09/2026 | c6 | F5 com outra conversa como última e um bilhete residual numa conversa com parecer pronto: a retomada trocava sozinha para ela, a anterior era gravada com o memorial e o `createdAt` da aberta, `nexo:ultima-conversa` voltava para a anterior e a aberta ficava com o bilhete no disco; no F5 direto, um registro fantasma "Nova conversa" com o memorial da aberta (2 de 3 corridas) | entre as escritas à mão de `selectConversation` no snapshot e o commit que traz o id novo, qualquer gravação imediata (o palco limpando o bilhete dentro do commit da troca; o flush da segunda abertura da mesma conversa) lia o id antigo com campos da nova; agora a troca é marcada e, até o commit da nova, só fica um pedido para ela | a602c5a | scripts/test-agenda-de-gravacao.ts (troca: effect de filho no commit da troca; duas aberturas seguidas; debounce na janela) + c6 |
| 15/09/2026 | a5 | auditar de novo o mesmo memorial: a recusa "documento idêntico" aparecia, mas cada tentativa deixava uma linha "Audit" em PROCESSING para sempre e o evento "Auditoria criada" no histórico do projeto | `createPendingAudit` cria a linha antes da checagem de idêntico, e o `return` da recusa não passa pelo `catch`; agora a recusa apaga a linha PROCESSING e o evento daquele id | bd09afa | scripts/test-auditoria-recusada.ts + a5 |

## Suspeitas abertas

- `newConversation` é síncrono: uma mudança agendada no mesmo tick logo antes dele se perde (nenhum chamador real encontrado).
