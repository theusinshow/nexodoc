# Nexo — Arquitetura do Frontend (Fase 3)

> **A parte VISUAL deste documento mudou de casa.** Tokens, vidro, movimento,
> orbe, primitivos e os padrões compostos do Nexo agora vivem no
> [`DESIGN.md`](../../DESIGN.md), que virou o documento único de design —
> antes a mesma regra existia aqui e lá, e as duas versões já discordavam (a do
> vidro dizia coisas opostas conforme o trecho que se lia). Este documento
> segue válido como **arquitetura**: contratos, máquina de estados, plano de
> construção e decisões. Quando os dois divergirem, o DESIGN.md vence no que é
> visual.

> Gerado por um brainstorm multi-agente (18 subagentes: 2 fundamentar + 12 lentes + 3 críticos + 1 síntese). Documento vivo — a fonte da arquitetura do reflow conversacional. Ver referências em [chatbots/](chatbots/).

---

## Arquitetura Final — Frontend Conversacional do Nexo (reflow)

> Documento amarrado. Resolve os três conflitos apontados pelos críticos (formulário-nos-cards, `artifactId` órfão, contrato de turno atômico vs SSE) e as duas diluições (cromo lateral / over-glass; prévia de volume). Fidelidade 100% à visão: chat centralizado → desliza → centro trabalha → frames de prévia, **sempre texto**, liquid glass **em alguns detalhes**.

---

## 0. Spec de costura — os 6 contratos congelados (leia antes de qualquer PR)

Nenhuma linha de UI é escrita antes destes contratos estarem cravados. São a razão de as 12 lentes não plugarem hoje.

**C1 — Card é READ-ONLY. Nunca formulário.**
Morrem os `<input>`/`<select>`/toggle dentro de bolha (NexoChat.tsx l.317-562). O card vira `ConfirmationCard`: resumo dos slots já resolvidos (mono) + `FolhaPreview`/frame determinístico + **um** botão `Confirmar e gerar` + chips `alterar <slot>`. Corrigir NUNCA abre campo: o chip `alterar` reabre o slot **em conversa**, com pré-respostas. Sem exceção "inline pontual". Isto vence C1 contra reuse-audit/estado.

**C2 — `NexoArtifact` é reescrito (a forma inerte NÃO serve).**
```ts
type ArtifactId = string; // `${kind}:${codigo}:${revisao}:${disciplinaKey}` normalizado
type ArtifactStatus =
  | { status: 'proposed';   params: P }
  | { status: 'generating'; params: P; prevResult?: R } // mantém download antigo válido
  | { status: 'ready';      params: P; result: R }
  | { status: 'error';      params: P; error: NexoIssue };
interface NexoArtifact { id: ArtifactId; kind: NexoArtifactKind; messageId: string; preview?: ArtifactPreview } // & ArtifactStatus
```
O **cliente** cunha o `id` deterministicamente de campos **estruturados** (nunca do `resumo` string). Agente não precisa emitir id na v1. `params`/`result` são tipados por kind (LD: `NexoLdProposalParams`+`LdGenResult`; etc.).

**C3 — Turno é ATÔMICO. Nada de SSE token-a-token na v1.**
`ai-runner` é `stream:false` e `proposals` é JSON não-streamável — SSE se autocontradiz. O ganho barato e honesto é **fatos determinísticos primeiro**: `ldPreview`/frames aparecem em ~0ms (calculados antes da IA), orb entra em `thinking`, e a resposta materializa de uma vez em `AGENT_TURN_SUCCEEDED{turn, previews}`. Reveal do bloco pronto — não "reveal por palavra" (cosmético/desonesto).

**C4 — `/api/nexo/agent` passa a carregar dossiê + slots já respondidos.**
Corpo novo: `{ message, history, seloSets, dossie, slotsResolved }`. Rotas continuam stateless → o cliente **re-envia** o estado de slots a cada turno. Sem isto, slot-filling assertivo é impossível e o dossiê do intake continua morto.

**C5 — Bytes retidos para montar volume.**
`/api/nexo/volume` exige `data` base64 por parte. O `blobRegistry` (fora do React) guarda o **ArrayBuffer/base64** de cada artefato gerado, não só o object URL. `postVolume` lê os bytes do registry na ordem canônica. Object URL é só para download/preview; bytes são para composição.

**C6 — Fronteira ENGINE congelada.**
Imutáveis no reflow: as 8 rotas `/api/nexo/*` + `/api/ld/extract-stamp` + `/api/audit`; `selo-render.ts`; `run-turn.ts`+`normalize.ts`; contratos `SeloForLd`/`NexoDossieDraft`. Única mudança autorizada = **extensão aditiva** do union `NexoAgentProposal` e de `normalize`. Nunca editar rota para "facilitar o chat" — a paridade 1:1 é o ativo, reverificada com os PDFs reais ao fim das fases 4 e 6.

---

## 1. Shell / Layout do reflow

**NexoShell** (client) é dono único do layout e de um latch irreversível `started` (não um enum de 5 fases). `started:false` = welcome; vira `true` no **primeiro turno que pede trabalho** (send de texto OU anexo+pedido — ver Q1). O layout é **derivado** por `selectStage(session)`, nunca setado à mão.

**Invariante de continuidade:** o nó React do copiloto (chat+composer) é montado UMA vez e apenas **reposicionado** — jamais desmontado entre welcome e active. Sem isto o slide é um corte e perdem-se histórico/scroll/foco.

**Topologia (CSS Grid nomeado):**
- `welcome`: coluna única centralizada, `max-width:640px`, `margin:auto` → orb + welcome message + **pré-opções** + composer hero.
- `active`: `grid-template-columns: minmax(0,1fr) var(--copilot-w,400px)` → **STAGE** (centro, artefatos/trabalho) | **COPILOT** (direita, chat+composer docado).
- **Rail esquerdo: FORA da v1** (protege a identidade "chat centralizado"). Nasce em 2 zonas.

**Slide (uma técnica só):** `document.startViewTransition()` **nativo** com `view-transition-name` estável em `nexo-copilot` e `nexo-stage`. O navegador faz o FLIP (anima transform do snapshot — honra "só transform+opacity", nunca `grid-template-columns`). NÃO usar `<ViewTransition>` do React (experimental, ausente no build 19.2.6). Fallback obrigatório `@supports not (view-transition-name)` → classe CSS `.nexo-shell--active` com `translateX/opacity`. Adapter `runShellTransition(fn)`: se `prefers-reduced-motion`, executa `fn()` sem animar. Se o escritório usar Safari/Firefox (Q6), o fallback CSS vira o caminho primário.

