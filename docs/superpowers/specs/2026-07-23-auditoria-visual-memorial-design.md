# Auditoria Visual de Memorial — Design

> Spec gerada por brainstorm (2026-07-23). Feature do módulo Nexo, Fase 3.
> Vista visual no canvas para o resultado da auditoria de memorial, derivada 100%
> do `AuditReport` existente, sem tocar no motor congelado.

## 1. Problema e objetivo

Hoje a auditoria de memorial (`/api/audit` → `runMemorialAudit`) devolve um
**relatório textual** (`makeTextReport`). É correto e formal, mas é uma parede de
texto: o engenheiro não *vê* onde estão os erros nem percebe de relance quando um
mesmo erro se repete ao longo do documento.

**Objetivo:** apresentar o resultado da auditoria como uma **vista visual no
canvas tipo FigJam** (o mesmo do Apêndice G da arquitetura do reflow), onde as
páginas com achado aparecem como miniaturas reais, os achados são cards ligados
por linha às suas páginas, e **erros recorrentes** (o mesmo erro em várias
páginas) se destacam com uma **pilha animada**. O relatório textual completo
continua disponível num drawer.

**Não-objetivo:** mudar o motor de auditoria. O `AuditReport` e as rotas seguem
intocados (contrato C6 congelado). Toda a vista é **derivada no cliente**.

## 2. Decisões travadas (do brainstorm)

1. **Complementar, não substituir.** O canvas visual é a tela **principal** do
   resultado; o relatório textual continua existindo atrás de um drawer
   ("Ver relatório completo"). Reusa `makeTextReport` / `audit-result.tsx`.
2. **Layout centrado na página (opção B).** Só as **páginas com achado** viram
   nós, como **miniaturas reais renderizadas** (worker do react-pdf), lazy.
3. **Memorial PODE virar frame.** Recorte explícito do usuário: o invariante
   "anexo do usuário não vira frame" (§4 / Apêndice G da ARQUITETURA.md) vale
   para **projeto/pranchas pesadas do volume**, NÃO para o memorial — que é o
   **objeto** da auditoria. Aqui renderizar página do memorial é correto e
   esperado. Continua bounded: só as páginas marcadas (ex.: ~8 de 218), lazy.
4. **Interação Modelo 2.** Cada achado é um **card sempre visível**, com a
   **linha desenhada** até a página. **Hover acende o par** (card ↔ página) e
   apaga o resto.
5. **Pin no trecho (best-effort).** Como a página é renderizada, busca-se o
   `termo_busca`/`evidencia` do achado na **camada de texto** e posiciona-se o
   pin sobre a linha do erro. Não encontrou → badge no nível da página, sem pin.
6. **Recorrentes = pilha em ciclo contínuo (opção 2).** Achados agrupados viram
   **uma pilha** que cicla ("uma sobreposta à outra"), com **N linhas** às N
   páginas e badge **×N**. `prefers-reduced-motion` **congela** o ciclo; **hover
   pausa** e permite abrir a lista das ocorrências.
7. **Agrupamento estrito.** "O mesmo erro" = **mesmo `tipo` + mesma
   `evidencia`/`conflito` normalizada**, com **fallback de alta similaridade**
   (não igualdade crua) para tolerar variação de redação da IA entre páginas.
8. **Cor por severidade, reusando o que existe.** Mapeia o `impacto` do achado
   (`classifyFindingImpact` em `lib/audit-report.ts`): `critico_documental` = 🔴,
   `tecnico_contratual` = 🟡, `revisao_editorial` = ⚪/neutro. O
   `getEmissionVerdict` (🔴 NÃO EMITIR / 🟡 REVISAR / 🟢 LIBERADO) vira o
   **cabeçalho fixo** do canvas.

## 3. Fluxo

1. Card **"🔍 Auditar memorial"** do welcome → usuário anexa o memorial → escolhe
   a ação → slide welcome→active.
2. `/api/audit` roda (intocado) → `AuditReport` entra no estado **leve** da
   sessão; os **bytes do memorial** vão para o `blobRegistry` (fora do React),
   apenas para render das páginas.
3. `buildAuditGraph(report, memorialFile)` deriva o **modelo do grafo** (puro).
4. `AuditCanvas` desenha nós + edges; páginas renderizam lazy; o pin é
   posicionado quando a camada de texto da página fica disponível.

Binários pesados nunca entram no estado React (regra de peso da §2 da
ARQUITETURA.md).

## 4. Componentes (isolados e testáveis)

### 4.1 `buildAuditGraph(report, memorialFile)` — deriver PURO
- **Entrada:** `AuditReport` + referência ao arquivo do memorial (para depois
  render; a função em si não faz IO).
- **Saída:** `AuditGraph` =
  ```ts
  type AuditSeverity = 'critico' | 'tecnico' | 'editorial';
  interface AuditPageNode { pageNumber: number; findingIds: string[]; }
  interface AuditFindingNode {
    id: string; severity: AuditSeverity; pageNumber: number | null;
    tipo: string; evidencia: string; sugestao: string; termoBusca?: string;
    groupId: string | null; // preenchido se pertence a um grupo recorrente
  }
  interface AuditRecurringGroup {
    id: string; severity: AuditSeverity; tipo: string;
    findingIds: string[]; pages: number[]; count: number;
  }
  interface AuditGraph {
    verdict: EmissionVerdict;            // reusa getEmissionVerdict
    pageNodes: AuditPageNode[];          // ordenadas por pageNumber
    findingNodes: AuditFindingNode[];
    recurringGroups: AuditRecurringGroup[];
    unplaced: AuditFindingNode[];        // pagina "não identificada"
  }
  ```
