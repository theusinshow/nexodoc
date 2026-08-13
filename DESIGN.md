---
name: Nexo
description: Assistente que produz a documentação de projetos de engenharia — do carimbo ao volume
colors:
  base-dark: "#0a0e11"
  panel-surface: "#121518"
  technical-teal: "#00a693"
  bright-teal: "#5bdac6"
  luminous-teal: "#7af7e1"
  rust-salmon: "#dc7858"
  salmon-pink: "#ffb59e"
  signal-ok: "#6ee7a3"
  signal-warning: "#e9b45c"
  signal-critical: "#ff9285"
  destructive-pink: "#ff9285"
  on-surface: "#e1e7ea"
  muted-gray: "#8e9ba3"
  border-divider: "#23282c"
  input-bg: "#2c3338"
  recessed-dark: "#06080a"
  raised-gray: "#1a1e21"
  secondary-surface: "#15191c"
typography:
  display:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.4
  subtitle:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Fallback', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  mono-label:
    fontFamily: "'IBM Plex Mono', 'IBM Plex Mono Fallback', ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: "0.05em"
  mono-data:
    fontFamily: "'IBM Plex Mono', 'IBM Plex Mono Fallback', ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
# A geometria do sistema é o CHANFRO, não o raio. Corte em superior esquerdo +
# inferior direito, sempre — nunca nos quatro cantos, nunca no par oposto. Os
# valores abaixo são o TAMANHO DO CORTE, e substituem o raio que tinham antes.
# Fonte: docs/superpowers/specs/2026-08-11-chanfro-como-sistema-design.md
cut:
  4: "controles flutuantes"
  5: "item de lista, badge"
  6: "botão 32/36, nó, chip"
  7: "botão 40, campo"
  8: "cartão, palco, botão 44"
# Raio sobrevive em três lugares e só neles: campo tracejado do carimbo e estado
# vazio tracejado (4px — tracejado não sobrevive ao recorte), formas redondas
# (orbe, avatar, indicador de estado) e a ilustração da tela de login.
rounded:
  dashed: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  gutter: "16px"
motion:
  duration-fast: "120ms"
  duration-base: "180ms"
  duration-slow: "240ms"
  duration-shell: "320ms"
  ease-feedback: "cubic-bezier(0.25, 1, 0.5, 1)"
  ease-entrance: "cubic-bezier(0.22, 1, 0.36, 1)"
layout:
  sidebar-w: "240px"
  copilot-w: "520px"
components:
  button-primary:
    backgroundColor: "{colors.technical-teal}"
    textColor: "{colors.base-dark}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "oklch(65% 0.12 180 / 0.9)"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-gray}"
  card:
    backgroundColor: "{colors.panel-surface}"
    rounded: "{rounded.sm}"
    padding: "12px"
  input:
    backgroundColor: "{colors.recessed-dark}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    height: "40px"
  chip-selected:
    backgroundColor: "{colors.panel-surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
---

# Design System — Nexo

## 0. Como usar este documento

**Fonte única.** `app/globals.css` é a verdade executável: é o que o navegador
obedece. Este documento é a lei que explica os tokens e diz onde cada um vale.
Ferramenta de design é onde o sistema é desenhado, visto e explorado — uma
decisão tomada lá só existe depois de entrar no CSS **e** aqui, no mesmo commit.

Este repositório já pagou caro por verdade duplicada (três cópias da regra do
nome das separatrizes que discordavam entre si; duas listas de módulos). Um
token que muda no desenho e não no CSS não é design system, é ficção.

**O que este documento absorveu.** A parte de design que vivia em
`docs/ui-references/ARQUITETURA.md` (§1 shell, §6 animações e vidro, apêndices
F/G/H) está aqui. Aquele documento segue válido como **arquitetura de frontend**
— estados, contratos, plano de construção —, não como referência visual.

---

## 1. Norte criativo — "O instrumento calibrado, com um agente dentro"

O Nexo produz a documentação de projetos de engenharia: lê o carimbo das
pranchas, monta LD, capa, separatriz e volume, e audita o memorial. A linguagem
visual vem de interfaces de terminal e de instrumentos industriais de medição:
escura, contida, densa de informação, com um único acento técnico. Cada pixel
justifica o lugar. Cor é indicador funcional, não decoração. A tipografia impõe
disciplina: proporcional para texto, monoespaçada para dado, rótulo, código e
horário.

Há uma segunda natureza, que o instrumento sozinho não explica: **existe um
agente aqui dentro**, e ele precisa ter presença. É o que o orbe faz (§6). A
tensão entre as duas — instrumento preciso e presença viva — se resolve por
território, não por mistura: o ambiente pode respirar; o dado nunca.

**O sistema rejeita:** templates de dashboard SaaS, gradientes roxos ou azuis,
cartões decorativos grandes, métricas-herói coloridas, e qualquer ornamento sem
função. Sombra é mínima e estrutural. Bordas definem superfícies; profundidade
vem de camadas tonais.

**Características:**
- Escuro por padrão, alto contraste, ambiente operacional.
- Cor contida: neutros tingidos + um acento (teal) em menos de 10% de qualquer tela.
- Tipografia técnica: IBM Plex Sans para ler, IBM Plex Mono para integridade do dado.
- Grade base de 4px; todo espaçamento é múltiplo de 4.

