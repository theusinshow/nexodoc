# Evolução do Orbe — Nexo Core

**Data:** 2026-08-13
**Status:** APROVADO PARA EXECUÇÃO — o mantenedor revisou e aprovou as 10
propostas (O.1–O.10). Executar na ordem da Parte 3, um PR por proposta (ou
pelos agrupamentos indicados).
**Audiência:** Claude Code (execução) e o mantenedor (revisão).
**Relação com outros docs:** complementa `docs/propostas-evolucao-ux-ui.md`
(a proposta 2.23 de lá É a O.2 daqui, agora especificada; a 1.4 de lá —
favicon vivo — ganha insumo da O.1).

## Leis do orbe que valem para TODAS as propostas

Além das leis globais já listadas em `docs/propostas-evolucao-ux-ui.md`
(governança §12: `globals.css` + `DESIGN.md` no mesmo commit etc.), o orbe tem
as suas, de DESIGN.md §6:

- **Um orbe vivo por tela.** As demais instâncias usam as reduções (CSS/SVG).
- **Iridescência só teal→luminous→neutro.** Nunca rust, roxo ou neon — nem no
  estado de erro (ver O.4 para como o erro se expressa sem cor).
- **A esfera não conhece IA/API.** Estados abstratos entram por props;
  `useAgentState` traduz sinais da aplicação. Manter essa fronteira.
- **Movimento só com `prefers-reduced-motion` respeitado** — o orbe congela num
  estado final legível, nunca num piscar de `0.01ms`.
- **Estado novo entra na tabela do §6** (ordem de prioridade + leitura) no
  mesmo commit do código.
- **A bancada (`/bancada-do-orbe`) precisa continuar funcionando** depois de
  cada mudança — é a ferramenta de afinação da marca. Estado novo aparece no
  seletor da bancada sem trabalho extra (a lista `ESTADOS` é derivada do tipo).

## Arquitetura atual (mapa para quem executa)

```
NexoWorkspace.tsx ── sinais reais ──► useAgentState() ──► AgentState
                                            │
NexoCopilot.tsx ◄── agentState/activity/fileCount ──┘
   └─ AgentOrb (DOM: hit-area, hover, press, a11y, fallback)
      └─ AgentOrbCanvas (R3F: câmera 4.25/fov42, dpr 1–1.75, frameloop)
         └─ AgentOrbScene (CORE plano aditivo + GLASS esfera + anéis + satélites)
              uniforms ◄── damping por refs ◄── paramsForState(state, activity)
```

- Estados hoje: `idle hover dragging uploading reading analyzing responding
  complete error` (`agent-orb.types.ts`).
- A máquina (`use-agent-state.ts`) nunca produz `hover` nem `uploading` —
  hover é reação física (prop `hovered`) e upload está coberto por `reading`.
  Ver Faxina (O.9).
- Reduções: `OrbGlow` (CSS, inline em `AgentOrb.tsx` — fallback e placeholder),
  `NexoOrb.tsx` (CSS, **sem nenhum uso no app** — só `ARQUITETURA.md` o cita),
  `logo-nexo.tsx` (SVG, 4 variantes, sendo 3 aposentadas pela decisão do §6).
- Afinação: `CORES_DO_ORBE` e `VIDRO_DO_ORBE` em `AgentOrbScene.tsx`; a bancada
  injeta overrides por props (`cores`, `vidro`, `ajuste`).

---

# Parte 1 — Diagnóstico (o que a revisão encontrou)

