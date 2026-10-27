---
name: Nexo
description: Assistente que produz a documentação de projetos de engenharia — do carimbo ao volume
sistema: ds (sistema novo, desde 01/10/2026)
fonte-executavel: app/ds.css
substitui: "o tema teal + chanfro + IBM Plex (até 30/09/2026) — NÃO usar"
colors:
  # superfícies, do fundo para a frente
  surface-page: "#08090b"
  surface-sunken: "#0c0d10"
  surface-card: "#121317"
  surface-raised: "#181a1f"
  surface-overlay: "#1f2127"
  # texto
  text-primary: "#eeeff2"
  text-secondary: "#a4a8b3"
  text-tertiary: "#8a8f99"
  text-on-paper: "#0a0b0d"
  text-on-paper-muted: "#575c66"
  # linhas: luz, não cor (branco em alfa, desenhado por dentro)
  line-subtle: "rgb(255 255 255 / 0.07)"
  line-default: "rgb(255 255 255 / 0.12)"
  line-strong: "rgb(255 255 255 / 0.18)"
  # a cor do Nexo: a ÚNICA cor viva (aro do orbe)
  nexo: "#c3a3ff"
  nexo-strong: "#9a6cf0"
  nexo-soft: "#e2d4ff"
  focus-ring: "#c3a3ff"
  # ação principal: pílula de PAPEL claro, não colorida
  action-bg: "#f2f3f5"
  action-bg-hover: "#ffffff"
  action-fg: "#0a0b0d"
  # gravidade de achado (ordem de calor = ordem de gravidade)
  sev-block: "#ff7d6e"
  sev-risco: "#f99a5f"
  sev-decide: "#f0b45c"
  sev-note: "#8e99ae"
  sev-texto: "#86b6f0"
  # estado do sistema
  state-ok: "#7bd8a5"
  state-info: "#7fb2e8"
  state-attention: "#f0b45c"
  state-error: "#ff7d6e"
  # disciplinas (identificam a folha/achado; nunca viram cor de interface)
  disc-arq: "#8fa9d0"
  disc-est: "#a79ac9"
  disc-fnd: "#c2ad86"
  disc-hid: "#79b6c4"
  disc-ele: "#c9b47f"
  disc-pci: "#cf9a9a"
  disc-cli: "#c99ab8"
  disc-ter: "#c4a58f"
  disc-pai: "#a3bd8a"
  disc-cab: "#d6a472"
  disc-gas: "#86c4a8"
  disc-ace: "#7fa7e6"
  disc-ger: "#9aa2b1"
typography:
  family-sans: "Geist (variável, lib/ds/arquivos-de-fonte) → --font-ds-sans"
  family-mono: "Geist Mono (variável) → --font-ds-mono — só para dado de verdade"
  display: { fontSize: "44px", fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1.05 }
  3xl: { fontSize: "32px", fontWeight: 400, letterSpacing: "-0.035em", lineHeight: 1.1 }
  2xl: { fontSize: "24px", fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.2 }
  xl: { fontSize: "20px", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.25 }
  lg: { fontSize: "17px", fontWeight: 500, letterSpacing: "-0.015em" }
  md: { fontSize: "15px", fontWeight: 400 }
  sm-corpo: { fontSize: "14px", fontWeight: 400, lineHeight: 1.5 }
  xs: { fontSize: "14px", fontWeight: 400 }
  2xs: { fontSize: "12.5px", fontWeight: 400 }
  mono: { fontSize: "12px", fontWeight: 400 }
radius:
  # por PAPEL, não por tamanho. Não existe chanfro.
  tag: "6px"
  control: "10px"
  row: "12px"
  card: "16px"
  panel: "18px"
  composer: "22px"
  pill: "999px"
spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
elevation:
  edge: "inset 0 0 0 1px var(--ds-line-subtle)"
  edge-strong: "inset 0 0 0 1px var(--ds-line-default)"
  shadow-float: "inset 0 0 0 1px var(--ds-line-default), 0 12px 32px -10px rgb(0 0 0 / 0.7)"
  shadow-overlay: "inset 0 0 0 1px var(--ds-line-default), 0 24px 60px -12px rgb(0 0 0 / 0.8)"