---

## 2. Cor

A paleta ancora num quase-preto levemente frio. Separa cor em famílias
funcionais que **nunca se cruzam de significado**: **teal é interativo**, **os
três sinais são status**, **rust/salmão é ênfase**. Essa separação é a
disciplina central — um elemento teal é sempre algo em que se pode agir; nunca é
um status.

### Primária — interativo (rampa teal)

Significa uma coisa só: interatividade. Ação primária, seleção atual, foco, dado
ativo. Nunca status, nunca decoração, nunca preenchimento passivo. Menos de 10%
de qualquer tela, por projeto.

- **Technical Teal** (`#00a693`): ações primárias, anel de foco, seleção de dado ativo, estado atual de navegação.
- **Bright Teal** (`#5bdac6`): brilho do anel de foco, indicadores de progresso, hover sobre elementos teal.
- **Luminous Teal** (`#7af7e1`): degrau mais brilhante — realce de seleção e brilho interativo de alta ênfase.

### Sinal — status (verde / âmbar / coral)

As três cores de sinal significam status e nada mais. São perceptualmente
distintas para que a severidade de um achado se leia num relance — o trabalho
central do produto. Nunca aparecem em controles interativos.

- **Signal OK** (`#6ee7a3`): conforme, "sem problemas". Um verde-menta técnico, deliberadamente fora da família teal, para que "aprovado" nunca pareça "clicável".
- **Signal Warning** (`#e9b45c`): "ponto de atenção", severidade baixa. Âmbar quente — cautela sem alarme.
- **Signal Critical** (`#ff9285`): problema, erro. Coral, claramente mais vermelho que o âmbar. Firme sem virar alarme agressivo.

### Terciária — ênfase (rust / salmão)

Só estados de ênfase, nunca status. Análise "Profundo" ativa, acento de modo
demo, cartões de chamada para ação.

- **Rust Salmon** (`#dc7858`) · **Salmon Pink** (`#ffb59e`).

### Neutros

- **Base Dark** (`#0a0e11`): fundo da aplicação. A superfície mais profunda.
- **Panel Surface** (`#121518`): cartões, barras laterais, modais, cabeçalhos.
- **Recessed Dark** (`#06080a`): campos, textareas, fundo de controle segmentado. Mais escuro que o fundo, para parecer embutido.
- **Raised Gray** (`#1a1e21`): hover, painéis secundários, superfícies elevadas.
- **On Surface** (`#e1e7ea`): texto primário. · **Muted Gray** (`#8e9ba3`): texto secundário, metadado, rótulo inativo.
- **Border Divider** (`#23282c`): toda borda estrutural.
- **Destructive Coral** (`#ff9285`): ações destrutivas. Compartilha o tom do Signal Critical de propósito — perigo é uma cor só no sistema, seja status ou ação.

### Tokens canônicos de status

Cor de status só é consumida por estas variáveis — nunca hex cru, nunca classe
de paleta do Tailwind (`bg-yellow-*`), nunca nome inventado. **Não existe**
`--status-danger` nem `--status-warn`; qualquer referência a eles é bug.

| Semântica | Texto/borda | Fundo |
|-----------|-------------|-------|
| OK | `--status-ok` `#6ee7a3` | `--status-ok-bg` |
| Atenção | `--status-warning` `#e9b45c` | `--status-warning-bg` |
| Crítico | `--status-critical` `#ff9285` | `--status-critical-bg` |

O padrão canônico é `<Badge variant="ok|warning|critical">`. Use o componente;
não escreva as classes à mão.

### Vagas abertas — cores que ainda não existem

Ampliar a paleta é bem-vindo **desde que cada cor nova ganhe um trabalho**. Cor
sem função declarada é o que transforma sistema em paleta. Há quatro vagas com
trabalho real hoje, e nenhuma tem valor decidido — os valores saem de ver
renderizado, não de escolher no escuro:

1. **Informação / neutro-ativo** — avisos que não são status (dica, contexto que o agente oferece). Hoje viram `warning` por falta de opção, e diluem o significado do âmbar.
2. **Legado / congelado** — as ferramentas antigas e o que não se deve evoluir. Hoje: nada; parecem iguais ao resto.
3. **Disciplina (escala categórica)** — o canvas agrupa folhas por tomo e disciplina usando só borda. Precisa de uma escala que **nunca colida** com os três sinais.
4. **Escala de dado (sequencial)** — donut de consumo e gráficos futuros. Não pode ser a rampa teal, que significa interatividade.

**Regra para admitir uma cor nova:** ela tem nome, tem trabalho declarado, tem
token em `globals.css`, e passa no teste de não ser confundível com um sinal de
status a três metros da tela.

### Regras nomeadas

**Regra do acento único.** Teal significa interativo. Só. Nunca status, nunca
decoração, nunca fundo, nunca em estado inativo. "OK" é verde, não teal.

**Regra da separação de sinais.** Os três sinais são perceptualmente distintos e
reservados a status. Atenção e Crítico jamais podem convergir de matiz — quem lê
distingue os dois sem ler o rótulo.

**Regra da disciplina terciária.** Rust e salmão são ênfase. Não são status e não
aparecem em fundo de página nem em elemento passivo.

---

## 3. Tipografia