**Centro no vão "deslizou → primeiro frame":** o STAGE não fica vazio. Ele **ecoa o pedido** (a solicitação do usuário como título do trabalho) + orb `working` + skeleton com a **forma final** dos frames que vêm. Assim a visão "centro mostra a solicitação/trabalho" é honrada antes de existir artefato.

**Responsivo:** `<1024px` o STAGE vira full-width e o COPILOT vira slide-over drawer (reusa keyframes `sidebar-slide-in/out` + o único backdrop-blur permitido). Welcome idêntico em qualquer largura. Composer/Stage são os MESMOS componentes — só muda o container.

---

## 2. Máquina de estados da conversa/sessão

**Store:** `NexoSessionProvider` = `useReducer(nexoSessionReducer, init)` PURO em `modules/nexo/state/session-reducer.ts` (testável como `normalize.ts`, zero IO). **Dois contexts** — `NexoSessionStateContext` e `NexoSessionDispatchContext` — para o composer/frames não re-renderizarem a cada mensagem. Sem zustand/xstate na v1 (só se profiling acusar). IO vive em hooks action-creators (`useAgentTurn`, `useGenerateArtifact`, `useSeloReader`) que chamam `lib/generate.ts` e despacham `*_SUCCEEDED`/`*_FAILED`.

**Regra de peso:** binários pesados (ArrayBuffers de pranchas, base64/Blob de capa/LD/volume, crops) NUNCA entram no estado React → ficam em `blobRegistry: Map<id, {bytes, url}>` fora do React, com `revokeObjectURL` no descarte. React guarda só ids + metadados leves.

**Estado raiz:**
```ts
NexoSession = {
  started: boolean;
  messages: NexoMessage[];            // unifica ChatMsg (some o local do NexoChat)
  dossie: NexoDossie;                 // MERGE intake + selos, com proveniência NexoFact
  seloSets: Record<DisciplinaKey, SeloForLd[]>; // multi-disciplina (§5)
  artifacts: Record<ArtifactId, NexoArtifact>;  // C2
  activeArtifactId: ArtifactId | null;
  slots: Record<SlotId, SlotState>;   // §3
  intake: { status:'idle'|'classifying'|'reading-selos'|'ready'|'error'; progress?; paused?:boolean };
  turn: { status:'idle'|'thinking'|'error'; error? }; // efêmero, isolado do durável
  diagnostics: NexoIssue[];           // §6
}
```

**Alfabeto de eventos (fechado, tabela de transições testada):**
`USER_SUBMITTED_MESSAGE` · `AGENT_TURN_STARTED` · `AGENT_TURN_SUCCEEDED{turn,previews}` (atômico: append msg + spawn/replace artefatos + turn→idle) · `AGENT_TURN_FAILED` · `FILES_ATTACHED` · `INTAKE_CLASSIFIED{dossie}` · `SELO_PROGRESS` (debounced) · `SELO_PAUSED`/`SELO_RESUMED` · `SELOS_READ{key,selos}` · `SLOT_FILLED{id,value}` · `ARTIFACT_GENERATE_REQUESTED{id}` · `ARTIFACT_GENERATE_SUCCEEDED{id,result}` · `ARTIFACT_GENERATE_FAILED{id,issue}` · `ARTIFACT_FOCUSED{id}` · `ARTIFACT_DISMISSED{id}`.

**Spawn/replace (dedup):** ao `AGENT_TURN_SUCCEEDED` com proposals, para cada uma computa `id` (C2). Se já existe artefato do kind em `proposed` → **atualiza** params. Se está `ready`/`generating` → cria **novo id** (não sobrescreve trabalho pronto). `activeArtifactId` = o último focado, dirige o STAGE.

**Guardas de pré-condição:** no **reducer** (transição ilegal, testável), não só no botão. `ARTIFACT_GENERATE_REQUESTED` de `volume` só é legal se capa+separatriz+LD estão `ready` no estado. Único lugar da regra — resolve o conflito das três casas propostas.

**Colapso proposed/editing:** um estado só (`proposed`, params imutáveis exibidos read-only). "editing" não existe (não há campo para editar) — coerente com C1.

---

## 3. Padrão texto-não-formulário com pré-respostas de IA

**Princípio:** a máquina de "o que falta" é **determinística**; a IA só (a) mapeia texto livre → valor de slot e (b) redige a pergunta + gera pré-respostas. A IA nunca decide o que perguntar nem gera documento.

**`server/nexo/agent/requirements.ts`** — registro `ARTIFACT_REQUIREMENTS`: cada kind declara `SlotDef[]` = `{id, taskKind, required, decision:boolean, deriveFrom(facts), suggest(facts)}`. Ex.: `tituloLd`(required, decision, IA sugere 2-3 candidatos de `tituloSugerido+obra+disciplina`); `numTomos`(default 1, determinístico); `templateId`(deriva de município do dossiê; slot só se >1 prefeitura plausível); `mes/ano`(determinístico, atual+anterior).

**`SlotResolver` PURO:** recebe `{taskKind, dossie+seloSets, slots}` → devolve resolvidos + próximo faltante + `pronto:boolean`. Fatos do dossiê/selos **nunca viram slot** — só decisões humanas. Prefeitura casada por município já entra pré-resolvida (nunca re-perguntada).

**Contrato do turno estendido:**
```ts
NexoAgentTurn = { reply, proposals, slotRequest?, slotFills? }
slotRequest = { slotId, taskKind, prompt, optional, suggestions: {label, value, commit:'fill'|'send'}[] }
```
- `commit:'fill'` (valor: título, prefeitura, "3 tomos") → clicar **escreve no composer**, foca e seleciona; o usuário edita e dá Enter. Fica "no caminho certo" sem digitar do zero.
- `commit:'send'` (fluxo: "Sim, gerar" / "Agora não") → envia direto.
Chips renderizam **abaixo** da bolha (nunca formulário), `reveal` uma vez.

**Extração multi-slot:** o prompt instrui o modelo a extrair TODOS os valores de qualquer frase ("bota 3 tomos e chama de Bloco B" → `numTomos:3` + `tituloLd:'BLOCO B'`). `SlotResolver` aplica, revalida via `matchPrefeitura`/`clampTomos` (reuso puro), e o `reply` reconhece o entendido ("anotei 3 tomos; qual título?"). Chips são conveniência, nunca trilho.

