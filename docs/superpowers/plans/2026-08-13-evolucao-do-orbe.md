# Evolução do orbe — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o Nexo Core de dez estados afinados no olho a um instrumento que sabe auditar, sabe esperar por você, mede a leitura no próprio aro e liga como equipamento — sem tirar um pixel da rampa teal e sem quebrar a fronteira "a esfera não conhece IA/API".

**Architecture:** Nada muda na espinha: `useAgentState` traduz sinais da aplicação em `AgentState`, `paramsForState` dá os alvos, o `useFrame` amortece atual→alvo por refs (zero re-render). As dez propostas entram por três portas já existentes — um estado novo no enum + linha em `paramsForState` (O.1, O.2), um uniform novo no shader de superfície (O.1), e uma malha ou um ref novo no `AgentOrbScene` (O.3, O.4, O.5, O.8). A única fiação nova fora do orbe é o foco do composer (O.7), e ela nasce como assinatura separada para não quebrar a fachada estável do `composer-controller`.

**Tech Stack:** React 19 + React Compiler (proíbe `setState` síncrono no corpo de efeito), `@react-three/fiber` 9, `@react-three/drei` (`shaderMaterial`), three.js, GLSL inline, Playwright 1.61 para a prova em PNG.

**Spec:** `docs/propostas-orbe.md` (O.1–O.10, aprovado pelo mantenedor em 2026-08-13)

## Global Constraints

- **Um orbe vivo por tela.** As demais instâncias usam as reduções (CSS/SVG).
- **Iridescência só teal→luminous→neutro.** Nunca rust, roxo ou neon — nem no
  erro. É por isso que a O.4 é ritmo, não cor.
- **A esfera não conhece IA/API.** Estado abstrato entra por prop;
  `useAgentState` é a única tradutora.
- **`prefers-reduced-motion` congela num estado final legível**, nunca num
  piscar de `0.01ms`. Toda animação nova checa `reduced` **antes** de existir.
- **Zero re-render por quadro.** Valor que muda a cada frame mora em `useRef` e
  é escrito dentro do `useFrame`. Nada de `useState` no laço.
- **Estado novo entra na tabela do `DESIGN.md` §6** (prioridade + leitura) no
  mesmo commit do código.
- **A bancada (`/bancada-do-orbe`) tem de continuar abrindo** depois de cada
  tarefa — é a ferramenta de afinação da marca.
- **Prova em imagem obrigatória.** `node scripts/shot-orbe-parado.mjs
  --estado=<novo>` com o `npm run dev` de pé; o PNG vai para o scratchpad e
  entra na conversa. Estado que não rende PNG não está pronto.
- Commits direto na branch atual. Nunca `git add -A`.

### Cinco achados do código que corrigem a spec

| # | a spec diz | o código diz | o que o plano faz |
|---|---|---|---|
| 1 | "o `agentState` visual continua vindo só do turno de chat… a esfera diz *pronto* enquanto o texto diz *auditando*" | `NexoWorkspace.tsx:1331` **já** injeta `auditandoAgora` em `thinking`, com comentário dizendo exatamente isso. Hoje a esfera fica em `analyzing` durante a auditoria | O.1 continua valendo, mas como **assinatura distinta** (varredura de capítulo × pensar de segundos), não como conserto de silêncio. O texto do commit não pode dizer que a esfera estava parada |
| 2 | O.3: "raio ~1.14–1.17 (cabendo no quadro de ±1.63)" | o quadro **é** ±1,63 (câmera 4,25 / fov 42), mas dois comentários em `AgentOrbScene.tsx:398-399,434` ainda dizem ±1,42 — sobraram do recuo anterior | O.3 usa 1,14–1,17 (a spec está certa) e corrige os dois comentários de passagem |
| 3 | "estado novo aparece no seletor da bancada sem trabalho extra (a lista `ESTADOS` é derivada do tipo)" | `bancada.tsx:21-31` é uma **lista literal escrita à mão** | A O.9 passa a lista a derivar de um `AGENT_STATES` exportado do types, e aí a promessa vira verdade para O.1 e O.2 |
| 4 | O.7: "`composer-controller.tsx` precisa expor `isFocused`" | o controller expõe `fill`/`send`/`focus` numa **fachada deliberadamente estável** (`useMemo` sem deps) para que os chips nunca re-renderizem | `isFocused` **não** pode entrar em `ComposerControls`: mataria a estabilidade. Entra como assinatura separada (`useComposerFoco`), com contexto próprio |
| 5 | — | `scripts/shot-orbe-parado.mjs:19` lista os estados válidos num comentário de cabeçalho | toda tarefa que mexe no enum atualiza essa linha, senão a ferramenta de prova mente |

## File Structure

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `agent-orb.types.ts` | enum, `AGENT_STATES`, `paramsForState`, `breathRate` | 1, 2, 3 |
| `use-agent-state.ts` | sinais → estado, tabela de prioridade | 2, 3 |
| `agent-orb.shaders.ts` | `uScanMode` (varredura contínua) | 2 |
| `AgentOrbScene.tsx` | anel de progresso, batimento do erro, boot, overshoot do satélite | 4, 5, 6, 9 |
| `AgentOrb.tsx` · `AgentStatusPopover.tsx` | rótulos dos estados novos; `OrbGlow` sai para arquivo | 1, 2, 3 |
| `agent-orb/OrbGlow.tsx` | a redução CSS canônica | 1 |
| `NexoWorkspace.tsx` · `NexoCopilot.tsx` | fiação dos sinais `auditing` e `waiting` | 2, 3 |
| `state/composer-controller.tsx` | `useComposerFoco` (assinatura separada) | 8 |
| `components/brand/logo-nexo.tsx` · `globals.css` | corte das 3 variantes aposentadas | 1 |
| `app/bancada-do-orbe/bancada.tsx` | lista derivada; changelog no copiar | 1, 10 |
| `DESIGN.md` §6 | tabela de estados, `breathRate`, decisões | 1–6 |