**Texto:** IBM Plex Sans. **Rótulo e dado:** IBM Plex Mono. Uma família só, duas
faces — as métricas são harmônicas, então o contraste entre texto proporcional e
dado mono lê como um sistema calibrado, não como duas fontes costuradas.

### Hierarquia

A rampa proporcional é contínua, sem buracos: todo caso intermediário tem um
degrau nomeado, para que nenhuma tela invente um tamanho fora da escala
(`text-[11px]`, `text-[15px]`). Os degraus ficam ~1,2–1,35× entre si.

- **Display** (600, 40px, 1.1, -0.02em): título-herói. Só a tela de login.
- **Headline** (500, 24px, 1.2, -0.01em): título de página, cabeçalho de seção (h2).
- **Title** (500, 18px, 1.4): título de cartão, cabeçalho de componente (h3).
- **Subtitle** (500, 16px, 1.4): subseção, lead enfatizado.
- **Body** (400, 14px, 1.5): texto de leitura, descrições, conclusões. Máx. 65–75ch.
- **Caption** (400, 12px, 1.4, muted): metadado em prosa, texto de ajuda.

Mono corre num eixo paralelo de dois degraus:

- **Mono Label** (500, 12px, 1.0, +0.05em): rótulos de UI, cabeçalhos de seção, nomes de campo, texto de badge. Microrrótulos podem cair a 11px, nunca abaixo.
- **Mono Data** (400, 13px, 1.4): valores numéricos, horários, códigos, nomes de arquivo, IDs.

### Regras nomeadas

**Regra da disciplina do mono.** Todo elemento que carrega dado estruturado
(horário, nome de arquivo, código de documento, contagem, tempo decorrido) usa
IBM Plex Mono. O Sans é para títulos, parágrafos e conclusões.

**Regra dos algarismos tabulares.** Todo dado numérico usa algarismos tabulares
para alinhar em coluna e não tremer quando o valor muda. Alinhamento numérico é
integridade de dado, não enfeite. Um número que pode mudar ou ser comparado é
sempre tabular.

---

## 4. Elevação, vidro e a linha d'água

Profundidade vem de **camadas tonais e bordas**, não de sombra. Bordas são
sempre 1px de largura inteira; borda lateral colorida como faixa é proibida.

1. **Nível 0 — fundo:** `#0a0e11`.
2. **Nível 1 — painéis:** `#121518`. Cartões, barras, cabeçalhos. Sempre com borda `#23282c`.
3. **Nível 2 — ativo/hover:** deslocamento para `#1a1e21` ou borda em direção ao anel.
4. **Nível 3 — campos:** `#06080a`. Embutidos, abaixo do fundo.
5. **Nível 4 — sobreposição:** dropdown, popover, tooltip, modal. Fundo de painel + borda 1px + `shadow-subtle`. É o único nível em que sombra é estrutural: não há camada tonal capaz de separar uma superfície flutuante de um conteúdo arbitrário atrás dela.

### Brilho de aresta — profundidade sem sombra

Superfícies elevadas e interativas carregam **1px de brilho interno no topo**,
um fio de luz vindo de cima. Lê como usinagem de precisão, não como vidro.

- `--edge-highlight`: `inset 0 1px 0 rgb(255 255 255 / 0.04)`. Só em elevado/interativo: botões, cartão em hover, sobreposições de Nível 4. **Nunca** em painel plano em repouso, campo embutido ou faixa passiva.

Sombras ficam em três tokens estruturais, usados com parcimônia:

| Token | Valor | Uso |
|-------|-------|-----|
| `--shadow-panel` | `0 1px 2px rgb(0 0 0 / 0.35)` | Definição de aresta quando a camada tonal não basta. |
| `--shadow-subtle` | `0 1px 1px rgb(0 0 0 / 0.25)` | Elevação mínima do Nível 4. |
| `--shadow-overlay` | `--edge-highlight` + `--shadow-panel` | Sobreposição que também precisa do fio de luz. |

### A linha d'água — a regra única do vidro

Esta é a regra completa. Ela substitui a antiga proibição categórica de
glassmorphism **e** a emenda escopada que a revertia em parte: as duas juntas
faziam quem lesse rápido concluir o oposto do que vale.

> **Acima da linha d'água — o cromo — pode ser vidro. Abaixo dela — o dado —
> é sempre matte.**

**Cromo (lista fechada; nada entra sem alterar este documento):** o backdrop de
escurecimento do modal, o dock do composer, o *wash* da tela de boas-vindas, a
bolha do assistente (como invólucro), o cromo do visualizador de PDF e o orbe.

**Dado (jamais):** cartões, achados de auditoria, tabelas, molduras de artefato,
`ConfirmationCard`, miniaturas. Nunca borrar o que se lê.

**Tokens** — derivados dos existentes, **nunca cor nova**:

| Token | Valor |
|-------|-------|
| `--glass-blur` | `12px` |
| `--glass-tint` | `rgb(18 21 24 / 0.62)` (= `--card` a ~62%) |
| `--glass-tint-weak` | `rgb(18 21 24 / 0.52)` — bolha do assistente |
| `--glass-edge` | `inset 0 1px 0 rgb(255 255 255 / 0.07)` — um degrau acima do `--edge-highlight` |
| `--glass-ring` | `rgb(91 218 198 / 0.14)` (= `--ring` a ~14%) |