**Pré-respostas — determinístico onde dá, IA só onde precisa de linguagem:** `numTomos`/`mes`/`ano`/`volume` = `suggest()` determinístico (barato, à prova de alucinação). `tituloLd`/prefeitura-ambígua = IA. Suggestions ordenadas por confiança; a 1ª é recomendada, **nunca** auto-commitada.

**Confirmação de irreversível 100% em texto:** `fill` JAMAIS gera. Geração só por (a) clique em `Confirmar e gerar` no ConfirmationCard, ou (b) send-chip explícito "Sim, pode gerar". Antes, o `reply` resume ("Vou gerar a LD Estrutural, 42 folhas, título BLOCO B, 1 tomo — confirma?"). Volume lista as partes na ordem canônica antes de montar.

**Agrupamento (pacing da visão "pede TODAS as infos"):** opcionais de um kind vão num único `slotRequest` com vários chips + um chip "usar tudo padrão". Obrigatórios de decisão (título) podem vir no mesmo turno. Evita o "um-slot-por-turno" irritante.

---

## 4. Estratégia de prévia

**Invariante de TIPO (não `if`):** `NexoArtifact` (gerado pelo motor) tem `preview`; `NexoAttachment` (PDF do usuário) **não existe no registro de frames**. O componente de frame só aceita `NexoArtifact`. É impossível framear uma prancha pesada por engano. Isto a lente acertou — preservar exatamente.

**Motor de render — UM só:** `react-pdf` (`<Document>/<Page>`), fixando **o worker do react-pdf** (`pdf.worker.react-pdf.mjs`, pdfjs 5.4.296). NUNCA o engine do selo (5.7.284) — mismatch = "API version does not match Worker version", tela branca. Corrigir de passagem os 2 arquivos do volume-builder que hoje apontam react-pdf para o engine errado.

**Primitivo `<ArtifactThumb file={objectUrl} pageNumber width onReady onError/>`** (dynamic `ssr:false`, `renderTextLayer/AnnotationLayer=false`, `IntersectionObserver` — só materializa perto do viewport, escala 0.3-0.5), cache por `artifact.id` no registry. Base64→Blob **uma vez** por artefato (`fetch(dataUrl).then(r=>r.blob())`, decodifica fora da main thread — mata o `atob` síncrono de `base64ToUrl`).

**Ciclo do frame:** skeleton com a **forma final** (retrato capa / paisagem prancha por kind) → `nexodoc-reveal` uma vez ao chegar → viewer overlay glassy só sob demanda. Frames de DADO são **matte/flat** (Card flat-by-default) — nunca glass. Stagger capado `min(index,3)*40ms` (a DESIGN.md proíbe cascata).

**Prévia de VOLUME (desvio consciente — precisa aprovação, Q3):** híbrido — (a) thumbnail **visual real** da pág.1 (a capa), (b) **mapa estrutural** mono derivado de `parts[].startPage/endPage` ("Capa p.1 · Separatriz p.2 · LD p.3-5 · Pranchas p.6-214"), (c) contagem `pageCount`, (d) botão "Abrir volume" → viewer paginado lazy (janela de ~20). NÃO renderiza N páginas. Se o mapa textual não satisfizer a expectativa de "ver o volume montado", é decisão do usuário.

**Capa multi-tomo (ZIP):** a rota devolve ZIP de N capas → **N frames** (um por tomo), o `id` inclui `tomoNumero`. Não é carrossel escondido nem frame único.

**Governança de perf:** máx K `<Document>` simultâneos (fila, como `MAX_CONCURRENT=3` do selo), frames fora de vista descarregam `<Document>` mantendo dataURL cacheado; volume sempre virtualizado.

---

## 5. Multi-disciplina (o fluxo central "jogar PDFs → montar volume")

`buildLdProposal(selos)` e o `resumo` do agente hoje colapsam para UMA disciplina. Decisão v1: **`seloSets: Record<DisciplinaKey, SeloForLd[]>`** onde `DisciplinaKey = disciplina` (revisitar volume+disciplina se necessário). O `buildAgentContext` resume **cada conjunto** (disciplina, código, revisão, totalFolhas) sem estourar tokens. "Montar volume" cruza os conjuntos na ordem canônica capa→separatriz→LD→pranchas, uma sub-sequência por disciplina/volume. Se o builder multi-disciplina não entrar na v1, a promessa "frames de volumeS" (plural) é rebaixada explicitamente para uma disciplina/sessão — não prometida em falso.

---

## 6. Animações + Liquid Glass

**Camada-fonte de motion:** `modules/nexo/lib/motion.ts` espelha os tokens CSS (`DURATION={fast:120,base:180,slow:240}`, `EASE`), + `useReducedMotion()` (JS gate — a media query CSS NÃO desliga `startViewTransition`/FLIP). Novo token escopado `--duration-shell (~320ms)` só para a macro-transição. Saídas ~75% da entrada. Só transform+opacity.

**Liquid glass — MÍNIMO de bom gosto (a visão diz "em alguns detalhes"):**
- **Emenda escopada ao DESIGN.md** (seção "Liquid Glass — camada ambiente"): reverte a Regra do Blur SOMENTE em chrome flutuante/imersivo. Lista fechada: backdrop de modal, **composer dock**, chrome do viewer de PDF, **orb**, wash de welcome. Proibido para sempre em Card/finding/Table/ConfirmationCard.
- **Tokens** derivados dos existentes (nunca cor nova): `--glass-blur:12px`, `--glass-tint` (=`--card`~.62), `--glass-edge` (um degrau acima de `--edge-highlight`), `--glass-ring` (=`--ring`~.14). **Sem WebGL shader, sem ESLint rule na v1** (over-build).
- **`<GlassPanel>`** — único lugar com `backdrop-filter` fora do modal. `@supports not(backdrop-filter)` → `bg-card` sólido; `prefers-reduced-transparency` → sólido. Tint alto = piso de contraste AA (texto ≥4.5:1 sobre o scroll passando atrás).
- **`<NexoOrb state='idle'|'thinking'|'responding'>`** — radial-gradient teal→luminous mascarado (padrão proto-orb já no código), `status-pulse` existente, conic-gradient girando (transform only). Peça central do welcome, mini-indicador no header depois. Iridescência **só teal→luminous→neutro** (nunca rust/roxo/neon; respeita teal <10%). `reduced-motion` → congela em estado-final legível (não 0.01ms).
  > **Como ficou (2026-08-13):** o `NexoOrb` foi apagado sem nunca ter sido
  > usado — o produto foi direto para o orbe 3D (`AgentOrb`), e a redução em CSS
  > que este item descreve virou `agent-orb/OrbGlow.tsx`, hoje o fallback sem
  > WebGL e o placeholder do Canvas. Onde este documento diz `NexoOrb`, leia
  > `AgentOrb` (vivo) ou `OrbGlow` (redução CSS), conforme o degrau do §6.