motion:
  press: "80ms"
  feedback: "120ms"
  state: "180ms"
  enter: "240ms"
  layout: "320ms"
  ease-out: "cubic-bezier(0.22, 1, 0.36, 1)"
  ease-feedback: "cubic-bezier(0.25, 1, 0.5, 1)"
  ease-move: "cubic-bezier(0.65, 0, 0.35, 1)"
  ease-exit: "cubic-bezier(0.4, 0, 1, 1)"
---

# Design System — Nexo (sistema `ds`)

> **Se você veio aqui para copiar o desenho do Nexo: copie ESTE.**
> Grafite quase preto, **violeta** só onde o Nexo está vivo, ação principal em
> **pílula de papel claro**, cantos **arredondados por papel**, **Geist**.
>
> **O sistema antigo morreu em 01/10/2026** e não deve ser reproduzido: teal
> (`#00a693`, `#5bdac6`), **chanfro** (`.nx-cut-*`, `.nx-edge-*`, `--cut-*`),
> IBM Plex, vidro com "linha d'água", rust/salmão como ênfase. Se encontrar
> qualquer um deles num documento, num componente ou numa memória, é resto da
> migração — não é referência.

## 0. Onde mora a verdade

| O quê | Onde | Papel |
|---|---|---|
| Tokens e estilos de base | `app/ds.css` | **A verdade executável.** Tudo com prefixo `--ds-` e sob `.ds`. |
| Componentes React | `components/ds/` | `basicos.tsx`, `micro.tsx`, `graficos.tsx`, `medidas.tsx`, `serie-com-meta.tsx`, `avatar-da-pessoa.tsx`, `fundo-liquido.tsx` |
| Movimento em JS | `lib/ds/movimento.ts` | Os mesmos tempos do CSS, para o `motion` (durações, curvas, molas). |
| Fontes | `lib/ds/fontes.ts` | Geist e Geist Mono servidas do repositório (`FONTES_DS`). |
| Ver ao vivo | `/lab/fundamentos` | Cada token lido do `ds.css` — o que se aprova é o que o código usa. |
| Telas aprovadas | `/lab/telas/*`, `/lab/inventario`, `design-lab/aprovacoes.json` | O desenho de cada tela, com as situações aprovadas. |
| A lei que explica | este arquivo | Diz o que cada token **significa** e onde vale. |

**Regra de ouro.** Uma decisão de desenho só existe depois de entrar no
`app/ds.css` **e** aqui, no mesmo commit. Valor solto em componente
(`#c3a3ff` escrito à mão) é dívida: use o semântico.

**Duas camadas, e a ordem importa.**
- **Primitivos** (`--ds-p-*`): os valores crus. **Ninguém fora do `ds.css` os usa.**
- **Semânticos** (o resto): o papel da cor. Componente usa só estes. Trocar um
  tom é trocar o primitivo; trocar o sentido é trocar o semântico.

**Escopo `.ds`.** Os estilos de base e os componentes `ds-*` só valem dentro de
um ancestral com a classe `.ds` (junto com `FONTES_DS` para a fonte carregar).
Elemento solto no `body` (portal, overlay) precisa da classe `.ds` também — e
herda o `zoom` de tela grande (ver §9).

### O que ainda é do sistema antigo, e por quê

A migração (`migração 1..5`, 01–02/10/2026) passou a moldura, o Admin, Projetos,
Projeto, Painel, Ajuda, Achados, a entrada e o Nexo para o `ds`. Parte do Nexo
ainda é Tailwind lendo as variáveis antigas de `app/globals.css`; a
**pele do Nexo** (`components/telas/nexo/pele-do-nexo.css`) aponta essas
variáveis para os tokens do `ds` (o "primário" antigo vira o papel claro, o
acento vira o violeta, o chanfro vira canto redondo). Por isso a tela já
**parece** o sistema novo.

- **Código novo nunca usa** `--primary`, `--accent`, `--ring`, `bg-primary`,
  `nx-cut-*`, `nx-edge-*`, `font-plex-*`. Usa `--ds-*` e as classes `ds-*`.
- Peça redesenhada passa a usar o `ds` direto e deixa de depender da pele.
- Quando a última peça migrar, o tema antigo sai do `globals.css` e o `ds.css`
  vira o único.
- `--prefeitura-*` (marca de cada município) continua no `globals.css` e é
  **preservada**: é dado da obra, não tema.

---

## 1. Norte — "uma ferramenta lida por horas, com um agente dentro"