---

### Task 1: A faxina (O.9) — o código alinha com a lei

Primeiro porque tudo o que vem depois nasce sobre isto: enum sem estado
inalcançável, uma redução CSS só, um logo só, e a lista da bancada derivada do
tipo (achado nº 3).

**Files:**
- Delete: `modules/nexo/components/NexoOrb.tsx`
- Create: `modules/nexo/components/agent-orb/OrbGlow.tsx`
- Modify: `agent-orb.types.ts`, `AgentOrb.tsx`, `AgentStatusPopover.tsx`, `agent-orb/index.ts`, `app/bancada-do-orbe/bancada.tsx`, `components/brand/logo-nexo.tsx`, `app/globals.css`, `docs/ui-references/ARQUITETURA.md`, `scripts/shot-orbe-parado.mjs`

**Interfaces:**
- Produces: `AGENT_STATES: readonly AgentState[]` (fonte única da lista, usada
  pela bancada e pelas tarefas 2 e 3); `OrbGlow` exportado por `index.ts`.
- `AgentState` perde `"hover"` e `"uploading"`.

- [ ] **Step 1: Confirmar que os cortes são seguros**

```bash
grep -rn "NexoOrb" --include="*.tsx" --include="*.ts" app components modules
grep -rn "\"hover\"\|'hover'\|uploading" --include="*.tsx" --include="*.ts" app components modules
grep -rn "minimal-vortex\|fluid-siri\|variant=\"node\"" --include="*.tsx" app components modules
```

Expected: `NexoOrb` só em `modules/nexo/components/NexoOrb.tsx` e em
`docs/ui-references/ARQUITETURA.md`. `uploading` em `agent-orb.types.ts`,
`AgentOrb.tsx`, `AgentStatusPopover.tsx`, `NexoCopilot.tsx` (duas condições de
rótulo) e `bancada.tsx`. As três variantes de logo só na própria
`logo-nexo.tsx` e na bancada.

Se algum uso real aparecer fora dessa lista, **pare** e reporte — a faxina
supõe que não há.

- [ ] **Step 2: Apagar o degrau morto e canonizar a redução CSS**

```bash
git rm modules/nexo/components/NexoOrb.tsx
```

Crie `modules/nexo/components/agent-orb/OrbGlow.tsx` com o corpo que hoje está
inline em `AgentOrb.tsx:60-73`, e um docblock que registre a promoção:

```tsx
"use client";

/**
 * A REDUÇÃO EM CSS do orbe (DESIGN.md §6, degrau do meio da escada).
 *
 * Nasceu inline no `AgentOrb` como fallback (sem WebGL) e placeholder (enquanto
 * o Canvas carrega), e havia um SEGUNDO gradiente radial em `NexoOrb.tsx`
 * fazendo a mesma coisa para ninguém — dois desenhos do mesmo objeto é como a
 * identidade se perde: um deles é afinado, o outro não, e ninguém sabe qual
 * está na tela. O `NexoOrb` foi apagado; este é o degrau CSS oficial.
 *
 * Zero custo: nenhum three.js, nenhum shader. É o que permite pô-lo onde o §6
 * manda (bolhas, marca inline) sem multiplicar orbe vivo.
 */
export function OrbGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-[16%] rounded-full"
      style={{
        background:
          "radial-gradient(circle at 40% 35%, #5bdac6 0%, #00a693 46%, color-mix(in srgb, #00a693 24%, transparent) 70%, transparent 100%)",
        boxShadow: "0 0 24px color-mix(in srgb, #00a693 40%, transparent)",
      }}
    />
  );
}
```

Em `AgentOrb.tsx`: apague a função local e importe `{ OrbGlow } from "./OrbGlow"`.
Em `agent-orb/index.ts`: `export { OrbGlow } from "./OrbGlow";`.
Em `docs/ui-references/ARQUITETURA.md`: as três linhas que citam `<NexoOrb>`
passam a citar `OrbGlow` (redução CSS) ou `AgentOrb` (orbe vivo), conforme o
contexto de cada uma.

- [ ] **Step 3: Limpar o enum e derivar a lista**

Em `agent-orb.types.ts`, o enum perde dois estados e ganha a lista canônica:

```ts
/**
 * Os estados VISUAIS do agente.
 *
 * `hover` e `uploading` saíram daqui. `hover` era um estado que a máquina nunca
 * produzia: passar o mouse é reação FÍSICA, entra por `hovered` e é amortecida
 * no Scene — tê-lo no enum permitia aplicar o realce em dobro. `uploading`
 * nunca teve sinal próprio: enviar e ler acontecem no mesmo gesto, e o que o
 * usuário vê é a leitura. Estado inalcançável no enum é promessa que o produto
 * não cumpre, e a bancada os oferecia no seletor como se existissem.
 */
export type AgentState =
  | "idle"
  | "dragging"
  | "reading"
  | "analyzing"
  | "responding"
  | "complete"
  | "error";

/**
 * A lista, na ordem de prioridade da máquina. É a FONTE ÚNICA: a bancada monta
 * o seletor a partir daqui, e por isso um estado novo aparece lá sem trabalho
 * extra. Antes era uma lista escrita à mão em `bancada.tsx`, e ela já divergia.
 */
export const AGENT_STATES: readonly AgentState[] = [
  "error",
  "dragging",
  "reading",
  "responding",
  "analyzing",
  "complete",
  "idle",
] as const;
```

