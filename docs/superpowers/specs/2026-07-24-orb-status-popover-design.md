# Popover de status do orb (Nexo Core)

**Data:** 2026-07-24
**Escopo:** Item 1 da lista de hoje. Clique no `AgentOrb` abre um popover que
"espia o que o Nexo já entendeu". Isolado, não toca no fluxo do chat.

## Problema

`AgentOrb` já aceita `onActivate` e vira `role="button"` quando o recebe, mas
[NexoCopilot.tsx](../../../modules/nexo/components/NexoCopilot.tsx) monta o orb
**sem** `onActivate` — hoje é hover-only. Falta o clique→popover.

## Princípio

"Afirma fatos, pergunta decisões." O popover só mostra o que o Nexo **de fato**
leu dos selos. Nunca inventa prefeitura (que só é escolhida na geração da capa).

## Componentes

### 1. `summarizeSelos(selos)` — derivação pura
`modules/nexo/lib/agent-context.ts`. Sem IA, testável. Reusa `parseFilename`
(já usado client-side no NexoWorkspace).

```ts
interface AgentContext {
  folhas: number;         // nº de selos lidos (com extração)
  obra: string | null;    // obra dominante
  disciplinas: string[];  // labels distintos, ordem de aparição
  codigo: string | null;  // dominante (parseFilename do arquivo/fileName)
  revisao: string | null; // dominante
}
```
Regras: "dominante" = valor mais frequente (empate → primeiro visto). Strings
vazias/nulas ignoradas. `disciplinas` distinta preservando ordem.

### 2. `AgentPopover` — primitivo
`components/ui/agent-popover.tsx`. Irmão do `Dropdown`: fecha no clique-fora e no
Escape, ancorado abaixo do gatilho. Diferença: `role="dialog"` + `aria-label`
(cartão de status, não menu). Controlado pelo pai (`open`/`onClose`), com o
gatilho (orb) e o painel como irmãos dentro de um wrapper `relative`.

### 3. `AgentStatusPopover` — conteúdo
`modules/nexo/components/agent-orb/AgentStatusPopover.tsx`. Recebe
`state: AgentState` + `context: AgentContext`. Layout:
- **Cabeçalho:** bolinha de cor + rótulo humano do estado (Ocioso / Lendo
  pranchas… / Analisando… / Solte os PDFs / Pronto / Instabilidade). Mapa
  cobre os 9 estados do enum.
- **Corpo:** `folhas === 0` → linha honesta "Ainda não li nenhuma prancha.
  Solte os PDFs das pranchas." Caso contrário, os fatos conhecidos (só os que
  existem): Folhas lidas / Obra / Disciplina(s) / Código · rev.
- **Rodapé:** `Nexo · Beta` discreto.

### 4. Fiação
`NexoWorkspace` deriva `context = summarizeSelos(selos)` e passa ao
`NexoCopilot`. Este envolve o `AgentOrb` num wrapper `relative`, mantém `open`
local e liga `onActivate={() => setOpen(o => !o)}`. O `AgentPopover` renderiza
irmão do orb. Fecha na `reset`/nova conversa naturalmente (context zera).

## Fora de escopo
Ações rápidas (nova conversa, anexar) — o usuário escolheu status-only.
Persistência, histórico. Prefeitura (não é fato lido).

## Verificação
- `summarizeSelos`: teste de unidade (dominância, distinção, vazios).
- `tsc` + `eslint` verdes. Commit direto na main.
