# Propostas UX/UI aprovadas — spec corrigida contra o código

**Data:** 2026-08-13
**Origem:** `docs/propostas-evolucao-ux-ui.md` (escrito pelo Kimi, 35 itens).
**Decisão do mantenedor:** aprovado tudo, **menos a 2.29** (prontuário da obra).
**Status:** SPEC. É daqui que cada plano de `docs/superpowers/plans/` argumenta.

Este documento existe porque o original foi escrito contra um retrato
desatualizado do repositório. Ele conserva a numeração (o mantenedor aprova por
número), mas corrige o veredito de cada item, fecha os que já estão feitos e
agrupa o resto em lotes do tamanho de um PR.

## As leis, que valem para todo lote

Copiadas do original porque continuam certas, e valem sem repetição item a item:

- **DESIGN.md §12:** mudança visual entra em `app/globals.css` **e** no
  `DESIGN.md` no mesmo commit. Token novo nasce com nome, valor e trabalho
  declarado.
- Teal é interativo e nada mais (<10% da tela). Status só pelos tokens
  `--status-ok|warning|critical` e `<Badge variant>`. Rust/salmão só ênfase.
- Vidro só no cromo da lista fechada (§4). Dado é sempre matte.
- Movimento: só `transform`/`opacity`, tokens de duração existentes, e
  `prefers-reduced-motion` sempre respeitado.
- Chanfro (superior esquerdo + inferior direito) via `.nx-cut-*` / `.nx-edge-*`;
  nunca `clip-path` à mão.
- Nada de emoji, nada de cartão dentro de cartão, nada de faixa lateral > 1px,
  nada de spinner parado em região de conteúdo (skeleton da forma final).
- Dado estruturado em IBM Plex Mono com algarismos tabulares.
- Núcleo puro (só `import type`) mora em `lib/` e ganha teste
  `scripts/test-*.ts` que roda em node cru. Prova de navegador é
  `scripts/prova-*.mjs` (Playwright), sai com código 1 quando falha.

---

## Parte A — Premissas do documento original que o código contradiz

Cinco erros de premissa. Cada um derruba notas de dependência espalhadas pelo
original, e por isso vêm antes dos lotes.

### A.1 — As quatro "vagas de cor abertas" já estão preenchidas em código

`DESIGN.md:238-250` diz que há quatro vagas e que *"nenhuma tem valor
decidido"*. `app/globals.css:157-200` tem as quatro, com valor, comentário e
trabalho declarado:

| vaga (§2) | token | valor | consumido por |
|---|---|---|---|
| 1. Informação / neutro-ativo | `--signal-info` `-bg` `-border` | `#7fb2e8` | `<Badge variant="info">`, `AuditoriaEmCurso`, `FaixaDeEstado`, `aviso-sem-acesso` |
| 2. Legado / congelado | `--legacy` `-bg` `-border` | `#9d94ab` | `<Badge variant="legacy">`, `app/ferramentas/page.tsx`, `NexoSidebar:1045` |
| 3. Disciplina (categórica) | `--discipline-arq…pai` | 8 tons | `modules/nexo/lib/disciplina-cor.ts` |
| 4. Escala de dado (sequencial) | `--data-1…5` | rampa azul | **ninguém** |