O Nexo produz a documentação de projetos de engenharia: lê o carimbo das
pranchas, monta LD, capa, separatriz e volume, e audita o memorial. A tela é
**grafite, quieta e densa**: o documento manda, e a interface se cala para ele
aparecer. Existe um agente aqui dentro, e ele tem **uma** cor — a do aro do
orbe. Quando o violeta aparece, é o Nexo.

### Os seis princípios (decidem o que nenhuma especificação prevê)

1. **Uma cor viva, com sentido.** O violeta diz só quatro coisas: o Nexo está
   aqui, o Nexo está trabalhando, isto está selecionado, isto tem foco. Nunca
   decora. Usar o violeta para enfeitar gasta o único sinal que a tela tem.
2. **A ação principal é clara.** Uma pílula de papel claro por tela, no
   máximo. Se há duas, uma delas não é a principal.
3. **Movimento responde a uma pergunta.** O que mudou, para onde foi, deu
   certo, está trabalhando. Animação que não responde a nenhuma não entra.
4. **O documento manda.** Código de obra, página, revisão e carimbo aparecem
   como o engenheiro os escreve. Mono só para dado de verdade.
5. **Sem rótulo em caixa alta.** Hierarquia vem de tamanho, peso e espaço.
   Caixa alta grita e deixa a leitura mais lenta.
6. **O que é da obra é da obra.** Cor de prefeitura e de disciplina identificam
   a obra e o documento; nunca viram cor de interface.

**O sistema rejeita:** teal, chanfro, vidro decorativo, gradiente colorido de
fundo, cartão-herói colorido, métrica gigante tingida, sombra cinza clara,
brilho colorido, rótulo em caixa alta com letter-spacing, ícone em círculo
colorido acima de título, e qualquer ornamento sem função.

---

## 2. Cor

### Superfícies — cinco planos físicos

| Token | Valor | Papel |
|---|---|---|
| `--ds-surface-page` | `#08090b` | O chão de toda tela. |
| `--ds-surface-sunken` | `#0c0d10` | O que afunda: trilho, barra lateral, poço de campo, área de soltar. |
| `--ds-surface-card` | `#121317` | Grupo de conteúdo: projeto, achado, parecer. |
| `--ds-surface-raised` | `#181a1f` | O que se ergue: item selecionado, linha aberta, menu. |
| `--ds-surface-overlay` | `#1f2127` | O que flutua: diálogo, popover, aviso. Sempre com sombra. |

O componente escolhe o plano **pelo que ele é**, não pela aparência que se quer.
Os neutros são frios, com um fio de azul.

### Texto — três tons

| Token | Valor | Papel |
|---|---|---|
| `--ds-text-primary` | `#eeeff2` | Títulos, conteúdo, o que se lê. |
| `--ds-text-secondary` | `#a4a8b3` | Explicação, metadado útil. |
| `--ds-text-tertiary` | `#8a8f99` | Hora, contagem, dica. O mínimo legível: 6,1:1 na página, 4,8:1 no overlay. |
| `--ds-text-on-paper` | `#0a0b0d` | Texto sobre a pílula clara. |
| `--ds-text-on-paper-muted` | `#575c66` | Texto fraco sobre papel (ex.: tecla dentro do botão claro). |

O piso de 4,5:1 vale em **todos** os planos de uso. Não invente um quarto cinza.

### Linhas — borda é luz, não cor

`--ds-line-subtle` (7%), `--ds-line-default` (12%), `--ds-line-strong` (18%):
branco em alfa, **desenhado como sombra interna** (`box-shadow: inset 0 0 0 1px …`).
Não ocupa pixel de layout, então ícone e texto não desalinham quando a borda
aparece. Não use `border: 1px solid` cinza para contorno de cartão/botão.

### A cor do Nexo — violeta

| Token | Valor | Papel |
|---|---|---|
| `--ds-nexo` | `#c3a3ff` | Presença, trabalho em curso, seleção, link. (Aro do orbe.) |
| `--ds-nexo-strong` | `#9a6cf0` | Preenchimento: barra de progresso, chave ligada. |
| `--ds-nexo-soft` | `#e2d4ff` | Lâmina clara, texto sobre véu violeta. |
| `--ds-nexo-wash` | violeta 10% | Fundo de selo do Nexo, conversa ativa. |
| `--ds-nexo-line` | violeta 35% | Contorno de "previsto", coluna de hoje. |
| `--ds-focus-ring` | `#c3a3ff` | O anel de foco. |