**Resolvendo a "bolha glassy" (ref Voxa) sem virar letra morta:** a bolha do assistente é `GlassPanel` sutil **como involucro** (tint fraco) mesmo quando contém proposta — mas o `ConfirmationCard`/dado **dentro** dela permanece matte. A "linha de água": acima (moldura/chrome/bolha-de-IA) = vidro; abaixo (qualquer artefato de dado) = matte. Assim o efeito aparece com frequência, sem blur em dado.

**Coordenação VT × orb × streaming:** durante os ~320ms da transição, orb/shimmer são **congelados** (senão duplicam no cross-fade do snapshot). Um "maestro" (o adapter) pausa motion contínuo antes de `startViewTransition`.

---

## 7. Matriz de erros / estados de borda

**Modelo único `NexoIssue`** (mínimo na v1, cresce sob demanda — não taxonomia de 12 codes de cara):
```ts
NexoIssue = { id, scope, severity:'info'|'aviso'|'critico', code, title, detail, evidence?, recovery: NexoRecovery[] }
NexoRecovery = { label, kind:'retry'|'retry-page'|'reupload'|'open-prefeitura'|'switch-to-odt'|'gerar-mesmo-assim'|'trocar-memorial', payload? }
```
Vocabulário de `recovery` **fechado/determinístico** — a IA só escolhe a frase, nunca inventa a ação. Toda falha (rotas, helpers) mapeia para `NexoIssue` (não `Error` genérico): `TypeError`→`NET_OFFLINE`, `AbortError`→timeout, 5xx→serviço.

**Narração conversacional:** issues entram no `reply` como FATOS; a IA redige a explicação curta + oferece recoveries (labels vêm prontos). **Fallback determinístico por code** (template de texto) quando o próprio agente/rede falha — não depender da IA para narrar erro de rede.

| Estado de borda | Tratamento v1 |
|---|---|
| **Aba em background** (selo-render pausa) | `visibilitychange` → `SELO_PAUSED`, banner honesto "Leitura pausada — volte para a aba", **auto-retoma** em `visible`. Migrar para Worker/Offscreen é projeto à parte, não bloqueia v1. |
| **Offline / OCR down / timeout** | classificar do fetch → recovery própria; pausa a fila em offline, retoma em `online`. |
| **Baixa confiança do selo** (`confianca` hoje ignorado) | só campo load-bearing (folha/disciplina) → `SELO_LOW_CONFIDENCE` aviso com pré-resposta ("Confirmo folha 7?"). Batching: "12 de 40 folhas incertas" = 1 turno, não 12. |
| **Sem prefeitura** | `guardCapa` bloqueia, recovery `open-prefeitura`. |
| **Volume sem capa/LD** | `guardVolume` (reducer) crítico, checklist do que falta. |
| **LibreOffice off** (pdf null) | `LIBRE_OFFLINE` aviso: ODT sempre garantido; recovery `switch-to-odt`/`retry`. Para volume = crítico. |
| **Folha gap/dup** | `runLightCheck` estendido → `SHEET_GAP/DUP` aviso (pode ser OCR ruim → pede confirmação, não bloqueia). |
| **Memorial de outra obra** | pré-check barato (obra/código vs dossiê) ANTES da auditoria cara → `MEMORIAL_MISMATCH` crítico, recovery `trocar-memorial`. |

`gerar-mesmo-assim` (override) só para `aviso`, nunca `critico`.

---

## 8. Funções novas priorizadas

**DENTRO da v1 (servem a visão):**
- Composer dock unificado (anexo + textarea + chips de pré-resposta) — o primitivo #1.
- Orb como indicador de estado global (idle/thinking/responding) + fila de jobs leve para narração de conclusão.
- Anexar sem fricção: paste global + dropzone (react-dropzone já instalado) em qualquer momento da conversa.
- Notificação ao terminar leitura/geração com aba oculta (Notification API + toast/orb como fallback).

**FORA da v1 (diluem "chat centralizado" / não pedidos pela visão — defer explícito):**
ProjectRail/histórico · command palette (Cmd-K) · slash-commands · OfficeMemory (agente "aprende") · versionamento+diff de artefatos · export em lote · persistência IndexedDB/Dexie · rota `/health` · sonda proativa. São v2/v3. Command palette + slash são uma **segunda linguagem** concorrendo com a conversa.

> Persistência entre reloads é v2 (Q2). Na v1 a sessão é efêmera (base64/Blob em memória). Comunicar honestamente "salvo neste navegador" se/quando IndexedDB entrar.

---

## 9. Mapa reuso vs reescrita

**REUSAR SEM TOCAR (ENGINE congelado, C6):** todas as rotas `/api/nexo/*`, `/api/ld/extract-stamp`, `/api/audit`; `selo-render.ts` (após o fix de perf abaixo, que é interno e preserva contrato); `run-turn.ts`+`normalize.ts` (`matchPrefeitura`, `clampTomos`); `lib/generate.ts` `postLd/postCapa`.

**REUSAR ADAPTANDO:** `NexoChat` loop send/history e o padrão proposta-como-card → vira ConfirmationCard read-only; `CardShell`/`GenerateButton`/`ResultLinks`/`FolhaPreview` mantidos.

**REESCREVER:** o `SelosPanel` (~920 linhas imperativas) **dissolve** — ações viram propostas/cards; estado sobe para o Provider. Vira um `NexoDebugDrawer` fino atrás de `NEXT_PUBLIC_NEXO_DEBUG`, lendo o MESMO Provider e os MESMOS helpers (nunca diverge; removível quando o chat maturar).

**ESTENDER (aditivo):** `NexoAgentProposal` ganha `conferencia|volume|separatriz|auditoria` em `types.ts`+`normalize.ts`+prompt. `lib/generate.ts` ganha `postCheck/postSeparatriz/postVolume/postAudit`. `NexoArtifact` reescrito (C2). `ChatMsg` unificado em `NexoMessage`.

**Fix de maior ROI (primeiro, isolado):** em `selo-render.ts`, abrir o documento UMA vez por arquivo, iterar `doc.getPage(p)`, remover o `data.slice(0)` por página (hoje re-parseia o PDF inteiro + copia o ArrayBuffer por página). Ganho máximo, risco mínimo, independe de tudo. NÃO fazer Worker/OffscreenCanvas na v1 (reescreve motor provado).