**Implementação:** `<GlassPanel>` é o único lugar com `backdrop-filter` fora do
backdrop do modal. Degrada para `--card` sólido quando `backdrop-filter` não é
suportado ou quando `prefers-reduced-transparency: reduce`. O tint alto é piso de
contraste: texto ≥4,5:1 mesmo com conteúdo rolando atrás.

**Por quê essa fronteira:** premium é precisão mais alguns momentos ambientais —
não vidro em tudo. Borrão sobre dado é o oposto do que este produto vende.

---

## 5. Movimento

**Movimento significa mudança de estado, não decoração.** Isto é instrumento de
trabalho usado em sessões longas, não uma página que se assiste carregar. Não há
sequências de entrada coreografadas por elemento.

| Token | Valor | Uso |
|-------|-------|-----|
| `--duration-fast` | `120ms` | Resposta de interação: hover, clique, foco. |
| `--duration-base` | `180ms` | Revelações, dropdowns. |
| `--duration-slow` | `240ms` | Drawer, modal — superfícies maiores. |
| `--duration-shell` | `320ms` | Só a macrotransição do shell (boas-vindas ↔ ativo). |
| `--ease-feedback` | `cubic-bezier(0.25, 1, 0.5, 1)` | Resposta e saídas. |
| `--ease-entrance` | `cubic-bezier(0.22, 1, 0.36, 1)` | Superfícies entrando. |

Saídas correm a ~75% da entrada. Toda animação usa **só `transform` e
`opacity`** — nunca propriedade de layout.

**Camada-fonte em JS:** `modules/nexo/lib/motion.ts` espelha os tokens e expõe
`useReducedMotion()`. O gate em JS é necessário porque a media query CSS não
desliga `startViewTransition` nem FLIP.

**O conjunto canônico:**
- **Revelação de conteúdo:** um único `reveal` (`--duration-base`, fade + 6px em Y), uma vez por bloco recém-chegado — nunca em cascata pelos filhos.
- **Resposta:** transições de hover/foco em `--duration-fast`; clique é `translateY(1px)`. É aqui que a ferramenta parece responsiva; priorize isto sobre revelações.
- **Progresso:** `audit-progress` (1,4s) e `status-pulse` (1,8s) — contínuos porque sinalizam estado em andamento.
- **Drawer:** entra em `--duration-slow`, sai mais rápido; backdrop em fade.
- **Sobreposição:** `--duration-base`, escala a partir do topo (dropdown) ou escala+fade (modal).

**Coordenação com a macrotransição:** durante os ~320ms do shell, movimento
contínuo (orbe, shimmer) é **congelado** — senão duplica no cross-fade do
snapshot.

**Segurança.** `prefers-reduced-motion: reduce` desliga toda animação. Movimento
é sempre melhoria, nunca carrega significado sozinho.

---

## 6. O orbe — a presença do agente

O orbe não é enfeite nem logotipo aplicado na tela: é **a representação visual do
agente**, e a partir dela nasce a marca. É o único elemento do sistema autorizado
a ser vivo.

### A escada de reduções

Não existe favicon com shader. O orbe precisa existir em três níveis, e os três
têm de ser reconhecíveis como o **mesmo objeto** — é isso que transforma efeito
em identidade.

| Nível | O que é | Onde | Custo |
|-------|---------|------|-------|
| **Vivo (3D)** | React Three Fiber + shaders próprios (`modules/nexo/components/agent-orb/`) | Palco / entrada. Uma instância por tela, nunca duas. | Alto (three.js) |
| **CSS** | Gradiente radial teal→luminous mascarado (`NexoOrb`) | Barra lateral, marca inline, bolhas | Zero |
| **Estático (SVG)** | Esfera de vidro com o nó aceso dentro, **afinada por tamanho** (`components/brand/logo-nexo.tsx`) | Logo, favicon, impressão, fundo claro | Zero |

**Regra:** um orbe vivo por tela. Quando o palco tem o orbe 3D, todo o resto usa
a redução em CSS. Onde o fundo não é escuro, só a versão achatada.

### Os estados

O orbe **diz o que o agente está fazendo**. Um orbe que gira igual o tempo todo é
decoração — e decoração o sistema rejeita na primeira página. Os estados reais
(`use-agent-state.ts`), em ordem de prioridade:

| Estado | Quando | Leitura |
|--------|--------|---------|
| `error` | falha no turno ou na leitura (transiente, 2,2s) | instabilidade curta, depois estabiliza |
| `dragging` | arquivo sendo arrastado sobre a interface | atenção, receptivo |
| `reading` | lendo os selos das pranchas | trabalho de entrada |
| `responding` | já está escrevendo (primeiro delta chegou) | fala |
| `analyzing` | turno em andamento | pensa |
| `auditing` | auditoria de memorial em curso (minutos, fora do turno de chat) | percorre um documento longo |
| `complete` | terminou sem erro (transiente, 1,2s) | pulso breve |
| `waiting` | o agente falou e a resposta não veio em 6s | a bola está com você |
| `idle` | em repouso | pronto |