### Ação principal — papel claro

`--ds-action-bg` `#f2f3f5` (hover `#ffffff`) com `--ds-action-fg` `#0a0b0d`.
A ação principal **não usa cor**: assim ela e o violeta nunca disputam. Uma por
tela. A recusa/alternativa é botão fantasma (contorno de luz).

### Gravidade do achado

Os degraus do parecer, com os nomes que o parecer já usa. Cada um tem cor
cheia, véu (`-wash`, ~12%) e contorno (`-line`, ~28%). A cor cheia **nunca
aparece sem o texto dizendo o degrau**. A rampa de calor segue a ordem da
gravidade.

| Token | Valor | Degrau |
|---|---|---|
| `--ds-sev-block` | `#ff7d6e` | Bloqueia a emissão — corrigir antes de gerar. |
| `--ds-sev-risco` | `#f99a5f` | Risco na execução (16/10/2026). |
| `--ds-sev-decide` | `#f0b45c` | Exige decisão técnica — precisa de aceite do responsável. |
| `--ds-sev-note` | `#8e99ae` | Observação — não muda a decisão técnica. |
| `--ds-sev-texto` | `#86b6f0` | Redação e gramática — cor própria para não se confundir com o técnico. |

### Estado do sistema

O que o sistema diz sobre si. Mesmo tom da gravidade em atenção e erro, mas
**papel diferente**: "salvo só nesta máquina" não é um achado.

`--ds-state-ok` `#7bd8a5` (gravado, corrigido, volume montado) ·
`--ds-state-info` `#7fb2e8` (comparado com a auditoria anterior) ·
`--ds-state-attention` `#f0b45c` (salvo só nesta máquina, análise parcial) ·
`--ds-state-error` `#ff7d6e` (não deu para abrir, falhou). Cada um com `-wash`.

### Disciplinas — preservadas

Dessaturadas e distinguíveis. Identificam folha e achado pela disciplina; nunca
viram cor de botão. Aparecem pelo **selo de disciplina** (`.dc`: ponto + sigla
mono, na cor da disciplina) e no avatar da equipe.

| Sigla | Disciplina | Token |
|---|---|---|
| ARQ | Arquitetônico | `--ds-disc-arq` `#8fa9d0` |
| EST | Estrutural | `--ds-disc-est` `#a79ac9` |
| FND | Fundações (grupo estrutural, cor própria) | `--ds-disc-fnd` `#c2ad86` |
| HID | Hidrossanitário | `--ds-disc-hid` `#79b6c4` |
| ELE | Elétrico, CFTV | `--ds-disc-ele` `#c9b47f` |
| PCI | Preventivo de incêndio | `--ds-disc-pci` `#cf9a9a` |
| CLI | Climatização | `--ds-disc-cli` `#c99ab8` |
| TER | Terraplenagem — e drenagem, pavimentação, sinalização, urbanização (a sigla separa, a paleta não cresce) | `--ds-disc-ter` `#c4a58f` |
| PAI | Paisagismo | `--ds-disc-pai` `#a3bd8a` |
| CAB | Cabeamento | `--ds-disc-cab` `#d6a472` |
| GAS | Gases medicinais | `--ds-disc-gas` `#86c4a8` |
| ACE | Acessibilidade | `--ds-disc-ace` `#7fa7e6` |
| GER | Geral | `--ds-disc-ger` `#9aa2b1` |

**Avatar por equipe** (`lib/cor-da-pessoa.ts`): arquitetura = `--ds-disc-arq`,
estrutural = `--ds-disc-est`, complementares = `--ds-disc-pai`, cor cheia com
iniciais escuras. Admin ganha anel na cor da própria equipe — **nunca
vermelho**, que nos achados quer dizer "bloqueia".

### Prefeituras — preservadas

Cada município tem sua cor e quatro formas de marca (`sinal`, `selo`, `bastao`,
`chapa`, em `MarcaDaPrefeitura`). É a única cor da obra que aparece fora do
documento, e **sempre ao lado do nome da cidade**.

### Gráficos

Monocromáticos: cinzas (`#5b5f6b` total, `#c9ccd4` parte), pílula sobre trilho
texturizado (listras a 135°), marcador fino, **uma cor de destaque por vez** —
o violeta para "agora/hoje", a cor de gravidade quando o gráfico é de
gravidade. Nunca arco-íris categórico.