---

## 10. Árvore de componentes

```
<NexoSessionProvider>            state+dispatch contexts, reducer puro, blobRegistry
  <NexoShell>                    latch started, selectStage, runShellTransition (VT nativo)
    <NexoStage> [view-transition-name=nexo-stage]   welcome: oculto | active: trabalho
      <StageEcho>                ecoa a solicitação do usuário (vão pré-frame)
      <StageWorking>             <NexoOrb state=working/> + skeleton-forma-final
      <ArtifactBoard>            frames a partir de artifacts[] (Record)
        <ArtifactFrame>          matte/flat; skeleton→<ArtifactThumb> (react-pdf worker)
        <VolumeFrame>            thumb capa + mapa estrutural mono + pageCount + "Abrir"
    <NexoCopilot> [view-transition-name=nexo-copilot]  NUNCA desmonta
      <NexoOrb/>                 welcome: grande | active: mini no header
      <WelcomeMessage/> + <SuggestionCards/>   pré-opções (só em welcome)
      <ConversationLog role=log> <ol>/<li>
        <MessageBubble>          user: matte | assistant: GlassPanel sutil (involucro)
          <sr-only>Você|Nexo</sr-only>
          <ConfirmationCard>     READ-ONLY: resumo mono + preview + [Confirmar e gerar] + chips alterar
          <SlotPrompt>+<QuickReplyChips>   commit fill|send (abaixo da bolha)
          <RecoveryChips>        NexoIssue → recoveries em texto
      <NexoComposer> [GlassPanel dock]   variantes hero|docked (mesma instância)
        <AttachedFiles/> <Textarea/> <SendButton/>   ComposerController context (setDraft/focus/send)
  <NexoDebugDrawer>              env-only, lê o mesmo Provider + generate.ts
```

**Novos primitivos:** `GlassPanel`, `NexoOrb`, `NexoComposer`, `ArtifactThumb`, `SuggestionCards`, `QuickReplyChips`/`Chip`, `Drawer` (reusa keyframes), `Dialog` (Radix, dono do único backdrop-blur). `.sr-only` canônica em `globals.css` (não existe hoje — pré-requisito de a11y).

**a11y:** `NexoLiveAnnouncer` (regiões `polite`/`assertive` sr-only; a lista é `role=log` navegável, NÃO aria-live). Landmarks fixos independentes da animação (`<main>`=trabalho, `<aside>`=Nexo). Foco NÃO é roubado no slide (fica no composer; prévia pronta = heading focável opt-in via skip-link). Chips = `<button>` reais; `fill` vs `send` diferenciados por aria-label.

---

## 11. Plano de construção (strangler, 6 PRs, motor sempre verde)

**PR0 — Fix de perf + spec de costura.** `selo-render.ts` re-parse (§9). Congelar os 6 contratos (§0) em `types.ts` (reescrever `NexoArtifact`, estender `NexoAgentProposal` e `NexoAgentTurn`). `.sr-only` em `globals.css`. Zero mudança visual.

**PR1 — Fachada `generate.ts`.** `postCheck/postSeparatriz/postVolume/postAudit`; colapsar `base64ToUrl` duplicado; mover a montagem canônica das `parts` com teste de ordem. `SelosPanel` passa a chamar helpers (prova: idêntico).

**PR2 — `NexoSessionProvider`.** Mover TODO estado do `NexoWorkspace`/`SelosPanel` (15+ useState) para o reducer + `blobRegistry`. Sem mudar UI (painel lê do contexto). Ativar `NexoDossie`/`NexoArtifact` como formato de linha.

**PR3 — Unificar mensagens + intake→agente.** `ChatMsg`→`NexoMessage` no Provider. `buildAgentContext` funde dossiê+seloSets; estender corpo de `/api/nexo/agent` (C4). `requirements.ts`+`SlotResolver` puros com suíte de teste.

**PR4 — Kinds + ConfirmationCard read-only.** Estender `normalize.ts`+prompt (conferencia/volume/separatriz/auditoria). Criar `ConfirmationCard` + `QuickReplyChips` (fill/send). **Reverificar paridade 1:1 com PDFs reais.** A partir daqui o chat confere/monta/audita.

**PR5 — Shell + prévia + glass.** `NexoShell` (welcome↔active, VT nativo + fallback), `NexoStage`/`ArtifactBoard`/`ArtifactThumb` (worker react-pdf), `NexoComposer`+`GlassPanel`+`NexoOrb`, emenda ao DESIGN.md + tokens `--glass-*`. Colapsar `SelosPanel` em `NexoDebugDrawer` (env). Tela vira chat-first.

**PR6 — Matriz de erro + multi-disciplina + retest.** `NexoIssue` bus + recovery chips + background-pause + guards no reducer. `seloSets` por disciplina + builder de volume cruzado. Reverificar paridade com PDFs reais.

Cada PR é reversível e deixa o motor intacto. PR2/PR3 entregam "nada visível" (refactor) — vendê-los como fundação.

---

## Apêndice A — Decisões-chave (12)

1. **Card de proposta é READ-ONLY (ConfirmationCard), nunca formulário. Corrigir sempre reabre o slot em conversa, sem campo inline.**
   - _Por quê:_ Pilar #1 da visão ('SEMPRE texto, NUNCA botões/formulários'). O código atual (inputs/selects nos cards do NexoChat) é exatamente o formulário proibido. Os três críticos convergiram: se o reuso dos cards editáveis vencer, a visão morre no dia 1. Read-only conversacional vence o reuso.

2. **Reescrever NexoArtifact para {id, kind, status(union proposed|generating|ready|error), params, result}; o cliente cunha o id deterministicamente de campos ESTRUTURADOS (kind+codigo+revisao+disciplina), não do resumo string.**
   - _Por quê:_ Três lentes (estado/prévia/motion) presumem um artifactId que a forma inerte de types.ts (só kind/status/label/url) não tem, e ninguém no pipeline o cunha. view-transition-name, dedup de spawn e sub-máquina por artefato dependem dele. 'Ativar o tipo inerte' era enganoso — é reescrita.

3. **Turno atômico, sem SSE token-a-token na v1. Entregar 'fatos determinísticos primeiro' (ldPreview/frames instantâneos antes da IA) + orb 'pensando' + reveal do bloco pronto.**
   - _Por quê:_ ai-runner é stream:false hardcoded e proposals é JSON não-streamável — SSE se autocontradiz e exigiria reescrever o runner e o contrato JSON. O 'reveal por palavra' é cosmético/desonesto. O único ganho barato e honesto (preview instantâneo, que é determinístico) não precisa de streaming. Reducer atômico é incompatível com eventos SSE incrementais.