**Sobre `auditing`.** Ele fica **abaixo** de `analyzing` de propósito: um turno
de chat ao vivo assume a esfera, e a auditoria a retoma ao terminar — quem
digitou uma pergunta agora espera resposta agora, e o palco já mostra a análise
correndo. A distinção visual é a **varredura**: contínua, de baixo para cima
(`uScanMode = 1` no shader de superfície), contra o vaivém senoidal de
`reading`. Ler um lote de selos é mesmo um ir e vir entre folhas; auditar um
memorial percorre capítulos, e uma banda que volta diria que o agente
reconsidera o que já passou.

Antes de existir, a auditoria entrava como `thinking`. Isso tirava a esfera do
`idle` — que era o problema conhecido —, mas com a cara errada: `analyzing` é o
gesto de um turno de segundos, e sustentá-lo por seis minutos lê como
travamento. `hover` e `uploading` saíram da tabela no mesmo movimento: a máquina
nunca produziu nenhum dos dois (hover é reação física, upload e leitura são o
mesmo gesto), e estado inalcançável no enum é promessa que o produto não cumpre.

**Sobre `waiting`.** Ele fica **abaixo** de `complete`: terminar e passar a bola
são dois momentos, e o pulso de conclusão é o que marca o primeiro — trocados, o
"pronto" sumiria dentro da espera. Os **seis segundos** de silêncio antes de
entrar não são estética: sem atraso, o estado piscaria no fim de todo turno, no
vão entre o último caractere do agente e a primeira tecla do humano. A distinção
visual é a **cadência**: `breathRate` entrou em `OrbVisualParams` e `waiting` usa
metade do ritmo de repouso (0,75 contra 1,5). O rótulo do cartão **não pulsa** —
esperar não é trabalho do agente, é trabalho de quem está lendo.

A fase do respiro é **integrada** (`fase += dt · taxa`) e não calculada de
`tempo · taxa`: com o relógio já valendo centenas de segundos, mudar a taxa
jogaria o seno para outro ponto qualquer do ciclo, e o miolo daria um pulo no
instante exato em que o agente passasse a esperar.

### Reações físicas (não são estados)

Duas coisas mexem no orbe sem passar pela máquina, porque não são o que o agente
está fazendo — são o que **você** está fazendo:

| Reação | Prop | Efeito |
|--------|------|--------|
| Ponteiro sobre o orbe | `hovered` | aro +0,18, escala +3%, órbita dos satélites aperta |
| Cursor no composer | `ouvindo` | aro +0,10 — "estou ouvindo" |

Os dois **somam com teto** no valor do hover: focar o campo com o mouse parado
sobre o orbe é o caso comum, e dois realces empilhados estouram o aro.

### O que o aro mede

Durante `reading`, um arco de 1px (raio 1,14–1,17, começando no topo) fecha 360°
conforme as folhas entram. A banda de `scan` já dizia que o Nexo está lendo, mas
banda é textura, não medida: com 23 pranchas ou com 200 ela varre igual, e
"falta quanto?" continuava sem resposta na esfera. O arco é **fração**, e é isso
que faz 200 folhas caberem no mesmo desenho de 23.

### O erro, e por que ele não tem cor

`error` é **batimento duplo** (duas contrações rápidas + pausa, ciclo de 1,6s)
somado ao `jitter` que já existia. Tingir o aro de coral foi considerado e
**recusado**: seria cor de status num elemento interativo, e romperia a
iridescência teal que é a identidade. A lei prende o orbe à rampa — então a
expressão do erro é temporal, não cromática. O corpo lê ritmo antes de a cabeça
ler rótulo.

### O boot

Uma vez por **carregamento** (flag de módulo, não de instância): o miolo acende
de zero em ~600ms, o aro sobe com atraso, e o giro nasce alto e assenta. O
atraso do aro é o que separa "liga e então acende" de um fade comum. Navegar
entre telas **não** re-liga — o orbe remonta o tempo todo no welcome ↔ active, e
um boot por montagem viraria pisca-pisca. Um F5 re-liga, e é o correto.

A esfera não conhece IA nem API: `useAgentState` traduz sinais da aplicação em
estado visual. Manter essa separação é o que permite trocar o motor sem redesenhar
a presença.

**Cor:** a iridescência é só teal→luminous→neutro. Nunca rust, roxo ou neon — o
orbe é grande, e romper aqui estoura o orçamento de 10% do acento.

**Movimento reduzido:** com `prefers-reduced-motion`, o orbe congela num estado
final legível — não em `0.01ms`, que produz um piscar.

### Marca

O logotipo é o **orbe estático** — esfera de vidro escura com o nó aceso dentro
— mais a palavra "Nexo" em IBM Plex Sans 600. O símbolo sozinho serve de favicon
e de avatar.

### A afinação por tamanho (2026-08-06)

Antes, a marca era uma **silhueta em traço**, sem brilho nem gradiente, e esta
seção proibia "reproduzir o brilho do orbe 3D em tamanho pequeno (vira mancha)".
A proibição estava certa sobre o sintoma e errada sobre a causa: o que vira
mancha não é o vidro, é o vidro DESENHADO IGUAL em todo tamanho.

O logotipo passa a ser o orbe com corpo, luz de aresta e nó aceso — o mesmo
objeto que o palco mostra, parado. O que o faz sobreviver aos 16px é a
**afinação**: quanto menor, mais o corpo clareia e mais o nó pesa. Aos 16px quem
carrega a leitura é o nó e o anel, não o volume do vidro, que naquele tamanho
ninguém enxerga de todo jeito.