---

## 3. Tipografia

**Geist para tudo; Geist Mono só para dado de verdade** (código de obra,
página, tempo, tecla, sigla de disciplina). Servidas do repositório
(`lib/ds/fontes.ts`) — o build não depende do Google.

| Nível | Medida | Uso |
|---|---|---|
| display | 44 / 300 / −0,04em | Só saudação e veredito ("Não emitir ainda"). |
| 3xl | 32 / 400 / −0,035em | Título de tela grande ("Auditoria em curso"). |
| 2xl | 24 / 400 / −0,025em | Título de seção principal. |
| xl | 20 / 500 / −0,02em | Título de achado, de cartão importante. |
| lg | 17 / 500 / −0,015em | Nome de obra. |
| md | 15 / 400 | Texto de leitura destacado. |
| sm (corpo) | **14** / 400 / 1,5 | O corpo. 14 porque é ferramenta lida por horas, não página de venda. |
| xs | 14 / 400 | Rótulos e controles (escala subiu um degrau em 30/09). |
| 2xs | 12,5 / 400 | Hora, contagem, rodapé. |
| mono | 12 / 400 | `117-25  INC-002  p. 14  2min 41s` |

**Regras.**
- Títulos **leves e grandes** (300–400), nunca bold pesado. Corpo 400, ênfase 500.
- **Nenhum rótulo em caixa alta.** Nada de "EYEBROW" com letter-spacing.
- Números que se comparam: `font-variant-numeric: tabular-nums` (`.ds-num`).
- Código inline: `.ds-code` (mono 12, fundo branco 5,5%, raio de tag).

---

## 4. Forma — raio por papel, nunca chanfro

O raio diz **o que a peça é**, não o tamanho dela. **O chanfro saiu inteiro**;
o raio só não entra no que é do documento (folha, carimbo, tabela do PDF).

| Token | Valor | Papel |
|---|---|---|
| `--ds-radius-tag` | 6px | Código, sigla, tecla |
| `--ds-radius-control` | 10px | Campo, item de menu |
| `--ds-radius-row` | 12px | Linha de lista, aviso |
| `--ds-radius-card` | 16px | Cartão |
| `--ds-radius-panel` | 18px | Barra lateral, palco |
| `--ds-radius-composer` | 22px | Compositor do chat |
| `--ds-radius-pill` | 999px | **Botão, selo, segmento, barra do topo** |

Botões são **pílulas**. Menu: 14px por fora, 9px nos itens.

---

## 5. Espaço

Base 4: `--ds-space-1..16` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Dentro de um
controle: 4 a 12. Entre itens de uma lista: 8 a 12. Entre seções: 32 a 48.
Nada fora da escala.

---

## 6. Elevação

Três níveis, sem brilho:

| Nível | Token | Uso |
|---|---|---|
| Plano | `--ds-edge` | Cartão, linha. Só a borda de luz. |
| Destacado | `--ds-edge-strong` | Selecionado, campo, botão fantasma. |
| Flutuando | `--ds-shadow-float` | Aviso, folha no mapa. |
| Sobreposto | `--ds-shadow-overlay` | Menu, diálogo, popover. |

Profundidade vem do **degrau de superfície** + borda de luz. Sombra só no que
flutua, e sempre longa e escura. **Nunca** sombra cinza clara, **nunca** brilho
colorido, **nunca** vidro como enfeite.

---

## 7. Movimento

Cinco durações, quatro curvas, três molas — `app/ds.css` para CSS,
`lib/ds/movimento.ts` para o `motion`. Os dois andam juntos.

| Duração | Valor | Para |
|---|---|---|
| press | 80ms | O aperto: o botão afunda `scale(0.97)` só no `:active`. |
| feedback | 120ms | Hover, troca de cor, ícone que acende. |
| state | 180ms | Selo que troca, check que marca. |
| enter | 240ms | Menu, toast, linha nova entrando. |
| layout | 320ms | Lista vira detalhe, painel abre. |

Curvas: `out` (entrada: chega rápido e assenta), `feedback` (acompanha o
gesto), `move` (A→B com os dois pontos visíveis), `exit` (vai embora sem pedir
atenção). Molas sem quique: `snappy` (pílula de segmento), `smooth` (elemento
que troca de lugar), `gentle` (painel grande).