Remova os `case "hover"` e `case "uploading"` de `paramsForState`.

Em `AgentOrb.tsx` (`STATE_LABEL`) e `AgentStatusPopover.tsx` (`STATE_UI`):
remova as duas chaves. O `Record<AgentState, …>` faz o TypeScript apontar
qualquer sobra.

Em `NexoCopilot.tsx`, as duas condições que citam `"uploading"`
(`working` e `statusLabel`) perdem o termo — `reading` já cobre.

Em `bancada.tsx`, troque a lista literal (L21-31) por
`import { AGENT_STATES } from "@/modules/nexo/components/agent-orb/agent-orb.types"`
e use `AGENT_STATES` no `map` do seletor.

Em `scripts/shot-orbe-parado.mjs:19`, a linha de comentário
`// Estados: idle hover dragging uploading reading …` passa a listar os sete.

- [ ] **Step 4: Cortar as variantes aposentadas do logo**

Em `components/brand/logo-nexo.tsx`: `variant` passa a aceitar só
`"orb-static"`; os ramos `minimal-vortex`, `fluid-siri` e `node` saem, junto com
o que só eles usavam. Se `interativa`/`animated` ficarem sem leitor, remova as
props (o TypeScript aponta os chamadores).

Em `app/globals.css`: apague `.nexo-logo__no`, `.nexo-logo__vortex-tri`,
`.nexo-logo__star-pinch`, `.nexo-logo__scan-line` e
`@keyframes nexo-logo-giro`. Confirme antes que nenhuma sobreviveu a um uso:

```bash
grep -rn "nexo-logo__" --include="*.tsx" --include="*.ts" app components modules
```

Na bancada, remova a seção "Siri-Orb / LogoShowcase".

- [ ] **Step 5: Provar**

```bash
npm run lint && npx tsc --noEmit
```
Expected: limpos. Erro de `Record<AgentState, …>` incompleto aqui significa que
um mapa ficou com chave a mais — é o TypeScript fazendo o trabalho.

Com `npm run dev` de pé, abra `/bancada-do-orbe`: o seletor mostra **sete**
estados e a seção do logo sumiu.

- [ ] **Step 6: Commit**

```bash
git add -A modules/nexo/components/agent-orb app/bancada-do-orbe components/brand/logo-nexo.tsx app/globals.css docs/ui-references/ARQUITETURA.md scripts/shot-orbe-parado.mjs modules/nexo/components/NexoOrb.tsx modules/nexo/components/NexoCopilot.tsx
git commit -m "orbe: o codigo passa a ter os mesmos degraus que a lei descreve"
```

---

### Task 2: O orbe aprende a auditar (O.1)

**Files:** `agent-orb.types.ts`, `agent-orb.shaders.ts`, `AgentOrbScene.tsx`, `use-agent-state.ts`, `NexoWorkspace.tsx:1326`, `NexoCopilot.tsx`, `AgentOrb.tsx`, `AgentStatusPopover.tsx`, `DESIGN.md` §6

**Interfaces:**
- Consumes: `AGENT_STATES` (Tarefa 1).
- Produces: `AgentState` ganha `"auditing"`; `AgentSignals` ganha
  `auditing?: boolean`; o uniform `uScanMode` existe no material de superfície.

- [ ] **Step 1: O estado e os alvos**

Em `agent-orb.types.ts`: `"auditing"` no enum, e em `AGENT_STATES` **entre
`analyzing` e `complete`** (a ordem da lista é a da prioridade). Em
`paramsForState`:

```ts
    /*
     * AUDITAR não é PENSAR, e a diferença tem de estar na cara.
     *
     * A auditoria já movia o orbe — `NexoWorkspace` injeta `auditandoAgora` em
     * `thinking` desde que alguém notou que a esfera dizia "pronto" durante seis
     * minutos de análise. Só que ela o movia com o vocabulário do chat:
     * `analyzing`, que é a cara de um turno de segundos. Seis minutos naquele
     * ritmo lê como travamento.
     *
     * Aqui a distorção é BAIXA e o giro é FIRME: a esfera não se agita, ela
     * percorre. Quem dá a leitura é a varredura contínua (uScanMode = 1).
     */
    case "auditing":
      return { distortion: 0.09, pulse: 0.4, rim: 0.78, scan: 1, spin: 0.3, jitter: 0 };
```

- [ ] **Step 2: A varredura que sobe sempre**

Em `agent-orb.shaders.ts`, no fragment de superfície, declare o uniform junto
dos outros (`uniform float uScanMode;`) e troque a linha 192:

```glsl
  /*
   * DUAS VARREDURAS, uma constante.
   *
   * O senoidal (modo 0) sobe e desce: é bom para "estou lendo isto aqui", que é
   * um vaivém mesmo. A auditoria não é vaivém — ela percorre capítulos, do
   * começo ao fim, e uma banda que volta diria que o agente reconsidera o que já
   * passou. No modo 1 a banda nasce embaixo, sobe e recomeça: leitura de
   * documento, não de superfície.
   *
   * `mod` em vez de `fract` porque o intervalo é 2,2 (a esfera vai de -1,05 a
   * +1,05 e sobra folga nas pontas para a banda entrar e sair inteira).
   */
  float scanY = uScanMode > 0.5
    ? mod(uTime * 0.35, 2.2) - 1.1
    : sin(uTime * 0.55) * 1.05;
```

