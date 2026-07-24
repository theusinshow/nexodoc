# Nexo — streaming da resposta, orb vivo e papel de chat

**Data:** 2026-07-24
**Escopo:** frontend/UI do Nexo (orb + chat) + o mínimo de servidor que o streaming exige.
**Não toca:** motor determinístico (geração de LD/capa/volume/auditoria), shader da esfera R3F, canvas.

## Problema

Quatro coisas verificadas no código de hoje, não na memória:

1. **Silêncio de 4-8s.** O turno é single-shot: `executeOpenAiResponse` não transmite
   (`stream: false`), a resposta chega inteira e o `use-reveal-text` **finge** um
   typewriter sobre texto que já chegou. O usuário olha três pontinhos.
2. **Vocabulário do orb pela metade.** `activity` (0..1) existe na API e no shader mas
   nunca é alimentado — o `NexoCopilot` não passa nada, fica sempre 0. `responding` e
   `uploading` estão em `STATE_LABEL` e nos tipos, mas `useAgentState` nunca os emite.
   O progresso real da leitura (`readProgress.done/total`) **já existe** em
   `NexoWorkspace` e simplesmente não desce até a esfera.
3. **Atritos de uso.** O composer não cresce (`rows={1}` + `resize-none`, sem auto-grow),
   desabilita enquanto o Nexo responde, não dá pra abortar um turno (não há
   `AbortController`), o erro não oferece retentar, e o scroll salta pro fim a cada
   mensagem — arrancando de lá quem rolou pra cima pra reler.
4. **Código morto.** `SuggestionCards.tsx` (92 linhas) não é importado em lugar nenhum.

## Decisões tomadas

- **Streaming vale a pena, mas não reina sozinho.** A espera medida pelo usuário é
  média (4-8s), então o streaming empata em valor com os atritos de uso. Fazemos os dois.
- **Ressalva registrada:** o flow `nexo-agent` usa `gpt-5.5` com `reasoning_effort` baixo.
  Em modelo de raciocínio o primeiro token só sai depois da fase de raciocínio, então o
  streaming **encurta** o silêncio, não o zera. Expectativa honesta: ~1,5-3s de silêncio
  e o resto fluindo. Se depois do teste ao vivo o ganho for menor que isso, o caminho é
  revisitar o `reasoning_effort`, não empilhar mais UI.
- **Markdown ficou FORA (YAGNI).** O prompt manda responder "curto e direto", prosa pura;
  nunca pede markdown. Renderizar markdown seria resolver um problema que não existe.
  Se um dia o Nexo passar a escrever listas, aí sim.

---

## 1. Protocolo do turno — prosa primeiro, JSON depois

Hoje o prompt termina com *"Responda SOMENTE com um JSON válido (sem texto fora do JSON)"*
e `reply` é a primeira chave. JSON não se mostra pela metade, então o formato inverte:

- O modelo escreve a resposta **em prosa pura**.
- Depois, e só depois, uma cerca ` ```json ` contendo apenas `{"proposals":[…]}`.

Foi escolhido contra as duas alternativas: um parser incremental de JSON parcial (frágil
exatamente onde dói — escapes, `\n`, aspas internas, corte no meio de um `\u`) e não
transmitir nada. Este caminho deixa o parse **mais simples** do que está hoje, e a ordem
prosa→dados é a natural: o engenheiro lê o texto enquanto a máquina ainda decide os
parâmetros.

### Peça nova: `server/nexo/agent/split-stream.ts`

Puro, **sem imports** — o padrão já estabelecido no projeto (`light-check-core.ts`,
`normalize.ts`) para que rode em node cru sem esbarrar no alias `@/`.

Recebe os pedaços conforme chegam e devolve `{ visibleDelta, jsonTail }`. Casos que
precisa aguentar:

| Caso | Comportamento esperado |
|---|---|
| Prosa normal + cerca no fim | Prosa sai como `visibleDelta`; da cerca em diante acumula em `jsonTail` |
| Cerca partida entre dois pedaços | Não vaza ``` `` ` `` pela tela; segura o sufixo ambíguo até desambiguar |
| Resposta sem cerca nenhuma | Tudo vira prosa, `jsonTail` vazio, zero propostas |
| JSON solto, sem cerca | Detecta o `{` de abertura em início de linha e trata como cauda |
| Modelo devolve o JSON antigo inteiro | Prosa sai vazia; o `parseFirstJsonObject` de hoje recupera `reply` + `proposals` |

**A última linha é a rede de segurança: em qualquer falha de formato, degrada para o
comportamento atual de hoje.** Nunca mostra JSON cru na tela e nunca perde a resposta.

### `run-turn.ts`

Ganha `runNexoAgentTurnStream` **ao lado** de `runNexoAgentTurn`, que permanece. A função
atual é o caminho de quem não transmite (DeepSeek, via `NEXODOC_NEXO_PROVIDER`) e o
fallback geral. Streaming só quando o provider resolvido suporta.

## 2. Rota `/api/nexo/agent`

Responde **SSE** quando o cliente manda `Accept: text/event-stream`; sem esse cabeçalho
devolve o JSON de hoje, intacto — nada que já consome a rota quebra.

Eventos:

- `delta` — pedaço de texto visível.
- `done` — `proposals`, `slotRequest`, `ldPreview`, `usage`.
- `error` — mensagem de falha.

`slotRequest` e `ldPreview` são derivados no servidor **depois** das propostas, então só
podem viajar no `done`. O `signal` da request corta a chamada upstream quando o usuário
aperta parar — sem isso o "parar" seria mentira visual e o token continuaria sendo gerado
e cobrado.

## 3. Chat

### Store (`conversation-store.tsx`)

Hoje só sabe **acrescentar** mensagem (`appendMessage`) e persiste com debounce de 500ms.
Ganha:

- `appendDelta(id, texto)` — faz uma mensagem crescer.
- `finalizeMessage(id, { proposals, slotRequest, ldPreview })` — fecha o turno.

**A persistência não roda por token.** Os deltas mexem só no estado em memória; o
IndexedDB grava no `finalize` (e ao parar). Sem isso, um turno de 400 tokens viraria 400
gravações.

Vale para o React Compiler a mesma disciplina já estabelecida no arquivo: nada de
`ref.current` nem `Date.now()`/`crypto.randomUUID()` no corpo do render.

### Composer e envio

- **Nunca mais desabilita.** Digita-se livremente durante a resposta.
- **Auto-grow** com o conteúdo, até o teto de 128px que o `max-h-32` já define.
- O botão enviar **vira parar** durante o turno (`AbortController`).
- **Parou:** o texto parcial fica na conversa marcado como interrompido, **sem cards** —
  consequência direta e aceita de o JSON vir no fim. Aí manda-se a próxima mensagem.
- **Erro ganha "tentar de novo"**, reenviando a última mensagem do usuário em vez de
  obrigar a redigitar.

### Log

- Scroll só gruda no fim **se já estava no fim** — margem de 64px, para tolerar o
  arredondamento de subpixel do navegador sem exigir o fim exato. Quem rolou pra cima pra
  reler ganha um "↓ novas mensagens" em vez de ser arrancado de lá.
- Bolha do assistente ganha **copiar** no hover.
- `use-reveal-text` **não morre**: sai do caminho com streaming (o texto já chega
  progressivo) e continua servindo o caminho não-streaming.

## 4. Orb

**O shader aprovado nas 5 fases não é tocado.** Só passam a chegar nele os números que
ele já esperava:

- `activity` durante a leitura = `readProgress.done/total`, que já existe em
  `NexoWorkspace` e só precisa descer via `NexoCopilot`.
- `activity` durante a resposta = **taxa de chegada**, não fração. Não se sabe o
  comprimento total antes do fim, então não existe "quanto por cento". O sinal é a
  cadência: cada delta empurra o valor para perto de 1, e ele decai sozinho no silêncio
  entre deltas (suavização exponencial). Resultado: a esfera pulsa enquanto o texto flui
  e assenta quando ele para — que é a informação que importa.
- `responding` passa a ser emitido de verdade quando o primeiro delta chega
  (`analyzing` → `responding`); `useAgentState` ganha esse sinal.

Mantém-se a prioridade de estados existente: `error > dragging > reading > analyzing >
complete > idle`, com `responding` entrando junto de `analyzing` na faixa de "trabalhando".

## 5. Limpeza

`SuggestionCards.tsx` sai (92 linhas, sem nenhum importador).

---

## Verificação

- **Teste puro novo:** `scripts/test-nexo-stream.ts` + `test:nexo:stream` no package.json,
  cobrindo os 5 casos da tabela do `split-stream`.
- Suíte Nexo existente continua verde (13/13).
- `tsc` + `eslint` + `next build` de produção.
- **E2E ao vivo pelo usuário** (precisa de OpenAI configurado): conversar e ver o texto
  fluindo, apertar parar no meio, forçar um erro e retentar, conferir que o orb reage ao
  progresso real da leitura.

## Riscos

| Risco | Mitigação |
|---|---|
| Modelo desobedece o formato novo | Cai no `parseFirstJsonObject`; degrada pro comportamento de hoje |
| Ganho de latência menor que o esperado (raciocínio) | Registrado acima; o lever seguinte é `reasoning_effort`, não mais UI |
| Streaming quebra o provider DeepSeek | `runNexoAgentTurn` não-streaming permanece como caminho dele |
| Deltas martelando o IndexedDB | Persistência só no `finalize` |