**Regras.**
- Toda animação responde a: **o que mudou, para onde foi, deu certo, está
  trabalhando.** Senão, não entra.
- Só `transform` e `opacity` animam. Cor e sombra transicionam por CSS, curto.
- Nenhuma animação segura a tela: a pessoa age sem esperar o movimento acabar.
- `prefers-reduced-motion`: tudo vai a 0,01ms; esqueleto fica parado; o orbe
  pequeno para de rodar a tira.
- **Esqueleto** (`Esqueleto` / `.ds-skel`) só aparece depois de 120ms; uma luz só
  varre a tela inteira. **Girando** (`Girando` / `.ds-gira`) é para ação curta
  esperando o servidor — o Nexo trabalhando **nunca** usa isso, usa o orbe.

---

## 8. Foco

Anel violeta de 2px, afastado 2px pelo fundo da página
(`box-shadow: 0 0 0 2px var(--ds-surface-page), 0 0 0 4px var(--ds-focus-ring)`),
**só por `:focus-visible`**. O anel teal do `globals.css` antigo é neutralizado
dentro de `.ds`. Seleção de texto: violeta a 30%.

---

## 9. Tela grande

O desenho nasce na medida de um notebook (1440). A partir de **2300px** de
largura, `.ds` ganha `zoom: 1.125` (`--ds-zoom`). Consequências:
- `vh`/`dvh` não acompanham o zoom: use `--ds-altura-da-janela`.
- Overlay solto no `body` com `.ds` herda o zoom: divida coordenadas de mouse e
  `getBoundingClientRect` por `getComputedStyle(el).zoom`.

---

## 10. O orbe — a presença do agente

O orbe é **o agente**, e dele nasce a marca. É o único elemento vivo do sistema.

**Cores** (`CORES_DO_ORBE` em `modules/nexo/components/agent-orb/AgentOrbScene.tsx`):
corpo `#140f1a`, aro `#c3a3ff` (= `--ds-nexo`), alma profunda `#9a6cf0`
(= `--ds-nexo-strong`), miolo `#fff6f4`, alma clara `#ffa293` (coral nas
pontas), lâmina clara `#ffd6ce`. **Violeta → coral.** As paletas
`CORES_DO_ORBE_TEAL` e `_IRIS` existem só para comparação no laboratório.

**Escada de reduções** — todas reconhecíveis como o mesmo objeto:

| Nível | O que é | Onde |
|---|---|---|
| Vivo (3D) | React Three Fiber + shaders (`modules/nexo/components/agent-orb/`) | Palco/entrada. **Um vivo por tela.** |
| Capturado (PNG) | Quadro do vivo, recortado com 8% de margem (`public/marca/orbe-*.png`, `orbe-tira*.png`) | A marca: favicon, ícone, barra do topo. |
| Orbe pequeno | `Orbe` em `components/ds/basicos.tsx` (`.ds-orbe`): PNG parado; `estado="trabalhando"` roda a tira de 18 quadros | Barra do topo (22px num círculo), linhas de estado. |
| Estático (SVG) | `components/brand/logo-nexo.tsx`, afinado por tamanho, em violeta | Fundo claro, impressão. |

**Estados** (`use-agent-state.ts`), em ordem de prioridade: `error`,
`dragging`, `reading`, `responding`, `analyzing`, `auditing`, `complete`,
`waiting`, `idle`. O erro se diz por **ritmo** (batimento duplo), não por cor —
o orbe não fica vermelho. `prefers-reduced-motion`: congela num quadro legível.

**Marca:** o orbe capturado + a palavra "Nexo" em Geist. O nome exibido é
**Nexo**; `NEXODOC_*`, `--nexodoc-*`, banco e pacote continuam com o nome antigo.

---

## 11. Componentes

### Básicos — `components/ds/basicos.tsx`

