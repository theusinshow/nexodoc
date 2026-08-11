# O chanfro como sistema

Data: 2026-08-11
Origem: `Nexo - Handoff Claude Code.dc.html` (projeto Claude Design `41fc7016`)
Referência visual: `Nexo - Redesenho.dc.html` — quadros 10a (o botão) e 11a (o shell a 1600 × 1000)

## O que muda

Duas decisões, uma só geometria:

1. **O botão é a 10a** — chanfro em dois cantos opostos, repouso chapado, lâmina a 30° no hover.
2. **O chanfro substitui o raio de 8px** no sistema — cartão, campo, nó, chip e item de lista.

Tipografia, escala de espaçamento, os cinco tokens de cor e a grade do shell **não mudam**.

A regra que atravessa tudo: `clip-path` não aceita borda, `outline` nem `box-shadow` externo — tudo
é recortado. Toda superfície com contorno vira duas formas, uma dentro da outra.

## Escopo

Esta entrega cobre os nove alvos da seção 4 do handoff. As telas de `app/admin/**`,
`modules/volume-builder/**` e `components/audit-result.tsx` **ficam de fora por decisão**: elas
herdam o chanfro onde consomem os primitivos e continuam com `rounded-*` onde têm classe solta.
Isso é conhecido e aceito — não é pendência esquecida.

## Decisões de técnica

O handoff descreve o contorno como duas divs aninhadas e o anel de foco como uma forma 4px por
fora. Duas coisas não sobrevivem ao contato com o código, e a spec abaixo diverge nelas de
propósito.

### 1. O contorno é pseudo-elemento, não wrapper

Wrapper real em toda superfície com contorno muda o DOM de todo primitivo: `className`, `ref` e
`data-slot` passam a ter dois destinos possíveis, e o layout externo (flex/grid) passa a mirar o
wrapper em vez do cartão. Um `::before` recortado entrega a mesma forma sem tocar no contrato do
componente.

```css
.nx-edge-8 {
  position: relative;
  isolation: isolate;
  clip-path: var(--cut-8);
  background: var(--nx-edge, var(--border));   /* a borda */
}
.nx-edge-8::before {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: -1;
  clip-path: var(--cut-8);
  background: var(--nx-fill, var(--card));     /* o miolo */
}
```

O par `isolation: isolate` + `z-index: -1` é o que faz o miolo ficar acima do fundo do elemento e
abaixo do conteúdo. Sem o `isolation` o `-1` cairia atrás do próprio fundo e o miolo sumiria; com
uma regra em `> *` em vez disso, texto solto (nó de texto, sem elemento) ficaria embaixo.

**Exceção: `input` e `textarea`.** Campo nativo não renderiza `::before`. Esses dois — e só esses —
ganham wrapper real, que também desenha o anel no `:focus-within`.

### 2. O anel de foco é por dentro, não por fora

`clip-path` recorta os descendentes: um anel *por fora* não pode ser filho do elemento recortado.
As alternativas eram inflar a caixa em 4px e recuperar com margem negativa (come 8px de todo gap
onde o botão vive) ou envolver todo focalizável num `<span>` (quebra `w-full` e `flex-1` vindos do
call site, e deixa o `asChild` do Radix ambíguo).

O anel vira uma faixa de 3px desenhada para dentro do próprio chanfro:

```css
.nx-edge-8:focus-visible { background: var(--ring); }
.nx-edge-8:focus-visible::before { inset: 3px; }
```

Mesma caixa, mesma altura, mesmo gap, e o anel segue o chanfro exatamente porque é a mesma forma.

## A geometria

Chanfro em **superior esquerdo e inferior direito**, sempre. Nunca nos quatro cantos, nunca no par
oposto. O tamanho do corte é igual ao raio que ele substitui e escala com a altura do elemento.

| corte | onde |
|---|---|
| 8px | cartão, palco, botão 44 |
| 7px | botão 40, campo |
| 6px | botão 32/36, nó, chip |
| 5px | item de lista, badge |
| 4px | controles flutuantes |

## `app/globals.css`

### Tokens novos

Só três valores da spec são de fato novos. Os outros que o handoff cita inline já existem:
`#2c3338` é `--input`, `#1a1e21` é `--secondary`, `#23282c` é `--border`, `#5bdac6` é `--ring`,
`#00a693` é `--primary`.

```css
--primary-hover:  #00bda7;   /* hover da primária */
--primary-active: #00877a;   /* pressionado e carregando */
--blade:          #7af7e1;   /* a lâmina */
```

Mais os polígonos, num lugar só:

```css
--cut-4:  polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
```

`--cut-5`, `--cut-6`, `--cut-7`, `--cut-8` e `--cut-12` são a mesma fórmula com o número trocado nas
quatro posições. Seis no total; `--cut-12` fica disponível para painel grande e não tem consumidor
nesta entrega.

### As duas famílias de classe

Entram em `@layer components`, junto das `.nexo-*` que já vivem lá. Fora de layer elas venceriam as
utilities do Tailwind e matariam `border-*` silenciosamente — isso já aconteceu neste projeto.

- `.nx-cut-{4,5,6,7,8,12}` — só o recorte. Superfície chapada: uma div, nada mais. Cartão sem
  contorno, item de lista ativo e chip preenchido usam esta.
- `.nx-edge-{5,6,7,8}` — recorte com contorno em camada, parametrizado por `--nx-edge` e
  `--nx-fill`, com o comportamento de foco acoplado.

Nenhum `clip-path` literal fora deste arquivo.

### O ring global tem que se desligar

