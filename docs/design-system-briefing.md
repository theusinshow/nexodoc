# Briefing de produção do design system — tudo que precisa ser desenhado

Lista completa e conferida contra o código em 2026-07-30. Serve para produzir o
sistema numa ferramenta de design (Open Design) sem descobrir buraco no meio do
caminho.

## Como ler este briefing

**O que NÃO se discute** (já decidido, sai do software para a ferramenta):
a paleta e a gramática de cor, a regra do vidro (linha d'água), o orbe como
identidade, a família tipográfica e a grade de 4px. Está tudo em
[`DESIGN.md`](../DESIGN.md). A ferramenta redesenha a **execução**, não as regras.

**O que a ferramenta devolve** (Parte 10): tokens importáveis, uma folha por
componente com todas as variantes e estados, os mockups de tela e o kit de marca.

**Critério de pronto** (Parte 11): um item só está pronto com os 8 estados, o
contraste verificado e o comportamento responsivo definido. Componente com só o
estado de repouso não conta.

**A conta**: 9 grupos de fundamentos · 3 níveis de marca · 16 primitivos ·
28 elementos do chat e do canvas · 12 peças de shell · 19 telas · 9 estados
transversais.

---

# PARTE 1 — Fundamentos

Extrair do software, redesenhar, devolver como token.

## 1.1 Cor — 17 valores existentes

| Família | Tokens |
|---|---|
| Interativo (teal) | `technical-teal #00a693` · `bright-teal #5bdac6` · `luminous-teal #7af7e1` |
| Status (3 sinais) | `signal-ok #6ee7a3` · `signal-warning #e9b45c` · `signal-critical #ff9285` + os 3 fundos (`--status-*-bg`) |
| Ênfase (rust) | `rust-salmon #dc7858` · `salmon-pink #ffb59e` |
| Neutros | `base-dark #0a0e11` · `panel #121518` · `recessed #06080a` · `raised #1a1e21` · `secondary #15191c` · `on-surface #e1e7ea` · `muted #8e9ba3` · `border #23282c` · `input-bg #2c3338` |
| Destrutivo | `#ff9285` (mesmo tom do crítico, de propósito) |

**4 vagas a criar** — cada uma com valor, token e fundo tingido:
1. **Informação / neutro-ativo** (aviso que não é status)
2. **Legado / congelado** (ferramentas antigas)
3. **Disciplina** — escala categórica de 6–10 passos para o canvas, que **não** pode colidir com os 3 sinais
4. **Dado** — escala sequencial para donut e gráficos, que **não** pode ser a rampa teal

**Entregar também:** matriz de contraste (todo par texto/fundo ≥4,5:1) e a prova
visual da regra "teal ocupa menos de 10% da tela".

## 1.2 Tipografia — 8 estilos

IBM Plex Sans: `display 40/1.1/-0.02em/600` · `headline 24/1.2/-0.01em/500` ·
`title 18/1.4/500` · `subtitle 16/1.4/500` · `body 14/1.5/400` ·
`caption 12/1.4/400`.
IBM Plex Mono: `mono-label 12/1.0/+0.05em/500` (mín. 11px) · `mono-data 13/1.4/400`.

Entregar: a escala aplicada, regra de largura máxima (65–75ch no body) e a regra
de algarismos tabulares.

## 1.3–1.9 Demais fundamentos

| Grupo | O que definir |
|---|---|
| **Espaçamento** | Grade de 4px; escala `4/8/12/16/24`; densidade de tabela vs. cartão |
| **Raio** | `8px` (tudo) e `12px` (xl). Nenhum outro valor existe |
| **Elevação** | 5 níveis tonais + `--edge-highlight` (fio de luz 1px) + 3 sombras (`panel`, `subtle`, `overlay`) |
| **Vidro** | 5 tokens (`blur 12px`, `tint`, `tint-weak`, `edge`, `ring`) + a lista fechada de 6 superfícies + o degradê para sólido |
| **Movimento** | 6 tokens (`fast 120` · `base 180` · `slow 240` · `shell 320` · 2 eases) + as 5 animações canônicas |
| **Layout** | Sidebar 240px · copiloto 520px · divisor arrastável · breakpoints · comportamento em tela estreita |
| **Ícones** | lucide, traço 1.5, 4 tamanhos (14/16/20/24), regra de cor |

---

# PARTE 2 — Marca

## 2.1 O orbe — 3 níveis × 7 estados = 21 peças

| Nível | Onde | Formato de entrega |
|---|---|---|
| **Vivo (3D)** | Palco / entrada | Especificação de movimento e cor por estado (a execução é R3F) |
| **CSS** | Sidebar, inline, bolhas | Redução estática por estado |
| **Achatado (SVG)** | Logo, favicon, impressão, fundo claro | Vetor final |

Os 7 estados: `idle` · `dragging` · `reading` · `analyzing` · `responding` ·
`complete` (transiente 1,2s) · `error` (transiente 2,2s).

## 2.2 Logo e aplicações

Símbolo isolado · lockup horizontal com "Nexo" · versão empilhada · favicon
(16/32/180px) · versão monocromática · versão para fundo claro · área de respiro
· tamanho mínimo · lista do que **não** fazer.

---

# PARTE 3 — Os 16 primitivos

Cada um com **todas as variantes × 8 estados** (repouso, hover, foco,
pressionado, selecionado, desabilitado, carregando, erro).

| # | Primitivo | Variantes reais no código |
|---|---|---|
| 1 | **Button** | `default` · `destructive` · `outline` · `secondary` · `ghost` × tamanhos `default h-10` · `sm h-9` · `lg h-11` · `icon` |
| 2 | **Badge** | `default` · `secondary` · `outline` · `ok` · `warning` · `critical` |
| 3 | **Chip** | `suggest` · `default` · `quiet` (variantes por INTENÇÃO, não por cor) |
| 4 | **Card** | Padrão · com cabeçalho · com divisores internos (nunca cartão dentro de cartão) |
| 5 | **Input** | Padrão `h-10` · compacto `h-8` · com prefixo/sufixo · erro |
| 6 | **Textarea** | Padrão · redimensionável · contador |
| 7 | **Label** | Sans · mono-label |
| 8 | **Checkbox** | Marcado · desmarcado · indeterminado |
| 9 | **Table** | Cabeçalho fixo · densidades compacta/densa · coluna numérica · coluna de status · linha selecionada/hover · skeleton · vazia |
| 10 | **Tooltip** | 4 posições · com atalho de teclado |
| 11 | **Separator** | Horizontal · vertical |
| 12 | **Skeleton** | Linha · bloco · cartão · linha de tabela · miniatura |
| 13 | **Dropdown** | Item · item com ícone · destrutivo · separador · desabilitado |
| 14 | **EmptyState** | Neutro · com ação · dentro de tabela |
| 15 | **GlassPanel** | Tint padrão · tint fraco · fallback sólido |
| 16 | **AgentPopover** | Ancorado ao nó · ao orbe · com formulário curto |

---

# PARTE 4 — Elementos do chat (o coração do produto)

## 4.1 Composer e entrada

| Elemento | Estados a desenhar |
|---|---|
| **NexoComposer** | Variante **herói** (boas-vindas, centrado) e **ancorado** (ativo) — a mesma instância. Vazio · digitando · com anexos · enviando · desabilitado · erro |
| **Dropzone** | Repouso · arrastando sobre a tela (overlay de tela cheia) · soltando · arquivo recusado |
| **AttachmentChip** | Enfileirado · lendo (progresso) · lido · erro · papel corrigido à mão · removível |
| **Anexos** (lista) | 1 arquivo · vários · com rolagem |
| **TitulosLidos** | Resumo do que foi lido dos carimbos |

## 4.2 Conversa

| Elemento | Estados |
|---|---|
| **MessageBubble — usuário** | Matte. Curta · longa · com anexos |
| **MessageBubble — assistente** | GlassPanel sutil como invólucro. Escrevendo (streaming, cursor) · completa · erro · cancelada |
| **QuickReplyChips** | Sugerido (fio teal) · comum · silencioso. Compromisso *preencher* vs *enviar* |
| **Orbe no chat** | Ver Parte 2 |
| **AgentStatusPopover** | O que o agente está fazendo, ancorado ao orbe |

## 4.3 As caixas de confirmação — 6 tipos × 3 estados

O padrão central: proposta → parâmetros **somente-leitura** → [Confirmar e gerar]
/ [Corrigir] → resultado com downloads. Os 3 estados de cada caixa:
**proposta** (ainda não gerado) · **pendente** (params mudaram; o documento
envelheceu — precisa gritar) · **aplicado**.

| Caixa | Conteúdo específico |
|---|---|
| **LD** | Título, nº de tomos, tomo inicial + **FolhaPreview** (prévia das linhas) |
| **Capa** | Título, prefeitura, volume, tomos, mês, ano |
| **Separatriz** | Título herdado da capa · **lista de disciplinas** quando em lote |
| **Volume** | **PartRow** por parte (capa/separatriz/LD/pranchas), ordem, contagem de páginas |
| **Conferência** | **CheckResult**: veredito ok/aviso/crítico + achados |
| **Auditoria** | Nível (padrão/profunda), memorial anexado, **AuditoriaAncora** |

**Peças compartilhadas de toda caixa** (desenhar uma vez, valem para as 6):
`CardShell` (moldura + selo de tomo + estado) · `SummaryRow` (rótulo/valor, com
variante "faltando") · `AlterChip` · `ConfirmButton` (repouso/ocupado/aplicar
alteração) · `CardError` · `ResultLinks` (downloads, com arquivo primário).

## 4.4 Plano de geração

**PlanoDeGeracao** + **Linha**: a lista do que será gerado antes de confirmar em
lote. Estados: pendente · gerando · gerado · falhou.

---

# PARTE 5 — Canvas

| Elemento | Estados |
|---|---|
| **ArtifactNode** | Repouso · selecionado · desatualizado · sem prévia · gerando |
| **ArtifactThumb** | Carregando (skeleton na forma final) · renderizado · erro · sem PDF |
| **FolhaNode** | Repouso · selecionado · corrigido à mão (marca) · sem número · não abrível |
| **RotuloNode** | Rótulo de fileira/tomo |
| **AcaoDoNo** | Ação no nó selecionado (abrir, corrigir), habilitada e desabilitada com motivo |
| **EditorDoNo** | Popover de edição: campos, aviso ao mudar, aplicar/cancelar |
| **NavegacaoDoCanvas** | Navegar entre tomos, criar tomo, voltar ao automático |
| **Fileira de tomo** | Vazia · com folhas · recebendo arraste |
| **Seleção múltipla e arraste** | Marca de seleção, fantasma do arraste, alvo de solta |

---

# PARTE 6 — Shell e navegação (12 peças)

| Peça | O que desenhar |
|---|---|
| **NexoShell** | Modo boas-vindas ↔ modo ativo + a macrotransição de 320ms |
| **ShellSplitter** | Divisor arrastável: repouso, hover, arrastando |
| **NexoSidebar** | Marca · nova conversa · busca (vazia/com resultado/sem resultado) · histórico em pastas por obra (aberta/fechada) · item ativo · excluir · rodapé (Projetos, admin, conta, ferramentas antigas) |
| **NexoCopilot** | Painel direito com o orbe e o estado do agente |
| **PalcoDoNexo** | O centro: vazio · com canvas · com auditoria em curso |
| **AuditoriaEmCurso** | Progresso, etapa atual, tempo, cancelar, passou do tempo previsto, retomada pós-F5 |
| **UsageDonut** | Consumo de tokens/custo |
| **NexoDebugDrawer** | Gaveta de dev (atrás de env) |
| **AppShell** | Cabeçalho com marca + módulo + rótulo de versão |
| **PageHeader** | Título, descrição, ações |
| **Stepper** | Passos das telas antigas |
| **AdminNav / AdminPageShell** | Navegação do painel admin |

---

# PARTE 7 — Telas (19 mockups)

| Rota | Estados a entregar |
|---|---|
| `/nexo` | **Boas-vindas** (orbe centrado, composer herói) · **ativo com canvas** · **ativo com auditoria** · lendo selos · erro · tela estreita |
| `/login` | Repouso · entrando · erro · sem permissão |
| `/ferramentas` | Lista de legado |
| `/projetos` | Lista · vazia · carregando |
| `/projetos/[id]` | Console do projeto, faixa de contexto, ações, artefatos, eventos |
| `/admin` | Painel |
| `/admin/users` · `/admin/lds` · `/admin/audits` · `/admin/usage` · `/admin/quality` · `/admin/config` | Cada uma: tabela cheia, vazia, carregando |
| `/` (flag off) | Painel de módulos — só sobrevive como kill-switch |
| **Legado** `/ld` · `/ld/historico` · `/capas` · `/separatrizes` · `/volumes` | Tratamento visual de "congelado". Não redesenhar o miolo |

---

# PARTE 8 — Auditoria (a superfície mais densa)

| Elemento | O que desenhar |
|---|---|
| **AuditProgress** | Barra indeterminada, etapas, tempo decorrido |
| **AuditResult — cabeçalho** | Badge de status geral, resumo (achados/arquivos/tempo), próxima ação, abas segmentadas |
| **Grade de métricas** | 2–4 cartões compactos |
| **Cartão de achado** | Um contêiner com seções internas por borda: evidência, conflito, ação. Por severidade (3) |
| **Evidência** | Trecho com marcação, imagem exportável |
| **AuditPdfViewer** | Cromo do visualizador (pode ter vidro), página, navegação, busca |
| **Feedback do achado** | "não identificado", formulário curto |

---

# PARTE 9 — Estados transversais (9)

Valem para toda tela e todo componente; entregar como página de padrões:
vazio · carregando (skeleton) · erro de conteúdo · erro de campo · offline /
servidor fora · sem permissão · sessão expirada · `prefers-reduced-motion` ·
`prefers-reduced-transparency`.

---

# PARTE 10 — O que a ferramenta devolve

1. **Tokens** em formato importável, com o nome exato das variáveis CSS já em uso (`--status-ok`, `--glass-tint`, `--duration-shell`, …) — nome divergente vira trabalho de tradução e depois vira bug.
2. **Uma folha por componente**: variantes × 8 estados, com as medidas.
3. **Mockups das 19 telas**, nos estados listados.
4. **Kit de marca**: orbe nos 3 níveis, logo, favicon, aplicações.
5. **Especificação de movimento**: o que anima, com qual token, em qual gatilho.
6. **Matriz de contraste** provando o AA, inclusive sobre vidro.

---

# PARTE 11 — Critério de pronto

Um item está pronto quando:

- Tem os **8 estados** da matriz (ou justifica por escrito os que não se aplicam).
- Respeita a **gramática de cor**: teal só interativo, sinais só status, rust só ênfase.
- Respeita a **linha d'água**: vidro só no cromo da lista fechada; dado sempre matte.
- Passa em **contraste AA** (≥4,5:1), medido, não estimado.
- Define o comportamento em **tela estreita**.
- Usa **só tokens** — nenhum valor solto de cor, tamanho, raio ou duração.
- Tem **anti-exemplo**: o "não faça assim" é o que impede o sistema de ser burlado.