**A regra que não se quebra:** o bordo da esfera NUNCA chega ao preto do fundo
(`#0a0e11`). Esfera escura sobre fundo escuro perde a silhueta, e o que sobra é
o desenho de linha que esta marca veio substituir — aconteceu aos 48px na tela
de login, com a faixa "grande" começando cedo demais.

Três faixas, em `logo-nexo.tsx`: **≥96px** (herói, vidro profundo) · **40–95px**
(interface) · **<40px** (favicon e ícone inline). O `public/assets/logo.svg`
carrega a faixa pequena, porque é onde ele vive; mudou lá, mude aqui.

**O que continua proibido:** colorir fora da rampa teal (o orbe é grande, e
romper aqui estoura o orçamento de 10% do acento) e usar a faixa grande em
tamanho pequeno.

---

## 7. Componentes — matriz de estados e primitivos

### A matriz de estados

Todo componente interativo define os mesmos sete estados com o mesmo
vocabulário. Componente que sobe sem um deles está incompleto — um hover
significa a mesma coisa num botão e numa linha de tabela.

| Estado | Tratamento |
|--------|------------|
| **Repouso** | Plano; profundidade por borda + tom de superfície. |
| **Hover** | Elevação tonal sutil (→ `#1a1e21`) ou borda em direção ao anel; elementos ghost passam de muted para foreground. `--duration-fast`. Nunca uma mudança dramática de cor. |
| **Foco** | O anel único do sistema, **desenhado POR DENTRO do chanfro**: a moldura vira `#5bdac6` e o miolo recua de 1px para 3px, seguindo o corte. Por `:focus-visible` (teclado), nunca `:focus` cru. Idêntico em todo componente. Em superfície recortada, `outline` e `box-shadow` externo são **cortados** pelo `clip-path` — um anel por fora deixaria o controle sem foco visível nenhum, e por isso o ring global de `box-shadow` se desliga ali. **Miolo transparente não mascara:** variante sem forma (fantasma, chip quieto, item de lista) precisa de miolo opaco no foco, senão o teal preenche o controle inteiro. |
| **Pressionado** | `translateY(1px)` + leve escurecimento. `--duration-fast`. |
| **Selecionado / atual** | Borda teal + fundo preenchido. Teal marca a coisa atual. |
| **Desabilitado** | Opacidade **50%**, `pointer-events: none`, sem hover. Uma opacidade canônica só — não 45% num componente e 50% noutro. |
| **Carregando** | Escopado ao componente e estável no layout: o botão mantém a largura e troca o rótulo por um spinner inline ("Gerando…"); uma região de conteúdo mostra skeleton. Nunca spinner estacionado sobre conteúdo, nunca salto de largura. |
| **Erro** | Campo muda a borda para Signal Critical com texto de ajuda crítico abaixo — não uma troca silenciosa de cor do anel. |

**Somente-leitura ≠ desabilitado.** Campo somente-leitura mostra o valor em
contraste normal, sem afordância de edição; campo desabilitado cai a 50%. Nunca
use o estilo de desabilitado para dizer "não editável agora".

### Os 16 primitivos

`button` · `badge` · `card` · `chip` · `checkbox` · `input` · `label` ·
`textarea` · `table` · `tooltip` · `separator` · `skeleton` · `dropdown` ·
`empty-state` · `glass-panel` · `agent-popover`

**O contorno é uma CAMADA, não uma borda.** `clip-path` não aceita `border`:
nas duas diagonais ela seria cortada. Onde havia `border: 1px solid var(--border)`
agora o **fundo do elemento é a cor da borda** e um `::before` recortado a 1px é
o miolo (`.nx-edge-*` em `globals.css`; as cores entram por `--nx-edge` e
`--nx-fill`). Superfície sem contorno continua sendo uma forma só (`.nx-cut-*`) —
não crie a camada sem necessidade. Campo nativo (`input`, `textarea`) é a única
exceção que ainda usa wrapper de verdade: ele não renderiza `::before`.

**Botões.** Corte 8/7/6, rótulo em mono 600 caixa alta (`0.06em`). Três alturas:
**44** (ação de turno), **40** (padrão), **32** (denso). *Primary:* `#00a693`
chapado, texto escuro, hover a `#00bda7`, pressionado a `#00877a` — nunca
enfraquecer o botão no hover. *Outline / Secondary:* moldura `#2c3338`, miolo
`#121518` / `#1a1e21`, mais o marcador de canto no hover. *Ghost:* sem forma,
texto muted, **miolo opaco no foco**. Hover traz a lâmina: `skewX(-30deg)`, 160%
de largura, 300ms — e ela não anima sob `prefers-reduced-motion`.

**Chips / segmentados.** Corte 6, rótulo mono 12px. Era pílula (`rounded-full`)
até a spec do chanfro: duas geometrias competindo na mesma tela não são um
sistema. O nível "Profundo" usa rust em vez de teal quando selecionado — é
ênfase, não status.

**Cartões.** Corte 8, fundo `#121518`, padding 12px (16px em painéis). Com
contorno usa a camada; chapado (`flat`) é uma forma só. Sem elemento flutuante
sem borda. **Nunca cartão dentro de cartão** — use divisores dentro de um
contêiner só.

**Campos.** Corte 7 no wrapper, moldura `#2c3338`, miolo `#06080a`, altura 40px
(32px compacto). Foco: o anel único, por dentro. Textarea igual.