`globals.css:284-298` hoje aplica um anel de foco por `box-shadow` a `a, button, summary, input,
select, textarea`. Em elemento recortado esse anel é cortado — o controle fica **sem foco visível
nenhum**, o que é uma regressão de acessibilidade, não um detalhe estético. A regra passa a se
desligar em qualquer elemento com `.nx-cut-*` / `.nx-edge-*`.

Na mesma linha, `input, select, textarea { border-radius: var(--radius-sm) }` (L273) deixa de valer
para os campos que ganham chanfro.

### Movimento reduzido

Sob `prefers-reduced-motion: reduce` a lâmina não anima: o hover vira troca de fundo direta e o
estado carregando fica estático em `--primary-active`.

## `components/ui/button.tsx`

Reescrita completa.

**Escala:** três alturas — 44 (ação de turno), 40 (padrão), 32 (denso) — cortes 8/7/6. Rótulo em
Geist Mono 600, caixa alta, `letter-spacing: 0.06em`, 12px em 44 e 40, 11px em 32. **O `min-h-10` da
base sai**: é ele que apaga a hierarquia de tamanho hoje.

**Três camadas, zero markup novo** — condição para o `asChild` do Radix continuar funcionando:

| camada | papel |
|---|---|
| elemento | cor da borda; vira `--ring` no `:focus-visible` |
| `::before` | o miolo; recua de 1px para 3px no foco; carrega o ponto de canto como segunda camada de `background` |
| `::after` | a lâmina: `skewX(-30deg)`, largura 160%, 300ms `--ease-feedback` |

**As variantes são só um par de variáveis:**

| variante | `--nx-edge` | `--nx-fill` | lâmina |
|---|---|---|---|
| primária | `--primary` (igual ao miolo → repouso chapado) | `--primary` | `--blade` a 50%, fundo vai a `--primary-hover` |
| secundária | `--input` | `--secondary` | `--primary` a 20%, mais o ponto de canto |
| fantasma | `transparent` | `transparent` | — (só troca de cor de texto) |

A primária ganha `inset 0 1px 0 rgba(255,255,255,0.22)` no repouso. `inset` sobrevive ao recorte;
só o externo é cortado.

**Pressionado:** `--primary-active` com `inset 0 2px 3px rgba(0,0,0,0.35)`.
**Carregando:** fundo `--primary-active`, lâmina em laço de 1.8s a 30% — **sem spinner**.
**Desabilitado:** `opacity: 0.45`, sem lâmina.

**O que cai:** o ponto de canto fica **só na secundária** — na primária chapada não há contraste
para ele. A moldura externa da 10b não entra. `hover:bg-primary/90` sai: enfraquecer o botão não é
reagir a ele.

## Os outros primitivos

| arquivo | corte | nota |
|---|---|---|
| `components/ui/card.tsx` | 8 | `.nx-edge-8` com contorno; `.nx-cut-8` quando chapado |
| `components/ui/input.tsx` · `textarea.tsx` | 7 | wrapper real (única exceção); miolo `--background`; anel no `:focus-within` |
| `components/ui/chip.tsx` · `badge.tsx` | 6 · 5 | badge preenchido não recebe camada externa |
| `components/ui/dropdown.tsx` · `tooltip.tsx` | 6 | chanfro no painel, itens de lista com corte 5 |
| `components/ui/glass-panel.tsx` | 8 | mantém `--glass-edge`; o raio sai, o chanfro entra |
| `modules/nexo` — nós do palco | 6 | nó, faixa de disciplina e chips de ação; a faixa acompanha o corte superior |
| `modules/nexo/components/NexoSidebar.tsx` | 6 · 5 | nova conversa e busca em 6; itens de conversa em 5, só o ativo tem fundo |

## As exceções

- **Campos tracejados do carimbo** continuam com `border-radius: 4px` e borda tracejada. Tracejado
  não sobrevive ao recorte, e ali o tracejado é papel, não interface. O painel que os contém tem
  chanfro por fora.
- **Formas redondas** — orbe, avatares, indicadores de estado, halo do copiloto — seguem
  circulares. O chanfro é linguagem de superfície e de controle, não de objeto.
- **Controles do React Flow** — o bloco de zoom recebe corte 4px no conjunto, não em cada botão.
  Componente de terceiro sem controle de markup fica como está.

## Invariantes

1. Teal (`--primary`) só em elemento interativo. Nunca em decoração, nunca em texto corrido.
2. Nenhuma cor solta. Os três valores novos entram como token em `globals.css`, não inline.
3. Chanfro sempre no par superior esquerdo + inferior direito, sem exceção decorativa.
4. `prefers-reduced-motion`: nada desliza.
5. Tipografia, escala de espaçamento e grade do shell não mudam nesta entrega.

## Critérios de aceite

| # | critério |
|---|---|
| 01 | Dentro dos nove alvos, nenhum `border-radius` maior que 4px sobrevive em superfície ou controle — busca por `rounded-lg`, `rounded-md` e `var(--radius)` volta vazia fora das exceções. |
| 02 | Nenhum `clip-path` literal fora de `globals.css`. |
| 03 | Navegação por teclado mostra o anel de 3px por dentro em todos os botões e campos, e o anel não aparece no clique de mouse. |
| 04 | As três alturas de botão coexistem numa mesma tela sem que o CSS global force 40px. |
| 05 | Com `prefers-reduced-motion` ativo, nada desliza: nem hover, nem carregando. |
| 06 | A tela `/nexo` em 1600 × 1000 bate com a 11a — mesmos cortes, mesmos pesos de contorno, mesma tipografia. |
| 07 | Contraste do rótulo sobre a primária e sobre a lâmina em hover passa em AA (texto pequeno). |

Os itens 01 e 03 divergem do handoff: o 01 pelo escopo acordado, o 03 pela direção do anel. Os
outros cinco estão como no original.