4. **Estender o contrato de /api/nexo/agent para carregar dossiê do intake + slots já respondidos; o cliente re-envia esse estado a cada turno (rotas stateless).**
   - _Por quê:_ Confirmado que route.ts só recebe message/history/selos — o dossiê rico do intake é produzido e jogado fora. Slot-filling assertivo e 'pergunta só o que falta' são impossíveis sem o dossiê no prompt e sem re-enviar os valores coletados em rotas sem sessão.

5. **Reter os bytes (ArrayBuffer/base64) de cada artefato gerado num blobRegistry fora do React, não só o object URL.**
   - _Por quê:_ /api/nexo/volume exige data base64 de cada parte, mas postLd/postCapa descartam o base64 e devolvem só URL. 'Guardar só object URL' quebra montar volume — o clímax da visão. Bytes para composição, URL para download/preview. Binários pesados fora do estado React evitam re-render e diff de megabytes.

6. **Congelar a fronteira ENGINE (rotas, selo-render, run-turn, normalize) como imutável; única mudança autorizada é extensão ADITIVA do union de proposals.**
   - _Por quê:_ O motor é o único ativo validado 1:1 com o padrão do escritório. A tentação de 'ajustar a rota pra facilitar o chat' é como a paridade se perde. Todo o risco do reflow está na casca/estado, não no motor. Reverificar paridade com os PDFs reais ao fim das fases 4 e 6.

7. **Slide via document.startViewTransition() NATIVO + fallback CSS transform-only. Não usar <ViewTransition> do React (experimental, ausente no build 19.2.6) nem framer-motion. O nó do chat NUNCA desmonta entre welcome e active.**
   - _Por quê:_ Três mecanismos concorrentes (FLIP manual, VT React, framer) descreviam a mesma animação sem decisão. VT nativa faz o FLIP pelo navegador honrando 'só transform+opacity' sem dependência nova. Desmontar/remontar o chat perderia histórico/scroll/foco e tornaria o slide um corte.

8. **Cromo lateral (ProjectRail, command palette, slash, OfficeMemory, versionamento, IndexedDB) FORA da v1. Liquid glass confinado ao mínimo: orb + composer/dock + backdrop de modal, com a menor emenda possível ao DESIGN.md.**
   - _Por quê:_ A visão é conversa-primeiro ('chat no centro', 'glass em alguns detalhes'). A lente new-features quase inteira e a governança-monstro de glass (shader WebGL, ESLint rule, 7+ tokens) diluem a identidade com features que a visão nunca pediu. Command palette + slash são uma segunda linguagem concorrendo com a conversa.

9. **Invariante de TIPO Artifact vs Attachment: só artefatos gerados pelo motor têm frame; PDFs anexados pelo usuário nunca entram no registro de frames. Preview usa o worker do react-pdf (5.4.296), nunca o engine do selo (5.7.284).**
   - _Por quê:_ 'Pranchas não ganham frame' é o maior risco de performance da prévia; modelá-lo como tipo (não if espalhado) torna impossível renderizar prancha pesada por engano. O mismatch de worker pdfjs é o risco #1 já documentado no próprio código (tela branca 'API version does not match').

10. **Prévia de volume é híbrida (thumbnail visual da capa + mapa estrutural mono + pageCount + viewer lazy sob demanda), assumida como desvio consciente da 'prévia visual' que precisa de aprovação do usuário.**
   - _Por quê:_ Renderizar centenas de páginas travaria a aba, mas o mapa textual não é a prévia visual que a visão promete. É um trade-off de performance legítimo que não pode entrar como default silencioso disfarçado de 'frame de prévia do volume' — o usuário decide se o índice basta.

11. **SlotResolver determinístico decide O QUE falta; a IA só redige a pergunta e gera pré-respostas (chips fill=preenche o composer, send=envia). Fill jamais gera; geração só por Confirmar e gerar ou send-chip explícito.**
   - _Por quê:_ Separar 'o que falta' (máquina, testável) de 'como perguntar' (IA) elimina loops onde o LLM re-pergunta o que já tem ou esquece o obrigatório. Honra 'sempre texto com pré-respostas' sem terceirizar a corretude ao modelo, e mantém a invariante de que a IA nunca faz nada irreversível.

12. **Dissolver o SelosPanel: ações viram cards na conversa; o resto vira um NexoDebugDrawer fino atrás de env, lendo o mesmo Provider e os mesmos helpers de generate.ts.**
   - _Por quê:_ Reconcilia os dois objetivos em tensão: o dev precisa testar cada motor isolado (razão do painel existir) e o escritório precisa de UMA superfície conversacional (a visão). Sobre o mesmo Provider+fachada, o harness nunca mais diverge do chat e é removível quando o chat maturar.


## Apêndice B — Plano de build (7 fases incrementais)

### PR0 — Fix de perf + spec de costura
Corrigir o re-parse O(páginas) em selo-render.ts (abrir doc 1x por arquivo, iterar getPage, remover data.slice(0) por página) — maior ROI, contrato preservado. Congelar os 6 contratos em types.ts: reescrever NexoArtifact para {id,kind,status-union,params,result}; estender NexoAgentProposal (aditivo) e NexoAgentTurn (slotRequest/slotFills). Adicionar .sr-only canônica em globals.css. Zero mudança visual.

### PR1 — Fachada única de geração
lib/generate.ts ganha postCheck/postSeparatriz/postVolume/postAudit tipados; colapsar base64ToUrl duplicado; mover a montagem canônica das parts (capa→separatriz→LD→pranchas) com teste de ordem. SelosPanel passa a chamar os helpers no lugar do fetch inline (prova de não-regressão: painel idêntico).

### PR2 — NexoSessionProvider
Reducer puro em modules/nexo/state/ com dois contexts (state/dispatch) e blobRegistry fora do React. Mover os 15+ useState do NexoWorkspace/SelosPanel para o Provider sem mudar UI. Ativar NexoDossie/NexoArtifact como formato de linha. Tabela de transições testada. Guardas de pré-condição (volume exige capa+LD+separatriz ready) no reducer.

### PR3 — Unificar mensagens + ligar intake ao agente
ChatMsg→NexoMessage no Provider. buildAgentContext (funde dossiê + seloSets + artefatos). Estender corpo de /api/nexo/agent com dossie+slotsResolved (C4). requirements.ts (ARTIFACT_REQUIREMENTS) + SlotResolver puros, com suíte de teste análoga a test:nexo:agent.