**Badge.** Corte 5 e **sem** camada de contorno: as variantes têm fundo e borda
translúcidos, e numa camada o miolo comporia sobre a cor da borda em vez de
sobre a página — toda variante de status mudaria de cor.

**Elevação de sobreposição.** `box-shadow` externo morre no recorte, e `filter`
no próprio elemento também (é aplicado **antes** do `clip-path`). A sombra tem
de vir de `filter: drop-shadow()` num **pai não recortado** (`.nx-elev`), onde
ela segue a silhueta chanfrada do filho.

**Tooltip.** `max-w-xs`, fundo de cartão, `shadow-subtle`, mono 12px, atraso de
300ms. Obrigatório em todo controle só-ícone.

**Tabelas.** Superfície primária: o padrão favorece **ver muitas linhas de uma
vez**. Densidade compacta por padrão (`px-3 py-2.5`, ~40px por linha).
Separação por borda inferior de 1px — **só réguas horizontais**, sem divisor
vertical, sem zebra. Cabeçalho em Mono Label maiúsculo, fixo no rolar. Colunas
numéricas à direita, em Mono Data tabular. Coluna de status renderiza `<Badge>`,
não texto colorido. Carregando: linhas de skeleton na forma das colunas. Vazia:
o tratamento de estado vazio dentro do corpo da tabela, nunca um "0 resultados".

**Skeletons.** Conteúdo carregando aparece como **esqueleto da forma final**,
nunca spinner no meio da tela — o esqueleto reserva o layout para nada saltar
quando o dado chega. Shimmer é uma varredura sutil e lenta, nunca um pulso
brilhante. Spinner só dentro de botão.

**Estados vazios.** Um estado vazio **ensina a interface**; nunca diz apenas
"nada aqui". Estrutura: um Mono Label nomeando a região, uma linha de Body
explicando o que vai aparecer ali e como fazer aparecer, e — quando há próximo
passo — uma única ação primária. Sem ilustração grande, sem emoji, sem tom de
marketing. Vazio é neutro; falha usa o vocabulário de Signal Critical.

**Iconografia.** `lucide-react` exclusivamente, linha apenas, `strokeWidth={1.5}`
global (mais fino que o padrão da biblioteca — lê como instrumento de precisão).
Escala: 14px (inline denso), **16px padrão**, 20px (ênfase), 24px (raro). Cor por
`currentColor`: teal só quando o ícone **é** a afordância interativa; muted
quando passivo; token de sinal quando carrega status. Só-ícone é permitido
apenas para glifos universais (fechar, chevron, busca) e sempre com tooltip.

---

## 8. Padrões compostos do Nexo

Esta é a superfície principal do produto e a que menos tinha especificação. Os
componentes existem em `modules/nexo/components/`; as regras abaixo são o
contrato visual deles.

**Shell de três colunas.** `barra lateral (240px) | palco | copiloto (520px)`,
larguras em `--nexo-sidebar-w` e `--nexo-copilot-w`, com divisor arrastável. Dois
modos: **boas-vindas** (orbe e composer centrados, sem palco) e **ativo** (as três
colunas). A transição entre eles é a única que usa `--duration-shell`.

**Barra lateral.** Marca (orbe CSS + "Nexo") no topo; nova conversa; busca;
histórico agrupado em pastas por obra, recolhíveis; rodapé com o resto do
software (Projetos, admin, conta) e, por último e menor, "Ferramentas antigas" —
saída de emergência não compete com o caminho bom.

**Composer.** Dock em `GlassPanel` com anel teal no foco. Duas variantes da
**mesma instância**: herói (boas-vindas) e ancorado (ativo). Zona de solta
visível e overlay de tela cheia no arrastar.

**Bolhas.** Usuário: matte. Assistente: `GlassPanel` sutil **como invólucro** —
mas todo dado dentro dela permanece matte, inclusive o cartão de confirmação.

**Cartão de confirmação.** O padrão central do produto: proposta → parâmetros
**somente-leitura** → [Confirmar e gerar] / [Corrigir] → resultado com downloads.
Correção acontece **na conversa**, não em formulário dentro do cartão — é o que
mantém o registro do que foi decidido. Três estados: *proposta* (ainda não
gerado), *pendente* (params mudaram desde a geração — o documento envelheceu) e
*aplicado*. O estado pendente precisa ser visível: documento velho passando por
novo é o erro mais caro que esta tela pode cometer.

**Chips de resposta rápida.** Pré-respostas abaixo da bolha, nunca formulário.
Dois compromissos: *preencher* (escreve no composer, o engenheiro edita) e
*enviar* (manda direto).

**Canvas.** Nó de artefato (miniatura renderizada, ações no nó selecionado), nó
de folha (texto puro — 200 folhas com miniatura viraria um trabalho sobre
performance), fileiras por tomo, navegação e editor do nó. Marca de "corrigido à
mão" só quando o **texto** foi reescrito, nunca por arrastar — posição não é
leitura de carimbo.

**Palco.** Auditoria em curso com progresso, cancelar e retomada após F5. Trabalho
longo do servidor não pode parecer perdido porque a aba recarregou.

**Consumo.** Donut de tokens e custo — dado, portanto matte, e numa escala de cor
que não é a rampa teal.