Em `AgentOrbScene.tsx`, `uScanMode: 0` entra na lista de uniforms do
`OrbSurfaceMaterial`, e no `useFrame`:

```ts
    // Sem damping: é uma CHAVE, não uma intensidade. Amortecer produziria um
    // meio-modo que não é nem vaivém nem percurso.
    su.uScanMode.value = state === "auditing" ? 1 : 0;
```

- [ ] **Step 3: A máquina e a fiação**

Em `use-agent-state.ts`: `auditing?: boolean` em `AgentSignals`, o parâmetro no
destructuring, e o retorno **abaixo de `analyzing`**:

```ts
  if (thinking) return "analyzing";
  // Um turno de chat ao vivo VENCE a auditoria em segundo plano: quem digitou
  // agora espera resposta agora, e o palco já mostra a auditoria correndo.
  if (auditing) return "auditing";
  if (transient === "complete") return "complete";
```

Atualize o docblock de prioridade no topo do arquivo.

Em `NexoWorkspace.tsx:1326-1334`, `auditandoAgora` **sai** de `thinking` e vira
sinal próprio:

```ts
  const agentState = useAgentState({
    dragging,
    reading: reading || readingMemorial,
    thinking: chatStatus.thinking,
    responding: chatStatus.responding,
    error: chatStatus.error,
    // A auditoria roda fora do turno do chat e leva minutos. Ela entrava em
    // `thinking` por falta de estado próprio, e o orbe a mostrava com a cara de
    // um turno de segundos.
    auditing: auditandoAgora,
  });
```

- [ ] **Step 4: O rótulo sai do remendo**

Em `NexoCopilot.tsx`, o `auditando = Boolean(useAuditoria().emCurso)` e o ramo
que ele governa em `statusLabel` saem: o estado carrega a informação.

```ts
  const working =
    agentState === "analyzing" ||
    agentState === "responding" ||
    agentState === "reading" ||
    agentState === "auditing";

  const statusLabel =
    agentState === "error"
      ? "instabilidade"
      : agentState === "reading"
        ? "lendo os selos"
        : agentState === "auditing"
          ? "auditando o memorial"
          : working
            ? "pensando"
            : fileCount > 0
              ? `${fileCount} folha${fileCount > 1 ? "s" : ""} no contexto`
              : "pronto";
```

Remova o `import { useAuditoria }` se ficar sem uso.
`STATE_LABEL`: `auditing: "Nexo — auditando o memorial"`.
`STATE_UI`: entrada nova, tom de trabalho (mesmo grupo de `analyzing`).

- [ ] **Step 5: DESIGN.md §6**

Linha nova na tabela de estados, entre `analyzing` e `complete`:

```markdown
| `auditing` | auditoria de memorial em curso (minutos, fora do turno de chat) | percorre um documento longo |
```

E, logo abaixo da tabela, a nota da decisão:

```markdown
`auditing` fica **abaixo** de `analyzing` na prioridade: um turno de chat ao
vivo assume a esfera, e a auditoria a retoma ao terminar. A distinção visual é
a varredura — contínua de baixo para cima (`uScanMode = 1`), contra o vaivém
senoidal de `reading`.
```

- [ ] **Step 6: Provar em imagem**

Com `npm run dev` de pé:

```bash
node scripts/shot-orbe-parado.mjs --estado=auditing --quadros=6 --intervalo=700
```
Expected: 6 PNGs no scratchpad, a banda em alturas crescentes ao longo da
sequência (é isso que prova que ela sobe sempre, em vez de voltar).

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/components/agent-orb modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/NexoCopilot.tsx DESIGN.md
git commit -m "orbe: auditar deixa de usar a cara de pensar, e passa a percorrer"
```

---

### Task 3: Aguardando você (O.2)

**Files:** `agent-orb.types.ts`, `AgentOrbScene.tsx`, `use-agent-state.ts`, `NexoWorkspace.tsx`, `AgentOrb.tsx`, `AgentStatusPopover.tsx`, `DESIGN.md` §6

**Interfaces:**
- Consumes: `AGENT_STATES`, `auditing` (Tarefas 1 e 2).
- Produces: `AgentState` ganha `"waiting"`; `OrbVisualParams` ganha
  `breathRate: number`; `AgentSignals` ganha `waiting?: boolean`.

- [ ] **Step 1: O respiro vira parâmetro**

Hoje o respiro é fixo em `AgentOrbScene.tsx:333`
(`0.85 + 0.15 * Math.sin(time * 1.5)`). Ele precisa variar por estado, então
sobe para `OrbVisualParams`:

```ts
  /**
   * Ciclos por segundo do respiro do miolo. 1,5 é o repouso do produto (~4s de
   * ida e volta). `waiting` usa metade: a espera do humano não tem a mesma
   * pressa do agente parado, e é essa diferença de ritmo que se lê sem rótulo.
   */
  breathRate: number;
```

**Todo** `case` de `paramsForState` ganha `breathRate: 1.5`, menos `waiting`
(0.75). O TypeScript aponta o que faltar.

No `useFrame`: `c.breathRate = d(c.breathRate, t.breathRate, 3);` — damping
baixo de propósito, para a mudança de ritmo ser percebida como transição e não
como corte. E o respiro passa a integrar a fase, em vez de multiplicar o tempo:

```ts
    /*
     * A FASE É INTEGRADA, não calculada de `time * rate`.
     *
     * Multiplicar o relógio pela taxa faz a fase SALTAR quando a taxa muda —
     * `time` já vale centenas, e meia unidade de diferença joga o seno para
     * outro ponto do ciclo. O miolo daria um pulo no instante em que o agente
     * passasse a esperar, que é exatamente o oposto do que este estado diz.
     */
    breathPhase.current += dt * c.breathRate;
    const breath = reduced ? 1 : 0.85 + 0.15 * Math.sin(breathPhase.current);