### PR4 — Kinds + ConfirmationCard read-only
Estender normalize.ts + prompt do run-turn com conferencia/volume/separatriz/auditoria (aditivo, degrada gracioso). ConfirmationCard read-only (resumo mono + preview + Confirmar e gerar + chips alterar). QuickReplyChips com commit fill/send e ComposerController. Extração multi-slot no prompt. REVERIFICAR paridade 1:1 com os PDFs reais.

### PR5 — Shell conversacional + prévia + liquid glass
NexoShell (welcome↔active, latch started, selectStage, startViewTransition nativo + fallback CSS + reduced-motion gate). NexoStage/ArtifactBoard/ArtifactFrame/ArtifactThumb (worker react-pdf, lazy, skeleton-forma-final). VolumeFrame híbrido. NexoComposer dock + GlassPanel + NexoOrb. Emenda escopada ao DESIGN.md + tokens --glass-*. Pré-opções do welcome (SuggestionCards). Colapsar SelosPanel em NexoDebugDrawer (env). Tela vira chat-first com slide.

### PR6 — Matriz de erro + multi-disciplina + retest final
NexoIssue bus + RecoveryChips (recovery fechado/determinístico) + narração por IA com fallback por code. Background-pause (visibilitychange, banner, auto-retoma). Guards (capa/volume/memorial). runLightCheck estendido (gap/dup). seloSets por disciplina + builder de volume cruzando disciplinas. NexoLiveAnnouncer + landmarks + foco opt-in. Reverificar paridade com PDFs reais.


## Apêndice C — Perguntas em aberto (precisam do usuário)

1. Gatilho welcome→active: basta o primeiro send de texto, ou jogar PDFs sozinho (antes de qualquer pedido) já deve deslizar a tela? A visão sugere que 'jogar PDFs E pedir montar volume' é o que dispara — confirmar se o anexo puro, sem pedido, mantém o welcome.
2. Persistência: na v1 a sessão é efêmera (base64/Blob em memória, some no reload) e o histórico/retomar-projeto fica para v2. Aceita começar sem persistência, ou retomar-de-onde-parou é requisito de dia 1 (o que exige IndexedDB já na v1)?
3. Prévia de VOLUME: o híbrido proposto (thumbnail visual da capa + mapa estrutural textual 'Capa p.1 · LD p.3-5 · Pranchas p.6-214' + contagem + botão Abrir) é aceitável, ou você espera VER o volume montado inteiro renderizado como frame? Isto muda o custo e o primitivo necessário.
4. Multi-disciplina: na v1, o escritório joga várias disciplinas de uma vez e pede 'montar volume' cruzando todas, ou é uma disciplina por sessão? Se for multi já na v1, o builder de volume cruzado é escopo maior e crítico.
5. Quais navegadores o escritório usa de fato (Chrome/Edge only, ou há Safari/Firefox)? Decide se o slide por View Transitions nativo é o caminho principal ou se o fallback CSS vira o primário.
6. As pré-opções do welcome (primeiro pixel): devem ser sugestões estáticas fixas (ex.: 'Montar volume', 'Gerar LD', 'Auditar memorial', 'Ler pranchas') ou geradas por contexto (ex.: priorizadas se já há PDFs anexados)? E ao clicar, preenchem o composer (editável) ou enviam direto?
7. A leitura de selo continua client-only (pdfjs+canvas, que pausa em aba de background e será tratada com detectar+narrar+auto-retomar na v1), ou você quer investir na migração para Web Worker/servidor já agora para eliminar a pausa de vez?
8. Quando o LibreOffice está off, o ODT sozinho é entregável aceitável no fluxo do escritório (degradação narrada), ou o PDF é obrigatório e a ausência dele deve sempre bloquear a geração?


---

## Apêndice D — Decisões do usuário (perguntas RESOLVIDAS · locked)

1. **Gatilho welcome→active:** o usuário **arrasta os PDFs** e **escolhe o que será feito** (opções contextuais no welcome); a escolha da ação **dispara o slide**. Anexo puro, sem escolher ação, NÃO desliza sozinho.
2. **Prévia de volume:** **híbrido aceito** (thumbnail da capa + mapa estrutural "Capa p.1 · LD p.3-5 · Pranchas p.6-N" + contagem + Abrir).
3. **Multi-disciplina:** **SIM, na v1 — e é o fluxo CENTRAL, não borda.** Projetos pequenos têm 2-3 pranchas por disciplina; o usuário junta VÁRIAS disciplinas de 2-3 pranchas num ÚNICO volume. Volume = capa do volume + POR disciplina (separatriz → LD → pranchas). ⚠️ O builder de volume CRUZANDO disciplinas sobe de prioridade (era PR6): é núcleo do "jogar PDFs → montar volume".
4. **Persistência (decisão do dev):** v1 **EFÊMERA** (estado em memória; some no reload). Persistência/retomar-projeto (IndexedDB) fica pra v2 — prioriza chegar no reflow funcional rápido.
5. **Navegadores:** **Chrome (principal) + Edge + Firefox.** View Transitions nativo é o caminho **primário** (Chrome/Edge); **fallback CSS transform** cobre o Firefox. Reduced-motion sempre respeitado.
6. **Pré-opções do welcome:** **contextuais** (priorizadas se já há PDFs anexados). Ao clicar, **preenchem o composer (editável)** — mantém o controle na conversa/texto, não envia direto.
7. **Leitura de selo:** segue **client-only** (pdfjs+canvas) na v1; pausa em background tratada com detectar+narrar+auto-retomar. Migração p/ Web Worker/servidor fica pra depois.
8. **PDF:** é **sempre o alvo** (praticidade). LibreOffice off = **erro narrado**; ODT sozinho vira **fallback de emergência com aviso claro**, nunca o default silencioso.

---

## Apêndice E — Cards do welcome (locked)

O welcome (dashboard inicial) tem **4 cards de sugestão** (pré-opções contextuais que **preenchem o composer**, não executam):
1. 📦 **Montar volume** — fluxo-mãe: ler selos → capa + separatriz + LD → volume (cruzando disciplinas).
2. 📋 **Gerar LD** — só a lista de documentos.
3. 🏛️ **Gerar capa** — só a capa.
4. 🔍 **Auditar memorial** — memorial contra a obra.

**Conferir** (conferência leve) e **Gerar separatriz** existem, mas **só por texto/dentro do fluxo** — não viram card em destaque.