| Componente | Classe | Regra |
|---|---|---|
| `Botao` | `.ds-btn` + `--primary` / `--ghost` / `--quiet`, `--sm`, `--icon` | Pílula, 34px (28 no `sm`). `primary` = papel claro, **um por tela**. `ghost` = contorno de luz. `quiet` = só texto secundário. Ícone 16px. Afunda 3% no aperto. Desabilitado 45%. |
| `Selo` | `.ds-pill` + `--line`/`--nexo`/`--block`/`--risco`/`--decide`/`--note`/`--texto`/`--ok` | Pílula 22px, texto 12, véu da cor. `ponto` põe o círculo de 6px. |
| `Segmento` | `.ds-seg` | Trilho afundado em pílula; a pílula do escolhido desliza com mola `snappy`. |
| `Seletor` | — | Escolha com menu. |
| `Menu` | `.ds-menu` (`--acoes`) | Overlay, raio 14, itens 34px raio 9. Marcado = ícone violeta. |
| `Tecla` | `.ds-kbd` | Mono 10,5, contorno + borda de baixo mais grossa (é o que a faz parecer tecla). |
| `Avatar` / `AvatarDaPessoa` | `.ds-avatar` (`--xs`, `--lg`, `--arq`/`--est`/`--comp`, `--admin`) | Círculo, cor da equipe. |
| `Orbe` | `.ds-orbe` | Ver §10. |
| `Girando` | `.ds-gira` | Anel fino na cor do texto; dentro do botão toma o lugar do ícone. |
| `Esqueleto` | `.ds-skel` | A forma do que vem; aparece após 120ms. |
| `NumeroQueChega` | — | Número que conta até o valor. |

### Micro — `components/ds/micro.tsx` / `micro.css`

`BotaoDeSegurar` (ação destrutiva por segurar, não por confirmar),
`Dica` (tooltip com tecla), `GrupoDeBotoes`/`BotaoDoGrupo`, `SinoDeAviso`
("me avise quando terminar"), `MarcaDeEstado` (`pendente`/`rodando`/`feito`/
`atencao`/`falhou`), `Cronometro`, `Trelica`.

### Gráficos — `components/ds/graficos.tsx`, `medidas.tsx`, `serie-com-meta.tsx`

`LinhaDoTempo`, `MapaDasPaginas`, `FaixaDeVeredito`, `ColunasEmPilula`,
`MapaDeAtividade`, `Fichas`, `LinhaAcumulada`, `BarrasPorMes`, `FluxoPorTipo`,
`MapaEmBlocos`, `ColunasPorNivel`, `NiveisEmFaixa`; `MedidorDeTeto`,
`OndaDeGasto`, `BarraDividida`, `LinhaDeTendencia`, `BarraEmbutida`;
`SerieComMeta`. Classes `gr-*` no `ds.css`. Idioma: pílula sobre trilho
listrado, cinza por padrão, uma cor de destaque.

### Selo de disciplina — `.dc`

`<span class="dc dc--estrutural"><i></i>EST</span>`: quadradinho 6px + sigla
mono 10,5 na cor da disciplina. `.dc--nome` mostra o nome por extenso.
Achado de várias disciplinas: `.dc-varias` (principal manda, envolvidas a 80%).

### A moldura — `components/moldura/`

**Topo em pílula** solta da borda (`topo.tsx`): o orbe num círculo + "Nexo",
os destinos com realce que segue o gesto, a busca (`Ctrl K`), a conta como
pílula de contraste. Mede-se pela **caixa** (container query): abaixo de 1280
os destinos vão para o cartão da marca; abaixo de 900 a busca vira ícone;
abaixo de 600 fica só o avatar. Também: barra de comando (`Ctrl K`), atalhos,
avisos, aviso de tela pequena, 404 e erro.

### Matriz de estados (todo controle)

repouso · hover (fundo branco 4–6%, contorno sobe um degrau) · foco (§8) ·
pressionado (`scale(0.97)`) · desabilitado (45%) · carregando (`Girando` no
lugar do ícone, largura não muda) · erro (texto + ponto `--ds-state-error`,
nunca só cor).

---

## 12. Padrões do Nexo

- **Conversa** (`components/telas/nexo/conversa.css`, prefixo `cx-`): coluna
  única centrada. **Você** em bloco suave à direita (`surface-raised`, raio
  18/18/6/18, até 78%). **Nexo** em texto limpo, sem balão, com linha de estado
  (passos com ponto violeta, cursor violeta piscando enquanto escreve).
  Decisões como **lacunas na frase** (menu ao clicar), saídas empilhadas com
  tecla, arquivos gerados como **peça** (`cx-peca`). Erro: ponto coral + frase.
- **Compositor**: raio `composer` (22), poço afundado, ação de enviar clara.
- **Cartão de confirmação**: proposta → parâmetros somente-leitura →
  [Confirmar e gerar] (papel claro) / [Corrigir] (fantasma). Correção acontece
  na conversa. Estado *pendente* (parâmetros mudaram) tem de ser visível.