```

com `const breathPhase = useRef(0);` junto dos outros refs.

- [ ] **Step 2: O estado e os alvos**

`"waiting"` no enum e em `AGENT_STATES` (entre `complete` e `idle`).

```ts
    /*
     * A BOLA ESTÁ COM VOCÊ.
     *
     * Metade dos turnos deste produto termina com o agente perguntando (é o
     * princípio 2: afirma fatos, pergunta decisões), e o orbe só sabia falar do
     * próprio trabalho — em repouso, a espera e o ócio tinham a mesma cara.
     * O rim um pouco acima do idle é o que diz "ainda estou aqui"; o respiro
     * lento é o que diz "sem pressa".
     */
    case "waiting":
      return { distortion: 0.05, pulse: 0.22, rim: 0.62, scan: 0, spin: 0.12, jitter: 0, breathRate: 0.75 };
```

- [ ] **Step 3: A máquina**

Em `use-agent-state.ts`, `waiting?: boolean`, e o retorno **abaixo de
`complete`**:

```ts
  if (transient === "complete") return "complete";
  // Só depois do pulso de conclusão: terminar e passar a bola são dois
  // momentos, e o pulso é o que marca o primeiro.
  if (waiting) return "waiting";
  return "idle";
```

- [ ] **Step 4: A derivação do sinal**

Em `NexoWorkspace.tsx`, um hook local acima do `useAgentState`. As três
condições e o atraso:

```tsx
/**
 * "O agente perguntou e ninguém respondeu" — o sinal de `waiting`.
 *
 * Os SEIS SEGUNDOS não são estética: sem atraso, o estado piscaria no fim de
 * toda resposta, entre o último caractere do agente e a primeira tecla do
 * humano. A espera só é espera quando dura.
 *
 * `pergunta` é derivada, não guardada: a última mensagem é do assistente, nada
 * está em curso, e o composer está vazio. Guardar um booleano "perguntei"
 * exigiria que todo caminho de saída o limpasse — e o que não se limpa em
 * algum caminho é como um estado fica preso.
 */
function useEsperandoVoce(pergunta: boolean, reduced: boolean): boolean {
  const [esperando, setEsperando] = useState(false);
  useEffect(() => {
    if (!pergunta || reduced) {
      setEsperando(false);
      return;
    }
    const id = setTimeout(() => setEsperando(true), 6000);
    return () => {
      clearTimeout(id);
      setEsperando(false);
    };
  }, [pergunta, reduced]);
  return esperando;
}
```

e o uso, onde `agentState` é montado:

```tsx
  const esperandoVoce = useEsperandoVoce(
    ultimaEhDoAssistente &&
      !composerTemTexto &&
      !chatStatus.thinking &&
      !chatStatus.responding &&
      !reading &&
      !readingMemorial &&
      !auditandoAgora,
    reduced,
  );
```

`ultimaEhDoAssistente` sai da lista de mensagens que o workspace já tem;
`composerTemTexto` vem da Tarefa 8 (`useComposerFoco` também expõe
`temTexto`). **Se a Tarefa 8 ainda não estiver feita, use `false` e deixe um
`TODO` nomeando a tarefa** — mas prefira executar a 8 antes desta.

- [ ] **Step 5: Rótulos e DESIGN.md**

`STATE_LABEL`: `waiting: "Nexo — aguardando você"`.
`STATE_UI`: tom de `idle` — **sem** pulso de trabalho; esperar não é trabalhar,
e o respiro do orbe já comunica.
`NexoCopilot`: `statusLabel` ganha `agentState === "waiting" ? "aguardando você"`,
**fora** do grupo `working` (nada de reticência animada).

`DESIGN.md` §6: linha na tabela, entre `complete` e `idle`, mais a nota de que
`breathRate` entrou em `OrbVisualParams` e por que a fase é integrada.

- [ ] **Step 6: Provar**

```bash
node scripts/shot-orbe-parado.mjs --estado=waiting --quadros=8 --intervalo=1200
```
Expected: 8 PNGs; comparando o primeiro e o último, o miolo varia devagar — a
prova do respiro longo é a diferença **entre** quadros distantes.

Na aplicação: faça o agente perguntar, não responda, conte seis segundos.
Digite uma letra → volta ao estado real. Apague a letra → volta a esperar em
seis segundos.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/components/agent-orb modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/NexoCopilot.tsx DESIGN.md
git commit -m "orbe: a esfera passa a dizer quando a bola esta com voce"
```

---

### Task 4: Progresso da leitura no aro (O.3)

**Files:** `AgentOrbScene.tsx`

- [ ] **Step 1: A malha**

Anel próprio, **fora** do `tiltRef` (sinal de estado fica de frente) e **não**
reaproveitando o `ringMatRef` do drop-target — raio diferente, significado
diferente, e materiais compartilhados é como dois sinais passam a se apagar.

```tsx
      {/* PROGRESSO DA LEITURA — arco que fecha 360° conforme as folhas entram.
          Raio 1,14-1,17: fora da silhueta (1,0), dentro do anel de drop (1,3) e
          com folga no quadro de ±1,63. */}
      <mesh ref={progressoRef} renderOrder={2} visible={false}>
        <ringGeometry args={[1.14, 1.17, 96, 1, Math.PI / 2, Math.PI * 2]} />
        <meshBasicMaterial
          ref={progressoMatRef}
          color={RIM_COLOR}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
```