1. **O orbe não sabe da auditoria.** `NexoCopilot.tsx` lê
   `useAuditoria().emCurso` apenas para o rótulo de texto ("auditando o
   memorial"); o `agentState` visual continua vindo só do turno de chat. Na
   tarefa mais longa do produto, a esfera diz "pronto" enquanto o texto diz
   "auditando". → O.1.
2. **A máquina não tem como dizer "a bola é com você".** Nenhum estado cobre
   "agente perguntou, humano não respondeu". → O.2.
3. **O progresso da leitura é textura, não medida.** `reading` dirige o scan
   pelo progresso (`scan: 0.35 + a·0.65`), mas uma banda que sobe e desce não
   comunica "quanto falta". → O.3.
4. **O erro só treme.** `jitter` por 2,2s e nada mais; sem assinatura de ritmo.
   → O.4.
5. **A entrada do produto mostra uma foto da alma, não a alma.** Login usa o
   SVG estático. → O.6.
6. **Verdade duplicada e morta:** `NexoOrb.tsx` sem uso; `OrbGlow` inline como
   segunda redução CSS; 4 variantes de logo onde a lei manda 1; estados
   inalcançáveis no enum (`hover`, `uploading`). → O.9.
7. **A bancada ajusta mas não registra.** Valor afinado no olho que não vira
   changelog é a "verdade duplicada" que o §12 pune. → O.10.

---

# Parte 2 — As 10 propostas

## O.1 — O orbe aprende a auditar

- **O quê:** novo estado `auditing` na máquina e no visual: a banda de scan
  percorre o vidro **numa direção só, em ciclo longo** (varredura de
  capítulos), com rotação firme baixa — distinguível de um turno de chat de
  segundos.
- **Por quê:** fecha o furo nº 1 do diagnóstico. A cara do agente não pode
  discordar do rótulo embaixo dele.
- **Onde mora:**
  - `agent-orb.types.ts`: adicionar `"auditing"` ao `AgentState` e ao
    `paramsForState`. Alvo sugerido: `distortion 0.09, pulse 0.4, rim 0.78,
    scan 1, spin 0.3, jitter 0` — afinar na bancada.
  - `agent-orb.shaders.ts` (surface fragment): hoje `scanY = sin(uTime·0.55)`.
    Adicionar `uniform float uScanMode` (0 = senoidal, 1 = contínuo); no modo 1,
    `scanY = mod(uTime * 0.35, 2.2) - 1.1` (sobe sempre, some no topo, recomeça
    embaixo). O uniform recebe `1` quando `state === "auditing"`.
  - `use-agent-state.ts`: novo sinal `auditing?: boolean` em `AgentSignals`.
    **Prioridade:** `error > dragging > reading > responding > analyzing >
    auditing > complete > idle` — um turno de chat ao vivo vence a auditoria
    em segundo plano (o palco já a mostra).
  - `NexoWorkspace.tsx`: ligar `useAuditoria().emCurso` no sinal (confirmar o
    ponto exato onde `useAgentState` é chamado).
  - `NexoCopilot.tsx`: **remover o remendo do rótulo** (o `auditando` que hoje
    só troca o texto) — o estado agora carrega a informação. `STATE_LABEL`
    (`AgentOrb.tsx`) e `STATE_UI` (`AgentStatusPopover.tsx`): "Auditando".
  - `DESIGN.md` §6: linha nova na tabela de estados.
- **Aceite:** com auditoria em curso e chat parado, o orbe varre numa direção
  só e o rótulo diz "auditando"; um turno de chat durante a auditoria assume o
  orbe e, ao terminar, o orbe volta à varredura; bancada lista `auditing`.

## O.2 — O estado "aguardando você"

- **O quê:** novo estado `waiting`: respiro longo e lento (~8s contra os ~4s do
  idle), rim levemente acima do idle. Sai ao primeiro caractere no composer.
- **Por quê:** metade dos turnos deste produto termina com o agente esperando
  decisão humana (princípio 2: pergunta decisões). O orbe só fala do próprio
  trabalho; falta falar da espera.
- **Onde mora:**
  - `agent-orb.types.ts`: `"waiting"` no `AgentState`; alvo
    `distortion 0.05, pulse 0.22, rim 0.62, scan 0, spin 0.12, jitter 0`.
  - `AgentOrbScene.tsx`: o respiro hoje é fixo (`sin(time·1.5)`). Promover a
    taxa a `OrbVisualParams.breathRate` (padrão 1.5; `waiting` usa ~0.75),
    amortecida como os demais params.
  - `use-agent-state.ts`: sinal `waiting?: boolean`. Prioridade: acima de
    `idle`, abaixo de `complete`.
  - Derivação do sinal (em `NexoWorkspace.tsx` ou num hook novo): última
    mensagem do assistente contém pergunta/chips/cartão em estado *proposta*
    E composer vazio E nada em curso, **por ≥6s contínuos**. O sinal cai no
    primeiro caractere digitado (o `composer-controller.tsx` precisa expor
    "tem texto" — verificar o que já existe lá).
  - `STATE_LABEL`: "Aguardando você"; `STATE_UI`: tom `idle`, sem pulso de
    trabalho (a espera não é trabalho — o respiro do orbe já a comunica).
  - `DESIGN.md` §6: linha nova + nota de que `breathRate` entrou nos params.
- **Aceite:** pergunta do agente sem resposta por 6s → respiro lento; digitar
  qualquer caractere → volta ao estado real em um ciclo; nunca aparece durante
  trabalho em curso; reduced-motion congela legível.

## O.3 — Progresso de leitura no aro

- **O quê:** durante `reading`, um arco de 1px no aro do vidro fecha 360°
  conforme `activity` avança — o vidro vira instrumento de progresso sem
  número na tela (o popover já dá o número).
- **Onde mora:** `AgentOrbScene.tsx`.
  - Nova malha `progressRing`: `ringGeometry` de raio ~1.14–1.17 (cabendo no
    quadro de ±1.63 com folga), `thetaStart = Math.PI/2` (começa no topo).
    **Implementação do arco sem shader e sem recriar geometria:**
    `geometry.setDrawRange(0, Math.floor(frac * indexCount))` — o índice do
    ring é construído em sequência angular, então o recorte é um arco
    contíguo crescente. `frac = activity` amortecido.
  - `meshBasicMaterial` em `RIM_COLOR`, aditivo, opacidade amortecida
    (0.8 visível só em `reading`; 0 nos demais estados).
  - **Fora do `tiltRef`** (anéis são sinais de estado e ficam de frente —
    mesma regra dos anéis existentes).
  - Ao concluir (`complete`), o arco dá fade rápido; o pulso de conclusão já
    existente marca o instante.
- **Notas:** não reutilizar o `ringMatRef` do drop-target — malha separada,
  raio diferente, significado diferente. Escopo: só `reading` (uploading já
  está coberto por reading na prática).
- **Aceite:** lendo 23 pranchas, o arco fecha suavemente até o fim; com
  `activity` em 0, nenhum arco; em qualquer outro estado, nenhum arco; 200
  folhas não mudam o comportamento (o arco é fração, não contagem).

## O.4 — Erro com assinatura de ritmo

- **O quê:** durante `error`, o pulso do miolo vira **batimento duplo
  irregular** (duas contrações rápidas + pausa), somado ao `jitter` já
  existente. Sem tocar na cor.
- **Por quê:** "algo errado" se lê por ritmo instintivamente; 2,2s de tremor
  genérico não distinguem erro de esforço. E a lei §6 proíbe tirar o orbe da
  rampa teal — logo, a expressão do erro tem de ser temporal, não cromática.
  (Alternativa de tingir o aro de coral foi **rejeitada**: cor de sinal em
  elemento interativo e quebra da iridescência teal.)
- **Onde mora:** `AgentOrbScene.tsx`, no `useFrame`: quando
  `state === "error"`, substituir o `uPulse` amortecido por uma função de
  batimento, ex.: `beat(t) = g(t%1.6, 0.00) + 0.7·g(t%1.6, 0.18)` com
  `g = exp(-((x-c)/w)²)`, `w≈0.09`. Comentário obrigatório registrando a
  escolha (padrão deste arquivo: a falha que motiva a decisão).
- **Aceite:** erro é distinguível de `analyzing` a 3 metros sem ler rótulo;
  nenhuma cor nova; passados os 2,2s do transiente, estabiliza em idle como
  hoje.

## O.5 — Boot: o instrumento liga

- **O quê:** uma vez por carregamento da sessão, na montagem do orbe: miolo
  acende de 0 (~600ms), rim sobe com ~150ms de atraso, `spin` nasce alto
  (~1.2) e assenta no alvo — um "power on" de instrumento.
- **Onde mora:** `AgentOrbScene.tsx`: `bootRef` 0→1 amortecido multiplicando
  `uPulse`/`uRim` e somando no `spin` inicial; flag de módulo
  (`let booted = false`) para tocar **uma vez por carregamento** (remontagens
  dentro da sessão não re-bootam; F5 re-boota — correto).
- **Notas:** reduced-motion corta direto para o estado final (o gate de
  `reduced` já zera damping — garantir que zera o boot também). Sem som, sem
  atraso de interação: o boot não bloqueia clique nem compositor.
- **Aceite:** primeira montagem da sessão toca a sequência; navegar entre
  telas não re-toca; F5 re-toca; reduced-motion não vê animação nenhuma.

## O.6 — O orbe vivo no login

- **O quê:** `AgentOrb` (compacto) respirando em `idle` ao lado do formulário
  de login, no lugar do SVG estático a 48px. O SVG continua como favicon e
  nos lugares estáticos.
- **Por quê:** a porta de entrada do produto mostra a alma acesa, não uma foto
  dela. §6 já prevê o 3D em "Palco / **entrada**" — o login É a entrada.
- **Onde mora:** `app/login/page.tsx`. O `dynamic(ssr:false)` dentro de
  `AgentOrb` já resolve SSR; `OrbGlow` cobre o carregamento; sem WebGL cai no
  mesmo fallback. `interactive={false}` (nada para ativar aqui).
- **Notas:** um orbe vivo por tela — o login não tem outro. O boot (O.5) toca
  aqui se for a primeira montagem da sessão: ótimo. Verificar contraste do
  glow sobre o fundo do login (o §6 já documenta a armadilha "esfera escura
  some no fundo escuro" — o aro do vidro é o que segura a silhueta).
- **Aceite:** login mostra o orbe respirando; sem WebGL ou reduced-motion,
  mostra o glow estático; nenhum layout shift quando o Canvas termina de
  carregar (a caixa já reserva o tamanho).

## O.7 — O orbe ouve a digitação

- **O quê:** composer focado → `rim` sobe sutilmente (+0.1, mais discreto que
  o +0.18 do hover). O agente "prestando atenção" enquanto você escreve.
- **Onde mora:** mais um input amortecido em `AgentOrbScene` (`listenRef`),
  no mesmo padrão de `hovered`. O fio: `composer-controller.tsx` precisa
  expor `isFocused` (verificar — `composer.focus()` existe, então o controle
  do campo já mora ali) → `NexoCopilot` → `AgentOrb` → `AgentOrbCanvas` →
  `AgentOrbScene`.
- **Aceite:** focar o composer levanta o rim; desfocar, recua; combina com
  hover sem dobrar o efeito (soma limitada, como já é feito com `h`).

## O.8 — Chegada de documento com cerimônia mínima

- **O quê:** o satélite recém-nascido assenta com um overshoot de escala
  (~18%, ~300ms). Nascimentos em rajada (>3 de uma vez) não fazem overshoot —
  senão vira pisca-pisca.
- **Onde mora:** loop dos satélites em `AgentOrbScene.tsx`: registrar
  `birthAt[i]` quando `satScale` sai de 0;
  `scale = s · (1 + 0.18·sin(min(1, (t-birthAt)/0.35)·π))`. Guardar o
  `fileCount` anterior para detectar rajada.
- **Aceite:** uma folha chegando sozinha é visivelmente "recebida"; um lote
  de 50 chega sem fogos; nenhum satélite pisca com opacidade cheia antes de
  crescer (regra já existente se mantém).

## O.9 — Faxina de identidade (código alinhado com a lei)

- **O quê (quatro cortes, um PR):**
  1. **Apagar `NexoOrb.tsx`** — zero usos no app (confirmado por grep; só
     `docs/ui-references/ARQUITETURA.md` o cita — atualizar a linha).
  2. **Canonizar a redução CSS:** extrair `OrbGlow` de `AgentOrb.tsx` para
     `agent-orb/OrbGlow.tsx`, exportado pelo `index.ts`. É ela a redução CSS
     oficial a partir de agora (bolhas, marca inline — onde o §6 manda).
     Aplicar nas bolhas do assistente fica como fase 2, fora deste PR.
  3. **Remover as variantes aposentadas do logo:** `node`, `minimal-vortex` e
     `fluid-siri` saem de `logo-nexo.tsx`; junto com elas a seção
     "Siri-Orb/LogoShowcase" da bancada e o CSS órfão em `globals.css`
     (`.nexo-logo__no`, `__vortex-tri`, `__star-pinch`, `__scan-line`,
     `@keyframes nexo-logo-giro`). Confirmar que todos os usos atuais são
     `orb-static` (verificado: login, sem-acesso, sidebar — todos default).
     Se `interativa`/`animated` ficarem sem função após o corte, remover as
     props também.
  4. **Limpar o enum:** remover `hover` e `uploading` de `AgentState` e dos
     mapas (`STATE_LABEL`, `STATE_UI`, `paramsForState`, lista `ESTADOS` da
     bancada). `hover` é reação física (prop), `uploading` é `reading` —
     documentar a decisão num comentário em `agent-orb.types.ts`.
- **Por quê:** o §6 decidiu a identidade; o código ainda carrega o processo
  de decisão. Três degraus reais, um só objeto.
- **Aceite:** build e lint limpos; nenhuma referência às variantes/estados
  removidos; bancada funcionando sem a seção do logo; `ARQUITETURA.md` sem a
  citação ao `NexoOrb`.

## O.10 — A bancada escreve o changelog

- **O quê:** o botão "Copiar valores" passa a incluir um bloco pronto para
  colar no `DESIGN.md` §6: data, valores de `CORES_DO_ORBE`/`VIDRO_DO_ORBE`,
  parâmetros afinados (se modo manual) e uma linha "motivo:" a preencher.
- **Onde mora:** `app/bancada-do-orbe/bancada.tsx`, função `copiar`.
- **Aceite:** copiar na bancada gera snippet de código + bloco de changelog
  datado; o mantenedor preenche o motivo e cola — afinação nunca mais fica
  só na cabeça de quem ajustou.

---

# Parte 3 — Ordem de execução e agrupamento

| # | Proposta(s) | Por quê nesta ordem |
|---|-------------|---------------------|
| 1 | **O.9** | Faxina primeiro: remove degrau morto, enum mentiroso e variantes aposentadas. Tudo que vem depois nasce sobre base limpa. Risco baixíssimo. |
| 2 | **O.1** | O furo real: a tarefa mais longa do produto invisível na cara do agente. Toca máquina de estados, shader, Copilot e §6. |
| 3 | **O.2** | Mesmo território da O.1 (máquina, types, labels, §6) — sai barato logo em sequência. |
| 4 | **O.3** | Só `AgentOrbScene.tsx`; a melhoria visual mais "instrumento" do pacote. |
| 5 | **O.4** | Só `useFrame`; independente. |
| 6 | **O.5 + O.6** | Boot e login se completam: a primeira montagem da sessão passa a ser na porta de entrada. |
| 7 | **O.7** | Depende de expor `isFocused` no composer-controller; pequeno. |
| 8 | **O.8** | Polimento; independente. |
| 9 | **O.10** | Quando as afinações das anteriores estiverem decididas, a bancada já registra. |

**Sequências obrigatórias:** O.1 antes de O.2 (ambas tocam a tabela de
prioridade da máquina — fazer juntas ou nesta ordem). O.9 antes de qualquer
nova variante de redução.

**Verificação global de cada PR:** build + lint limpos; bancada abre e o
estado novo aparece no seletor; reduced-motion congela legível; sem WebGL cai
no `OrbGlow`; `DESIGN.md` atualizado no mesmo commit quando a tabela do §6
muda.

## O que este documento NÃO propõe

- Nenhuma cor fora da rampa teal no orbe — inclusive no erro (O.4 resolve por
  ritmo).
- Nenhum segundo orbe vivo na mesma tela (O.6 respeita a regra: o login não
  tem outro).
- Nenhuma mudança na máquina de damping por refs, no carregamento dinâmico do
  Canvas ou na fronteira "a esfera não conhece IA/API" — essas decisões estão
  certas e ficam como estão.
- Nada de partículas/pó em volta do orbe (o apêndice H adiou para pós-v1 e
  este documento não reabre).