- **Mapa do volume / canvas**: um bloco por disciplina (separatriz → LD →
  pranchas), seta com porta em meio disco, papéis que deslizam. Folha removida
  vira lugar vazio tracejado.
- **Auditoria em curso**: linha do tempo das etapas reais, mapa das páginas
  (página atual em véu violeta pulsando), relógio em anel.
- **Resultado**: veredito em display leve + `FaixaDeVeredito`; níveis em faixa
  na cor da gravidade; fila de achados navegável pelo teclado (J/K, Enter, C, M);
  o achado grifado no memorial.

---

## 13. Acessibilidade

- Foco visível em tudo, pelo anel violeta, por `:focus-visible`.
- Contraste ≥ 4,5:1 para texto em **todos** os planos (o terciário foi
  recalibrado para isso).
- Ícone sozinho sempre com rótulo acessível; `Dica` mostra a tecla.
- Teclado completo; `Ctrl K` abre a barra de comando; `?` mostra os atalhos.
- `prefers-reduced-motion` respeitado em todo o `ds`.
- "Pular para o conteúdo" no topo.

---

## 14. Faça e não faça

**Faça**
- Use só tokens semânticos `--ds-*` e componentes de `components/ds/`.
- Envolva a tela em `.ds` + `FONTES_DS`.
- Uma pílula clara por tela para a ação principal.
- Violeta só para Nexo presente/trabalhando, seleção e foco.
- Borda como sombra interna de luz; profundidade pelo degrau de superfície.
- Raio pelo papel da peça.
- Confira no `/lab/fundamentos` e nas telas de `/lab/telas/*` antes de inventar.

**Não faça**
- Teal, chanfro, `nx-cut-*`, `nx-edge-*`, `--cut-*`, IBM Plex, vidro, rust/salmão.
- `bg-primary`/`--accent`/`--ring` do tema antigo em código novo.
- Botão principal violeta (o violeta é do Nexo, a ação é papel).
- Rótulo em caixa alta; título em bold pesado.
- Cor de disciplina ou de prefeitura como cor de botão/fundo de interface.
- Cor de gravidade sem o texto que diz o degrau.
- Gradiente colorido, sombra clara, brilho colorido, ícone em círculo colorido.
- Animar `width`/`height`/cor por `motion`; animação que segura a tela.

---

## 15. O léxico do ofício

O software fala a língua de quem o usa.

| O produto diz | Nunca diz |
|---|---|
| **lote** | batch, conjunto de arquivos |
| **folha** / **prancha** | página, item, documento |
| **tomo** | volume parcial, parte |
| **selo** / **carimbo** | cabeçalho, metadados |
| **memorial** | documento de texto |
| **LD** | lista, índice, sumário |
| **separatriz** | divisória, capa de seção |
| **conferir** / **conferência** | validar, validação |
| **parecer** | relatório, report |
| **achado** | issue, problema encontrado, erro |
| **ler** / **leitura** | processar, upload, importar |
| **gerar** | exportar, criar, produzir |
| **registro** | relatório (para o que foi gerado) |

Mensagem de conclusão diz **o que ficou pronto**, não que deu certo: "12 folhas
lidas · 2 sem selo", e não "processamento concluído com sucesso".
`npm run prova:glossario` varre as strings de interface.

---

## 16. Histórico

- **até 30/09/2026 — sistema antigo** (teal + chanfro + IBM Plex + vidro).
  Documentos dessa época estão em `docs/arquivo/design-antigo/` e no histórico
  do git (esta `DESIGN.md` antes de 27/10/2026). Servem para entender uma
  decisão, **nunca** como referência visual.
- **29/09–02/10/2026 — laboratório e migração.** `/lab` com 19 telas aprovadas
  situação a situação; o destaque comparou violeta, grafite, ciano e amarelo de
  CAD — ficou o **violeta do aro do orbe**; a íris `#a3a6ff` foi trocada pelo
  `#c3a3ff` por contraste. Migração 1–5 levou o app ao `ds`.
- **03/10** topo em pílula; Fundações com cor própria.
- **16/10** degrau "risco na execução" (`--ds-sev-risco`).
- **27/10/2026** esta `DESIGN.md` reescrita para o `ds`; documentos antigos
  arquivados.