- [ ] **Step 2: O arco**

No `useFrame`, o recorte sem shader e sem recriar geometria:

```ts
    /*
     * O ARCO É UM RECORTE DE ÍNDICE, não um shader e não uma geometria nova.
     *
     * `ringGeometry` gera os índices em sequência angular a partir de
     * `thetaStart`, então cortar o draw range no meio deixa um arco contíguo —
     * de graça, sem alocar por quadro. Recriar a geometria a cada folha lida
     * seria criar e descartar buffers 200 vezes numa leitura grande.
     */
    const lendo = state === "reading";
    progressoRef01.current = d(progressoRef01.current, lendo ? ativ : 0, 5);
    const pm = progressoMatRef.current;
    const pr = progressoRef.current;
    if (pr && pm) {
      const frac = progressoRef01.current;
      const alvo = lendo && frac > 0.001 ? 0.8 : 0;
      pm.opacity = d(pm.opacity, alvo, 6);
      pr.visible = pm.opacity > 0.01;
      if (pr.visible) {
        const total = pr.geometry.index?.count ?? 0;
        // Múltiplo de 3: o recorte tem de cair em fronteira de triângulo,
        // senão o último some inteiro em vez de o arco crescer liso.
        pr.geometry.setDrawRange(0, Math.floor((total * frac) / 3) * 3);
      }
    }
```

com `progressoRef`, `progressoMatRef` e `progressoRef01 = useRef(0)` junto dos
demais.

- [ ] **Step 3: Provar**

```bash
node scripts/shot-orbe-parado.mjs --estado=reading --quadros=4
```
O script fixa `activity={0.7}`: o arco tem de cobrir ~70% da volta, começando no
topo e crescendo no sentido do `ringGeometry`. Com `--estado=idle`, nenhum arco.

- [ ] **Step 4: Corrigir os comentários vencidos (achado nº 2)**

`AgentOrbScene.tsx:398-399` e `:434` dizem "quadro de ±1,42"; o quadro é ±1,63
desde o recuo da câmera para 4,25. Corrija os dois números.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/agent-orb/AgentOrbScene.tsx
git commit -m "orbe: o aro passa a medir a leitura, e nao so a insinua-la"
```

---

### Task 5: O erro ganha ritmo (O.4)

**Files:** `AgentOrbScene.tsx`, `DESIGN.md` §6

- [ ] **Step 1: O batimento**

No `useFrame`, depois de `breath`:

```ts
    /*
     * O ERRO SE DIZ POR RITMO, porque não pode se dizer por cor.
     *
     * A lei do §6 prende o orbe à rampa teal — inclusive no erro. Tingir o aro
     * de coral foi considerado e recusado: seria cor de STATUS num elemento
     * INTERATIVO, e quebraria a iridescência que é a identidade. Sobra o tempo.
     *
     * Duas contrações rápidas e uma pausa: é sístole-diástole, e o corpo lê isso
     * como "algo errado" antes de a cabeça ler o rótulo. O `jitter` continua —
     * ele é a textura; isto é a frase.
     */
    const batida = (x: number, centro: number) =>
      Math.exp(-Math.pow((x - centro) / 0.09, 2));
    const pulsoDoErro = state === "error"
      ? 0.25 + 0.75 * (batida(time % 1.6, 0) + 0.7 * batida(time % 1.6, 0.18))
      : 1;

    cu.uPulse.value = c.pulse * breath * (reduced ? 1 : pulsoDoErro);
```

- [ ] **Step 2: Provar**

```bash
node scripts/shot-orbe-parado.mjs --estado=error --quadros=10 --intervalo=200
```
Expected: com 200ms entre quadros a sequência cruza o ciclo de 1,6s — alguns
quadros pegam a contração (miolo aceso), a maioria pega a pausa (miolo baixo).
Dez quadros de brilho igual significam que o batimento não está entrando.

- [ ] **Step 3: `DESIGN.md` §6** — na linha de `error`, a leitura passa a ser
"instabilidade curta, em batimento duplo; a rampa teal não se rompe nem aqui".

- [ ] **Step 4: Commit**

```bash
git add modules/nexo/components/agent-orb/AgentOrbScene.tsx DESIGN.md
git commit -m "orbe: o erro passa a ter batimento, ja que nao pode ter cor"
```

---

### Task 6: Boot — o instrumento liga (O.5)

**Files:** `AgentOrbScene.tsx`

- [ ] **Step 1: A sequência**

```ts
/*
 * O BOOT — uma vez por CARREGAMENTO, não por montagem.
 *
 * A flag é de MÓDULO, não de ref: o orbe remonta ao trocar de tela (welcome ↔
 * active desmonta a árvore), e um boot por montagem transformaria navegar em
 * pisca-pisca. Recarregar a página zera o módulo e o boot volta — que é o
 * correto: é um carregamento novo.
 */
let jaLigou = false;
```

no escopo do módulo, e no componente:

```ts
  const bootRef = useRef(jaLigou || reduced ? 1 : 0);
  useEffect(() => {
    jaLigou = true;
  }, []);
```

No `useFrame`, antes de escrever os uniforms:

```ts
    // ~600ms até o miolo cheio; o rim atrasa 150ms (o `Math.max(0, …)`), que é
    // o que faz a sequência ler como "liga e então acende" em vez de fade.
    bootRef.current = reduced ? 1 : THREE.MathUtils.damp(bootRef.current, 1, 5, dt);
    const boot = bootRef.current;
    const bootRim = Math.max(0, (boot - 0.25) / 0.75);
