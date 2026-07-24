# Refatoração da UI do chat do Nexo

**Data:** 2026-07-24
**Escopo:** Redesenhar a UI conversacional do Nexo. Direção aprovada via mockup
interativo. Camada de dados (conversation-store, motor) intocada — é reestilização
+ reposicionamento + alguns comportamentos novos (streaming-feel, busca/pastas,
multimodal).

## Direção aprovada (mockup)

**"O instrumento e seu operador".** A "linha d'água" do DESIGN.md (emenda Liquid
Glass): **vidro é privilégio do agente**, dados são matte.
- **Vidro** (translúcido + blur + edge): orb, bolha do assistente (`nexo-glass--weak`),
  composer (`nexo-composer`), welcome wash. A presença viva do Nexo.
- **Matte** (sólido, borda 1px sutil ou só camada tonal): sidebar, cards de
  proposta, bolha do usuário, canvas. Leitura sustentada.
- **Preto-forward, verde mínimo**: separação por CAMADA TONAL, não por borda
  gritante. Teal só onde é AÇÃO PRIMÁRIA (enviar, "Confirmar e gerar"). Fatos se
  destacam por mono+peso, não por cor. **Zero side-stripe** (proibido — foi o
  "AI slop" que o usuário pegou na conversa ativa).

**Orb**: a orb REAL (R3F, 5 fases, aprovada — [[nexodoc-reflow-progress]]) fica
INTOCADA. A refatoração só a REPOSICIONA:
- Welcome: centralizada grande (soltar PDFs) — comportamento de ontem, mantido.
- Ativo: encolhe (resize hero↔compact existente) e vira **presença viva única no
  TOPO** do chat (header). NÃO repetir orb por mensagem (decisão do usuário).

**Layout**: o ativo deixa de ser 3-col (sidebar|canvas|dock). Vira **chat
protagonista**: `sidebar | chat centrado`. O canvas (mapa FigJam do volume) vira
**painel sob demanda** (toggle no chat), não mais o centro sempre-ligado.

## Fases (cada uma commit verde: tsc + eslint + build)

### Fase 1 — Fundação visual (glass/matte, preto-forward, respiro)
- `globals.css` + classes: garantir vidro só no chrome do agente; reduzir verde;
  bolha do assistente = glass-weak, do usuário = recessed matte; espaçamento e
  largura de leitura (thread central ~720px); bordas discretas / camada tonal.
- Shell: `--active` vira `sidebar | 1fr` (chat centrado), canvas fora do centro.
  Orb no topo do chat (compact) como presença viva.
- `NexoChat`/`NexoCopilot`/`NexoComposer`/`NexoSidebar` reestilizados p/ o mockup.

### Fase 2 — Orb pensando + reveal de texto (streaming-feel)
- Header do chat: orb (compact) + status ("pensando…") ligado ao `agentState`
  (já existe o sinal). O "pensando" É o orb (respira/halo — já na orb real).
- Reveal progressivo do `reply` do assistente ao chegar (typewriter suave, só
  `opacity`/texto, respeita `prefers-reduced-motion`). Hook isolado
  `useRevealText`. Não toca no backend (agente segue single-shot).

### Fase 3 — Ações rápidas refinadas
- `QuickReplyChips` reestilizado (chips do mockup). Ações rápidas CONTEXTUAIS
  abaixo da resposta derivadas das propostas/próximos passos (ex.: após LD →
  "Gerar a capa", "Conferir", "Montar volume"). Determinístico, sem IA nova.

### Fase 4 — Sidebar inteligente (busca + pastas)
- Busca: filtro client-side por título sobre `conversations`.
- Pastas: agrupar conversas por OBRA/código (derivado dos selos, natural do
  domínio) — grupos recolhíveis (`<details>`), + "Sem pasta". Campo `folderKey`
  no `StoredConversation` (código da obra). Sem CRUD manual de pastas na v1.

### Fase 5 — Multimodal (imagem + preview imediato)
- Composer/drop aceitam IMAGEM além de PDF; preview imediato (miniatura da imagem
  / ícone do PDF) no composer, removível.
- Roteamento: imagem de carimbo é candidata ao OCR de selo (best-effort, reusa a
  rota de extract-stamp que já recebe imagem); senão fica anexada ao contexto.
  Escopo mínimo garantido: **anexar + preview**; o "agente lê a imagem" é
  best-effort/afinado na implementação.

## Fora de escopo
Modificar a orb (fechada). Tema claro (o Nexo é instrumento escuro, decisão).
CRUD manual de pastas. Streaming real de token (backend).

## Verificação
Cada fase: `tsc` + `eslint` + `next build` verdes; commit direto na main. E2E
visual ao vivo pelo usuário.