**A vaga 4 é a única com trabalho pendente**, e o pendente é uma violação ativa:
`UsageDonut.tsx:19-25` pinta as fatias com `var(--ring)` e duas transparências
do teal, sob um docblock que assume o desvio (*"Escala do teal do sistema —
distinção, não semântica"*). Isso contradiz a Regra do Acento Único do §2 e a
própria razão de existir do `--data-*` (*"Azul, nunca teal: teal significa
interativo, e barra de gráfico não se clica"*).

**Consequência:** as notas de dependência de **1.3, 2.9, 2.15, 2.22** ("depende
de decidir a vaga de cor") são falsas — não há nada a decidir. E a **2.27** está
feita.

### A.2 — Restou uma ferramenta antiga, não quatro

O original manda tratar `app/ferramentas/`, `app/ld/`, `app/capas/`,
`app/separatrizes/`, `app/volumes/`. As três do meio **não existem mais**.
`app/ferramentas/page.tsx:61-75` já explica: *"Eram cinco; restou uma"* — e a
que sobrou (`/volumes`) não é dívida, é um trabalho que o Nexo não faz (monta
volume de PDFs soltos; o Nexo monta o que ele mesmo gerou).

### A.3 — `use-delta-do-memorial` é pré-auditoria, não pós

O original supõe que a 2.19 é "quase só exibição". O hook existe
(`modules/nexo/components/use-delta-do-memorial.ts`) mas mora no
`ConfirmationCard.tsx:2207` e compara **texto do memorial** × impressão digital
anterior, para decidir se vale **pagar** a reauditoria. Não compara achados.
Delta no topo do parecer é comparar dois `AuditReport` — trabalho novo.

### A.4 — A barra de leitura não sinaliza falha, e isso é de propósito

O original diz que `BarraDeLeitura.tsx` "já sinaliza falha no canvas". O arquivo
diz o contrário, com argumento: *"O ERRO NÃO ENTRA AQUI… aviso em barra de
progresso não tem o que se faça a respeito"*. A 2.22 tem que respeitar isso: a
régua pode virar índice navegável sem virar mostrador de erro.

### A.5 — Não há `Command` de biblioteca no projeto

`components/ui/` é artesanal (17 primitivos, sem `cmdk`, sem Radix Command). A
1.1 é componente do zero, e é por isso que ela desce na ordem.

---

## Parte B — Itens já feitos (fechados, não viram trabalho)

| # | onde está | observação |
|---|---|---|
| **2.6** pulso na sidebar | `NexoSidebar.tsx:297` (`nexodoc-status-pulse`) | completo |
| **2.10** diff no pendente | `lib/pendencia.ts` (`mudancasDoArtefato`) + `ConfirmationCard.tsx:438-443` | completo, em mono tabular |
| **2.13** minimapa | `NexoCanvas.tsx:951-962` | **rejeitado com autópsia**: `MiniMapNode` do xyflow descarta nó sem dimensão declarada e o mapa saía vazio. Não reabrir sem resolver isso primeiro |
| **2.27** cor de legado | `--legacy-*` + `<Badge variant="legacy">` em `app/ferramentas/page.tsx:97-105` | completo (ver A.2: é uma tela, não quatro) |
| **2.12** chips do fluxo | `lib/next-steps.ts` + `QuickReplyChips.tsx` | feito na versão enxuta; refinar entra no Lote 7 |
| **2.3** projeto de demonstração | `lib/projeto-exemplo.ts` (375 linhas) | existe com outra forma: memorial fabricado com pdf-lib + parecer escrito à mão, semeado pelo caminho de conversa restaurada. Ampliar entra no Lote 7 |

## Parte C — Itens com metade do caminho andado

| # | o que já existe | o que falta |
|---|---|---|
| **1.6** artefato sem bytes | o aviso, em `ResultLinks.tsx` (`saved.bytesAusentes`) | **só o botão Regenerar**. Hoje o texto manda regerar e não oferece o gesto |
| **2.11** recibo do drop | `NexoWorkspace.tsx:545-551` nomeia as folhas que falharam na conversa; `lib/estado-do-anexo.ts` dá estado por arquivo | o formato de recibo (`200 recebidos · 198 lidos · 2 falharam`) |
| **1.2** proveniência | `parse-filename.ts` é autoritativo e `FolhaNode.tsx:154` já marca "corrigido à mão" | origem **por campo** não existe: `classify-documents.ts` guarda confiança por *arquivo*. Entregar primeiro a versão de três origens (nome do arquivo / carimbo / mão), não `folha 07 · canto inferior direito` |
| **2.17** modo selo | a caixa do carimbo já é medida por âncoras (`server/nexo/selo-regiao.ts`) e recortada (`lib/selo-render-crop.ts`) — mas só para a IA | levar a mesma geometria ao visor humano |

---

## Parte D — Os lotes, na ordem de execução

Cada lote é um PR e um plano em `docs/superpowers/plans/`. A ordem é por
valor/custo medido no código, não pela do documento original.

| lote | itens | por que aqui | plano |
|---|---|---|---|
| **0** | A.1 + **1.5** | dívida de governança: fecha a dessincronia `globals.css` × `DESIGN.md`, tira o teal do donut e registra o glossário. Destrava 1.3/2.9 sem decisão pendente | `2026-08-13-vagas-de-cor-e-glossario.md` |
| **1** | **2.17**, **2.18** | o visor vira instrumento. Geometria pronta (Parte C) — é reuso, não invenção | |
| **2** | **1.6**, **2.11** | as duas metades da Parte C que fecham em uma tarde cada | |
| **3** | **2.19**, **2.20**, **2.21** | fecha o loop de valor da auditoria: o que mudou, o que custa, o que se entrega em papel | |
| **4** | **2.16**, **2.14**, **2.15** | o canvas vira conferível: teclado primeiro (barato e independente), zoom depois, coluna da LD por último | |
| **5** | **1.2**, **1.3**, **2.9** | proveniência e trace. Depende do Lote 0 (`--signal-info` documentado como a cor de "informação") | |
| **6** | **2.7**, **2.8** | a sidebar informa. Cuidado com N+1 por pasta | |
| **7** | **2.4**, **2.5**, **2.3**+ | onboarding: checklist, partidas e ampliação do demo. **2.5 e 1.1 dividem** o suporte a intenção inicial na rota `/nexo` — nasce aqui | |
| **8** | **1.1** | command palette, sobre a intenção inicial do Lote 7. Componente do zero (A.5) | |
| **9** | **2.22** | régua vira índice, respeitando A.4 | |
| **10** | **2.28** | banner de ponte para o Nexo. Uma tela só (A.2), sobre a intenção inicial do Lote 7 | |
| **11** | **2.24**, **2.25**, **2.26** | admin: tabela de saúde, funil de calibração, custo por obra. **2.26 pode exigir schema** (vínculo uso × obra) | |
| **12** | **1.4**, **2.1**, **2.2**, **2.23** | acabamento: favicon vivo, selo e gabarito do login, orbe "aguardando você" | |

### Dependências reais (as do original, corrigidas)

- ~~1.3 e 2.9 dividem a decisão de cor~~ → **não há decisão**: `--signal-info`
  existe e tem consumidor. O Lote 0 só documenta.
- ~~2.15 e 2.22 dependem da vaga disciplina~~ → **não dependem**:
  `lib/disciplina-cor.ts` existe, com sigla mono como portador primário.
- **2.5, 2.28 e 1.1 dependem do mesmo suporte a intenção inicial em `/nexo`** —
  isso continua verdade, e por isso o Lote 7 vem antes do 8 e do 10.
- **1.6 não depende da decisão de storage.** O caminho determinístico de
  regeneração já existe; o botão só o chama. (A 2.29, que dependia mesmo, saiu.)
- **2.26 é o único item que pode tocar o schema Prisma.**

### Fora de escopo

- **2.29** (prontuário da obra) — retirado pelo mantenedor.
- Cor nova fora dos quatro tokens já existentes.
- Mudança de stack, de modelo de IA ou de pipeline de geração.
- Tema claro, dashboard de métrica-herói, emoji.
- Qualquer coisa que viole os três princípios do produto (fato determinístico;
  afirma fatos e pergunta decisões; nada irreversível sem confirmação).