```

e a aplicação: `su.uRim.value = c.rim * bootRim;`,
`cu.uPulse.value = c.pulse * breath * (reduced ? 1 : pulsoDoErro) * boot;`, e o
giro nasce alto — `spinRef.current.rotation.y += dt * c.spin * (1 + (1 - boot) * 3);`

- [ ] **Step 2: Provar**

Com `reduced` ligado no SO, o orbe aparece pronto (nenhuma animação).
Sem: recarregue `/nexo` e observe o acender; navegue welcome ↔ active e
confirme que **não** re-acende.

- [ ] **Step 3: Commit**

```bash
git add modules/nexo/components/agent-orb/AgentOrbScene.tsx
git commit -m "orbe: o instrumento liga uma vez por carregamento"
```

---

### Task 7: O orbe vivo no login (O.6)

**Files:** `app/login/page.tsx`

- [ ] **Step 1: Trocar o SVG pelo orbe**

O `dynamic(ssr:false)` já está dentro do `AgentOrb`, e o `OrbGlow` cobre o
carregamento e a falta de WebGL — a página não precisa de nenhum dos dois.

```tsx
<AgentOrb size="compact" state="idle" interactive={false} />
```

`interactive={false}` porque não há o que ativar aqui: sem `onActivate` o
componente já vira `role="img"`, e deixar o hover aceso prometeria um clique que
não existe.

- [ ] **Step 2: Verificar as duas armadilhas**

1. **Um orbe vivo por tela** — confirme que o login não tem outro (o logo do
   cabeçalho é o SVG estático, e continua sendo).
2. **Esfera escura em fundo escuro** — o §6 documenta que o aro é o que segura a
   silhueta. Olhe o resultado sobre o fundo do login; se a silhueta sumir, o
   ajuste é do fundo da página, não do orbe.
3. **Layout shift** — a caixa é `aspect-square` com largura fixa, então o
   Canvas entra dentro de espaço já reservado. Confirme a olho.

- [ ] **Step 3: Provar**

```bash
npm run telas
```
Se o script cobrir o login, a captura já mostra o resultado; senão, print manual
da rota com `npm run dev` de pé.

- [ ] **Step 4: Commit**

```bash
git add app/login/page.tsx
git commit -m "login: a porta de entrada mostra a alma acesa, nao a foto dela"
```

---

### Task 8: O orbe ouve a digitação (O.7)

**Files:** `modules/nexo/state/composer-controller.tsx`, `NexoChat.tsx`, `NexoCopilot.tsx`, `AgentOrb.tsx`, `AgentOrbCanvas.tsx`, `AgentOrbScene.tsx`

**Interfaces:**
- Produces: `useComposerFoco(): { focado: boolean; temTexto: boolean }` — a
  Tarefa 3 consome `temTexto`.

- [ ] **Step 1: A assinatura separada (achado nº 4)**

`isFocused` **não** entra em `ComposerControls`. A fachada é `useMemo` sem deps
de propósito: é o que impede os chips de re-renderizarem a cada tecla. Um
booleano que muda ao digitar dentro dela desfaria justamente isso.

Em `composer-controller.tsx`, um segundo contexto:

```tsx
/**
 * O ESTADO OBSERVÁVEL do composer — foco e "tem texto".
 *
 * Vive num contexto SEPARADO dos controles, e a separação é a razão de o
 * arquivo ter dois. `ComposerControls` é uma fachada estável (`useMemo` sem
 * deps) para que os chips nunca re-renderizem por causa do composer; pôr aqui
 * um booleano que muda a cada tecla desfaria isso na primeira letra digitada.
 *
 * Quem lê isto (o orbe) re-renderiza mesmo — e são dois componentes, não a
 * lista inteira de mensagens.
 */
interface ComposerFoco {
  focado: boolean;
  temTexto: boolean;
}

const ComposerFocoContext = createContext<ComposerFoco>({
  focado: false,
  temTexto: false,
});

export function useComposerFoco(): ComposerFoco {
  return useContext(ComposerFocoContext);
}
```

O provider ganha o estado e um `publicarFoco` estável exposto ao `NexoChat`
(que é dono do input real), no mesmo padrão do `register`.

- [ ] **Step 2: A fiação até a cena**

`NexoChat` chama `publicarFoco({ focado, temTexto })` nos handlers de
`onFocus`/`onBlur`/`onChange` do textarea. `NexoCopilot` lê `useComposerFoco()`
e passa `ouvindo={focado}` ao `AgentOrb`, que o repassa ao `AgentOrbCanvas` e à
cena.

- [ ] **Step 3: O efeito, somado sem dobrar**

```ts
    listenRef.current = d(listenRef.current, ouvindo ? 1 : 0, 8);
    // Somado ao hover, mas com TETO: focar o campo com o mouse sobre o orbe
    // acontece o tempo todo, e dois realces empilhados estouram o aro.
    const realce = Math.min(0.18, h * 0.18 + listenRef.current * 0.1);
    c.rim = d(c.rim, t.rim + realce);
```

(substituindo o `c.rim = d(c.rim, t.rim + h * 0.18)` de hoje).

- [ ] **Step 4: Provar** — focar o composer levanta o aro; desfocar recua;
focar com o mouse em cima **não** dobra o efeito.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/state/composer-controller.tsx modules/nexo/components
git commit -m "orbe: a esfera levanta o aro quando voce comeca a escrever"
```

---

### Task 9: Chegada de documento com cerimônia (O.8)