**Comportamento contextual (decisão #6):** ao soltar PDFs, os cards se re-rotulam/reordenam (ex.: "📦 Montar volume com estes 8 arquivos"; "🔍 Auditar este memorial" se um memorial for detectado). Clicar preenche o composer (editável) → dispara o slide welcome→active.

**Fora do welcome:** só o **composer** (📎 anexar + ⬆️ enviar) e, durante a conversa, os **quick-replies** (pré-respostas da IA: chip fill=preenche / send=envia). Sem sidebar, sem command palette, sem formulários na v1.

---

## Apêndice F — Sidebar esquerda (locked · REVISA a decisão #7 "cromo lateral fora da v1")

**O shell nasce em 3 COLUNAS** (nav esquerda + centro artefatos + chat direita), batendo com as refs Aetheris. A decisão #7 (cromo lateral fora da v1) é **abrandada só para o rail de histórico** — que é chrome esperado, não uma "segunda linguagem" (command palette/ProjectRail com features seguem FORA).

**Abordagem B (escolhida):**
- **Desde o PR5** o layout já é 3 colunas com o rail esquerdo **colapsável** (colapsa no welcome pra dar foco ao chat centralizado).
- Na v1 o rail entra **magro**: **+ Nova conversa** e **⚙️ Config**. Sem histórico ainda.
- O **histórico por data** (Hoje/Ontem/7 dias; cada item = um job: volume/LD/auditoria) chega **logo em seguida (v1.5)**, junto com a **persistência (IndexedDB)** — que sobe de v2 pra v1.5. Isso REVISA parcialmente a decisão #4 (efêmera): efêmera na v1, IndexedDB na v1.5.
- O **slide** welcome→active acontece DENTRO da área principal (centro→direita); o rail fica estável.
- _Depois:_ fixar prefeituras/templates frequentes ("memória do escritório") no rail.

**Impacto no plano:** o PR5 (shell) já monta o grid de 3 colunas + rail colapsável magro. Um **PR5.5** adiciona a persistência (IndexedDB) + o histórico no rail.

---

## Apêndice G — Área de prévia = canvas tipo FigJam (locked · substitui o "ArtifactBoard" da seção 4)

A coluna central (prévia) é uma **tela infinita tipo FigJam**, não uma grade empilhada.

**Motor:** `@xyflow/react` (React Flow) — nova dependência. Frames = **nós**; setas de sequência = **edges**; **pan + zoom** nativos; nós customizados = os `ArtifactFrame` (thumbnail via worker do react-pdf). Tematizar pro dark + liquid glass (nós glass, edges suaves).

**O que mostra:**
- Ordem do volume desenhada com setas: `CAPA → SEPARATRIZ → LD → pranchas`.
- **Multidisciplina** (fluxo central) aparece de graça: `CAPA → [sep A → LD A → pranchas A] → [sep B → LD B → pranchas B] → …`.
- **Invariante Artifact vs Attachment preservada:** as pranchas do usuário viram **UM nó leve** ("16 pranchas", stack), nunca N frames pesados. Só capa/separatriz/LD/volume ganham thumbnail real.
- **Degrada:** flow de 1 artefato (só LD/só capa) = **um frame centralizado**, sem setas. Mesmo componente escala de 1 nó ao volume inteiro.
- **Working→preview:** nós entram como **esqueleto na forma final** e revelam o thumbnail quando cada artefato fica pronto.

**Drag (decisão do usuário): canvas vira EDITOR na v1.5.**
- **v1:** canvas com **auto-layout + pan + zoom + setas**, sem arrastar (read-only).
- **v1.5:** arrastar um frame **REORDENA o volume de verdade** — a nova ordem realimenta os parâmetros de montagem (`assembleVolume`). O canvas passa a ser o editor do volume. (Acopla canvas ↔ params de montagem; por isso depois do read-only estável.)

**Impacto no plano:** o **PR5** monta o canvas React Flow (read-only, nós+edges+pan/zoom, glass) no lugar do ArtifactBoard empilhado. Um **PR (v1.5)** adiciona o drag-to-reorder ligado ao `assembleVolume`. Nova dep `@xyflow/react` a adicionar no PR5.

---

## Apêndice H — Linguagem visual premium (locked; orb 3D ADIADO)

Sessão 2026-07-23 explorou o visual premium via protótipos interativos (companion do brainstorming, em `.superpowers/brainstorm/`, gitignored). Decisões:

- **Linha d'água (glass):** vidro/transparência/motion vivem SÓ no **chrome ambiente** — composer dock, backdrop de modal/overlay, wash do welcome, bolha do assistente como invólucro. **Dado é sempre MATTE** (cards, frames, tabelas, ConfirmationCard) — nunca blur sobre o que se lê. Premium = **precisão + poucos momentos ambientais**, não glass em tudo. Reconcilia com a DESIGN.md ("Calibrated Instrument", que rejeita glassmorphism decorativo): a exceção é escopada ao ambiente.
- **Motion (skill motion-design, personalidade Premium):** eases `power3.out`/`expo.out`, **sem overshoot**, durações 350-600ms. Welcome→active **coreografado**: welcome sai (`power2.in`) → stage entra da esquerda → copilot desliza da direita (contra-movimento) → frames em **stagger <500ms**. Orquestrar com **GSAP timelines** na implementação real. `prefers-reduced-motion` sempre encurta/desliga.
- **Composer glass + dropzone:** composer dock com `backdrop-blur` + **ring teal no foco**; **dropzone visível** ("arraste os PDFs") + **overlay de tela cheia** no dragover; blobs teal ambientais atrás do vidro (pra ele ter o que refratar e *parecer* vidro).
- **Orb-agente — CONCEITO aprovado, EXECUÇÃO ADIADA:** a visão é o orb SER o agente — fica acima, **"fala" a boas-vindas digitando** (typewriter) reagindo a cada caractere, e ao **selecionar vira pó e viaja pro header** (shared-element centro→canto). Reage a hover/seleção, e o mouse faz uma **curva 3D localizada** na borda. **A execução WebGL (partículas/pó/rim/fresnel via Three.js) ficou instável nos protótipos standalone → ADIADA pra sessão futura**, a ser feita com **R3F + r3f-shaders + r3f-postprocessing** (skills já no ambiente), não em HTML cru.
- **v1 = orb SIMPLES:** glow teal estático/CSS (ou `NexoOrb` básico da seção 6), **sem** o sistema de partículas. O orb-3D-de-pó é enhancement pós-v1. Não bloqueia o reflow.
- **Stack de motion/3D real:** GSAP (timelines) + R3F quando o orb voltar. As skills GSAP/Three.js/R3F foram instaladas nesta sessão.