- **Responsabilidades:** normalizar `pagina` (string → número; vazio/"não
  identificada" → `null` → `unplaced`); mapear `impacto` → `severity`; agrupar
  pela régua estrita (chave = `tipo` normalizado + `evidencia`/`conflito`
  normalizada) com fallback de similaridade alta; um grupo só existe se
  `count >= 2` e as páginas forem distintas.
- **Sem React, sem imports pesados** → suíte de teste `test:nexo:audit-graph`
  (análoga a `test:nexo:agent`/`normalize.ts`), travando: agrupamento estrito,
  fallback de similaridade, `null` de página, mapa de severidade, `count>=2`.

### 4.2 `locateTermOnPage(textContent, termo)` — helper best-effort
- Recebe o `textContent` do pdf.js (itens com `transform`) + o `termo`.
- Devolve `{ xPct, yPct } | null` (posição relativa na página) para ancorar o pin.
- Busca tolerante (normaliza acento/caixa; casa prefixo do termo). Não achou →
  `null` (a UI cai para badge de página).
- Puro sobre a entrada → testável com um `textContent` fixture.

### 4.3 Nós custom do React Flow (`@xyflow/react`)
- **`MemorialPageNode`** — miniatura via worker do react-pdf (reusa o primitivo
  `ArtifactThumb`), `IntersectionObserver`, cap de K `<Document>` simultâneos
  (mesma governança de perf da §4 da ARQUITETURA.md). Renderiza os pins por cima
  (posição de `locateTermOnPage`, com fallback de badge).
- **`FindingCardNode`** — card colorido por severidade; edge até a página; hover
  acende o par.
- **`RecurringStackNode`** — a pilha em ciclo; N edges às N páginas; badge ×N;
  `prefers-reduced-motion` congela; hover pausa e expande a lista.

### 4.4 `AuditCanvas`
- Instância React Flow: auto-layout (páginas em linha/grade; achados ao redor;
  pilhas recorrentes à margem; cluster "sem página" num canto), pan+zoom, tema
  dark + glass leve. Cabeçalho fixo com o `verdict`. Botão "Ver relatório
  completo" abre o **drawer** com o textual reusado.
- Hover-highlight: acender par card↔página e apagar o resto (state local do
  canvas, não do Provider).

### 4.5 Drawer do relatório
- Reusa o relatório textual existente (`makeTextReport` / `components/
  audit-result.tsx`). Zero reescrita do formato.

## 5. Estados de borda

| Estado | Tratamento |
|---|---|
| **0 achados** | Semáforo 🟢 "LIBERADO"; memorial como nó único; "nada a revisar". Sem frames de erro. |
| **Página "não identificada"** | Achado vai para o cluster **"Sem página localizada"** (não some). |
| **Trecho não encontrado na camada de texto** | Sem pin; badge de erro no nível da página. |
| **Render da página falhou (worker)** | Degrada honesto: chip com o número da página em vez da miniatura; achados continuam visíveis. |
| **Muitos achados** | Bounded pelas páginas marcadas; cards virtualizados; pilhas colapsam recorrentes. |
| **`prefers-reduced-motion`** | Ciclo congelado (estático com ×N). |
| **Memorial ausente/expirado** (sessão efêmera, pós-reload) | Sem bytes → sem miniatura; mostra o grafo em modo "só números de página" + relatório no drawer. |

## 6. Dependências e posição no plano

- **Depende de** o canvas React Flow existir: o **PR5** da ARQUITETURA.md monta
  `@xyflow/react` + `ArtifactThumb` (worker react-pdf). Esta feature reusa ambos.
- **Não depende** de mexer no motor: `/api/audit`, `AuditReport`,
  `runMemorialAudit`, `audit-report.ts` seguem intocados (C6). Só **consome**.
- **Posição:** incremento **autocontido DEPOIS do PR5** — um **"PR7 — Auditoria
  visual"**. Até lá, o relatório textual atual segue como entregável; nada
  regride. Terá seu próprio plano de implementação.

## 7. Reuso vs novo

**Reusar sem tocar:** `/api/audit` e `modules/nexo/lib/audit.ts` (`runMemorialAudit`);
`lib/audit-report.ts` (`getEmissionVerdict`, `classifyFindingImpact`,
`classifyFindingTier`, labels); `makeTextReport` / `audit-result.tsx` (drawer);
`ArtifactThumb` + worker do react-pdf (do PR5); `blobRegistry` (do PR2).

**Novo:** `buildAuditGraph` (+ teste), `locateTermOnPage` (+ teste),
`MemorialPageNode`, `FindingCardNode`, `RecurringStackNode`, `AuditCanvas`,
o drawer wiring, tokens de cor por severidade (derivados dos existentes).

## 8. Riscos

- **Precisão do pin:** a camada de texto do pdf.js dá posição aproximada; termos
  longos/quebrados podem não casar. Mitigação: fallback de badge de página — a
  feature nunca depende do pin para ser útil.
- **Fidelidade do agrupamento:** o fallback de similaridade pode juntar demais ou
  de menos. Mitigação: começar estrito (igualdade normalizada) e só relaxar com
  limiar alto; validar com relatórios reais (ex.: `117_25`).
- **Perf de render:** limitado por só renderizar páginas marcadas + cap de K
  `<Document>`; reusa a governança de perf já provada do selo.