**Files:** `AgentOrbScene.tsx`

- [ ] **Step 1: O overshoot com freio de rajada**

```ts
  /** Instante de nascimento de cada satélite; -1 = não nasceu. */
  const satNasceu = useRef<number[]>(Array.from({ length: MAX_SATS }, () => -1));
  const contagemAnterior = useRef(0);
```

No laço dos satélites, ao detectar que `satScale` saiu de zero:

```ts
      /*
       * A CERIMÔNIA É PARA UMA FOLHA, NÃO PARA CINQUENTA.
       *
       * Uma prancha chegando sozinha merece ser vista chegando. Cinquenta
       * chegando juntas com overshoot viram pipoca — e o lote grande é o caso
       * comum deste produto, não o raro. Acima de três de uma vez, elas só
       * assentam.
       */
      const rajada = count - contagemAnterior.current > 3;
      if (alvo === 1 && satNasceu.current[i] < 0) {
        satNasceu.current[i] = rajada || reduced ? -2 : time;
      }
      if (alvo === 0) satNasceu.current[i] = -1;

      let escala = s;
      if (satNasceu.current[i] >= 0) {
        const idade = (time - satNasceu.current[i]) / 0.35;
        if (idade >= 1) satNasceu.current[i] = -2;
        else escala = s * (1 + 0.18 * Math.sin(Math.min(1, idade) * Math.PI));
      }
      m.scale.setScalar(escala);
```

e `contagemAnterior.current = count;` no fim do laço. A opacidade continua
multiplicada por `s` (não por `escala`): a regra de "não piscar com opacidade
cheia antes de crescer" é sobre o nascimento, e o overshoot é depois dele.

- [ ] **Step 2: Provar** — solte **um** PDF e olhe o ponto assentar; solte um
lote grande e confirme que ninguém pula.

- [ ] **Step 3: Commit**

```bash
git add modules/nexo/components/agent-orb/AgentOrbScene.tsx
git commit -m "orbe: a folha que chega sozinha e recebida; o lote so assenta"
```

---

### Task 10: A bancada escreve o changelog (O.10)

**Files:** `app/bancada-do-orbe/bancada.tsx`

- [ ] **Step 1: O bloco datado**

Na função `copiar` (L115), depois do snippet de código, um segundo bloco:

```ts
    /*
     * O SNIPPET SOZINHO NÃO BASTA.
     *
     * Ele diz o valor novo e cala o motivo — e o motivo é a única coisa que a
     * próxima pessoa não consegue deduzir olhando a tela. Afinação que fica só
     * na cabeça de quem ajustou é a "verdade duplicada" que o §12 pune: daqui a
     * seis meses o valor está lá, ninguém sabe por quê, e ninguém ousa mexer.
     *
     * A data sai de `toISOString().slice(0, 10)` no CLIQUE, nunca no render:
     * ler relógio durante o render é erro de hidratação.
     */
    const changelog =
      `<!-- DESIGN.md §6 — colar na seção de afinação -->\n` +
      `**${new Date().toISOString().slice(0, 10)}** — orbe afinado na bancada.\n` +
      `- cores: ${(Object.keys(ROTULO_DA_COR) as (keyof CoresDoOrbe)[]).map((k) => `${k} ${cores[k]}`).join(" · ")}\n` +
      `- vidro: esfera ${vidro.esfera} · brilho ${vidro.brilho} · espessura ${vidro.espessura} · onda ${vidro.ondaDaAlma} · translucidez ${vidro.translucidez}\n` +
      (ajusteManual ? `- params (${estado}): ${JSON.stringify(params)}\n` : "") +
      `- motivo: \n`;
```

O `motivo:` sai **vazio de propósito** — é o mantenedor que o preenche, e uma
linha vazia num texto colado cobra preenchimento melhor do que um placeholder
plausível.

- [ ] **Step 2: Provar** — clicar em "Copiar valores" e colar: sai o snippet e
o bloco datado.

- [ ] **Step 3: Commit**

```bash
git add app/bancada-do-orbe/bancada.tsx
git commit -m "bancada: o que se afina no olho passa a sair pronto para o changelog"
```

---

## Self-review

**Cobertura:** O.9→T1, O.1→T2, O.2→T3, O.3→T4, O.4→T5, O.5→T6, O.6→T7,
O.7→T8, O.8→T9, O.10→T10. As dez.

**Ordem × spec:** a spec pede O.5+O.6 juntas (item 6) e O.7 depois (item 7).
Aqui a T8 (O.7) fica **depois** da T7 (O.6) como a spec manda, mas a T3 (O.2)
consome `temTexto` da T8. Duas saídas, ambas registradas no Step 4 da T3:
executar a T8 antes da T3, ou entrar com `false` e um TODO. **Recomendado:
antecipar a T8** — é pequena e destrava a T3 inteira.

**Consistência de tipos:** `AGENT_STATES` (T1) é consumido por T2 e T3;
`breathRate` entra em `OrbVisualParams` na T3 e **todo** `case` de
`paramsForState` precisa ganhá-lo, inclusive o `auditing` criado na T2 — o
`Record`/interface faz o compilador apontar. `useComposerFoco` devolve
`{ focado, temTexto }` na T8 e é lido com esses nomes na T3 e na T8.

**Risco conhecido:** a T3 muda o respiro de `time * rate` para fase integrada.
Se alguma coisa fora do `useFrame` depender da fase antiga, o miolo salta uma
vez na primeira troca de estado — nada depende hoje, mas é o primeiro lugar a
olhar se aparecer um pulo.
