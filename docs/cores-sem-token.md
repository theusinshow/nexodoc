# Cores sem token

Levantadas na varredura de UI de **01/09/2026** (`npm run mede:divida`).

Cada uma destas é hex cru que **não tem token correspondente** em
`app/globals.css`. Elas **não viraram token na varredura**, e isso é decisão, não
esquecimento: `DESIGN.md:283` cobra nome, trabalho declarado, consumidor nomeado
na tabela do §2 e `npm run prova:tokens` para admitir cor nova — e isso é decisão
do design system, não de uma passagem de limpeza.

A coluna **o que ela faz** existe porque é exatamente o que o §12 vai pedir no
dia em que cada uma virar token.

Das 26 ocorrências que a varredura acusou, **uma** tinha token e foi trocada na
hora: `#2b0a08` → `var(--destructive-foreground)`, no grifo de achado crítico.
Sobraram estas.

## A tinta sobre a cor de status

Quando o grifo pinta o fundo com `--status-*`, o texto por cima precisa de uma
tinta escura própria. `--destructive-foreground` cobre o crítico; os outros dois
não têm par.

| Cor | Onde | O que ela faz |
|---|---|---|
| `#2b1d05` | `audit-result.tsx:132`, `ConfirmationCard.tsx:616` | Tinta sobre `--status-warning`. É o par que falta ao lado de `--destructive-foreground`. |
| `#052b16` | `audit-result.tsx:133` | Tinta sobre `--status-ok`. Mesmo par que falta. |

**Se algum dia virarem token, é como família** — `--on-status-warning`,
`--on-status-ok` —, junto de um `--on-status-critical` que hoje se chama
`--destructive-foreground` e faz esse trabalho por acaso.

## O realce do "achado seu"

| Cor | Onde | O que ela faz |
|---|---|---|
| `#0f2d2a` | `painel-do-usuario.tsx:749`, `:817` | Fundo do que espera VOCÊ — teal escurecido, no `Selo` e no botão de nova auditoria. |
| `#164039` | `painel-do-usuario.tsx:749` | O mesmo realce no `hover`. |

Os dois andam juntos e são um par de estado (repouso e hover) da mesma
superfície. Viram token juntos ou não viram.

## As superfícies da barra do topo

| Cor | Onde | O que ela faz |
|---|---|---|
| `#141a1e` | `barra-do-topo.tsx:256` (×2), `:332` | Fundo do item de menu — em repouso quando a conta está aberta, e no `hover` quando não está. |
| `#20262a` | `barra-do-topo.tsx:273` | Um degrau acima, para o item destacado. |
| `#0d1215` | `barra-do-topo.tsx:297` | O preenchimento do chanfro, um degrau ABAIXO do fundo da página. |
| `#9aa6ac` | `barra-do-topo.tsx:264` | Texto de apoio, mais mudo que `--muted-foreground`. |

Quatro degraus de uma escala de superfície que **existe de fato** e nunca foi
nomeada. É a candidata mais forte a virar família de token — mas isso é o §2
decidindo a escala inteira, não esta varredura escolhendo quatro valores.

## Os avulsos

| Cor | Onde | O que ela faz |
|---|---|---|
| `#4a3a1c` | `painel-do-usuario.tsx:616` | Borda do cartão em alerta — âmbar escurecido até virar contorno. |
| `#3d474d` | `painel-do-usuario.tsx:858` | O ponto do achado ENVIADO, mudo de propósito: ele não espera você. |
| `#171c1f` | `onde-voce-parou.tsx:220` | Divisória entre linhas, mais fraca que `--border`. |
| `#3a4249` | `NexoSidebar.tsx:471` (×2) | Contorno de item da barra lateral. |

## O que NÃO está nesta lista

Três lugares em que hex cru é a coisa certa, e o medidor os dispensa **com o
motivo escrito no código**:

- **a marca** (`components/brand/`) — cor ali é a identidade, não estilo;
- **o WebGL** (`agent-orb/`) — cor é dado que vai para o shader;
- **as bancadas** (`app/bancada-*`) — existem para experimentar valor cru.

E dois em que o token **não chega**, marcados com `cor-crua-ok:` no próprio
arquivo:

- **o SVG que o parecer exporta** — sai do produto como arquivo e é aberto fora
  dele; `var()` não resolve num SVG solto;
- **a paleta do e-mail** (`lib/aviso-de-achados.ts`) — cliente de e-mail não
  resolve `var()`, e o comentário de lá explica que um token cru pintaria texto
  de preto sobre preto.

## Como continuar daqui

`npm run mede:divida` sai com código 1 enquanto houver violação, então esta lista
não pode crescer em silêncio. Para admitir qualquer uma destas como token, o
caminho é o do `DESIGN.md:283`: nome, trabalho declarado, entrada na tabela do §2
e `npm run prova:tokens` verde.