---

## 9. Superfícies herdadas

**Resultado de auditoria.** Cabeçalho com badge de status, resumo de
achados/arquivos/tempo, próxima ação como título enfatizado, abas segmentadas.
Grade de métricas em cartões compactos. Cartão de achado: um contêiner só, com
seções internas separadas por borda — evidência, conflito e ação como blocos
adjacentes, nunca cartões aninhados.

**Ferramentas antigas** (`/ld`, `/capas`, `/separatrizes`, `/volumes`). Precisam
dizer visualmente que são legado, sem parecer quebradas. Hoje: um rótulo no
cabeçalho. Quando a vaga de cor "legado" for preenchida (§2), é aqui que ela
entra.

---

## 10. Acessibilidade

- **Foco visível** em tudo, com o anel único, por `:focus-visible`.
- **Contraste** AA (≥4,5:1) para texto — inclusive sobre vidro, garantido pelo piso de tint.
- **Alvo de toque** confortável; ícone sozinho sempre com rótulo acessível.
- **Teclado**: navegação completa e os atalhos existentes (`Ctrl+G`, `Ctrl+A`, `Ctrl+L`, `Ctrl+Shift+A`, `?`).
- **`prefers-reduced-motion`**: desliga animação; o orbe congela legível.
- **`prefers-reduced-transparency`**: vidro vira sólido.
- **`.sr-only`** canônica em `globals.css` para rótulos que só o leitor de tela precisa.

---

## 11. Faça e não faça

### Faça
- Use o chanfro do sistema, sempre em superior esquerdo + inferior direito, pelas classes `.nx-cut-*` / `.nx-edge-*`. Nunca escreva `clip-path` à mão num componente: o valor vem de um lugar só.
- Use IBM Plex Mono para todo dado estruturado: horário, nome de arquivo, contagem, ID, código.
- Separe seções com borda de 1px em largura inteira, nunca com faixa lateral colorida.
- Mantenha o teal abaixo de 10% da superfície de qualquer tela.
- Use camadas tonais para profundidade, não sombra.
- Consuma cor de status por `--status-*` e pelo `<Badge variant>`.
- Mostre esqueleto da forma final enquanto uma região carrega.
- Dê algarismos tabulares a todo dado numérico.
- Deixe o orbe **dizer** o estado do agente.

### Não faça
- Não use roxo, azul ou gradiente neon em superfície nenhuma.
- Não borre dado: vidro é só para o cromo da lista fechada (§4).
- Não use borda lateral maior que 1px como faixa de acento.
- Não aninhe cartão dentro de cartão.
- Não anime propriedade de layout (width, height, top, left).
- Não use texto com gradiente.
- Não crie grades de cartões idênticos (mesmo ícone + título + texto repetidos).
- Não use emoji na interface.
- Não recorra a modal como primeira solução; esgote as alternativas inline.
- Não use teal para status, nem cor de sinal em controle interativo.
- Não deixe Atenção e Crítico convergirem de matiz.
- Não referencie `--status-danger` nem `--status-warn` — não existem.
- Não estacione spinner numa região de conteúdo; use esqueleto.
- Não coloque dois orbes vivos na mesma tela.

---

## 12. Governança

**Como mudar o sistema.** Toda mudança entra em `app/globals.css` **e** neste
documento, no mesmo commit. Componente novo nasce com os sete estados da matriz.
Token novo nasce com nome, valor e trabalho declarado.

**A armadilha conhecida do CSS.** Regra escrita fora de `@layer` vence as
utilities do Tailwind e mata `border-*` silenciosamente — já aconteceu neste
projeto. Ao acrescentar CSS global, verifique a camada antes de culpar o
componente.

**O que fiscaliza.** Hoje: revisão humana e este documento. O sistema ainda não
tem teste automático de contrato visual — quando tiver, ele mora aqui.

### Decisões que o sistema v0 propôs e NÃO valem (2026-07-30)

O sistema de design produzido na ferramenta (`docs/design-system-v0/`) foi
aplicado por inteiro, com quatro exceções. Estão aqui porque exceção que vive só
na cabeça de quem implementou volta como "bug" na próxima revisão.

1. **Fio de luz (`--edge-highlight`) no cartão em repouso.** O CSS entregue põe;
   a §4 deste documento proíbe em painel plano parado. Vale a §4: o fio marca
   superfície ELEVADA ou interativa, e se ele aparecer em tudo deixa de marcar
   qualquer coisa.
2. **`#21262a` no hover do chip.** Hex solto, que o próprio critério de aceite do
   sistema proíbe. Vale o token `--accent`.
3. **Composer em vidro puro com anel teal no foco.** Duas tentativas anteriores
   já falharam por motivo observado: o vidro puro SOME sobre o fundo quase-preto
   da tela de boas-vindas (não há nada atrás para refratar) e o anel teal VIRA
   NEON num campo dessa largura. Vale o que está no `globals.css`: superfície
   elevada com borda de campo, e o foco só clareando a borda.
4. **Nó não-abrível a 50% de opacidade.** Depois de um F5 os bytes das pranchas
   não voltam, então TODA folha fica não-abrível — o canvas inteiro a 50%
   pareceria desabilitado estando perfeitamente funcional. A ação "Abrir"
   continua desabilitada, com o motivo no tooltip.
