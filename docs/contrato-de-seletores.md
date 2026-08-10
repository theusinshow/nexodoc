# Contrato de seletores da QA

Este arquivo existe por um motivo só: **os 32 scripts em `scripts/shot-*.mjs` enxergam
a interface por seletores.** Se uma refatoração visual renomear uma classe ou mudar um
atributo, os scripts não quebram com erro — eles capturam a tela errada, ou não capturam
nada, e passam verde. A refatoração fica cega justamente na hora em que mais precisa
enxergar.

Os nomes abaixo não são detalhe de implementação. São a superfície pública que a QA
observa. Trate-os como assinatura de função.

## A regra

Renomear qualquer item desta lista é permitido — **desde que o script que o usa mude no
mesmo commit.** O que não é permitido é regravar snapshot para "consertar" a captura:
isso apaga a evidência em vez de produzi-la.

Antes de mexer num destes, rode o script que o observa e guarde a saída. Depois, rode de
novo. É a mesma disciplina da linha de base da Fase 0.

## Classes

| Seletor | Onde vive | Quem observa |
| --- | --- | --- |
| `.nexo-agent-orb` | `app/globals.css`, orbe do palco | capturas do orbe e do palco cheio |
| `.nexo-shell__copilot` | `app/globals.css`, coluna do copiloto | layout de 3 colunas, largura do splitter |
| `.nexo-shell__estreito` | `app/globals.css`, aviso de tela estreita | `shot-nexo-tela-estreita.mjs` |
| `.nexodoc-message-in` | `app/globals.css`, entrada de mensagem | streaming e autoscroll do chat |
| `.react-flow`, `.react-flow__node`, `.react-flow__viewport`, `.react-flow__pane`, `.react-flow__edge`, `.react-flow__minimap` | React Flow (biblioteca) | canvas, folhas, arrasto |

As classes `.react-flow*` **não são nossas** — vêm da biblioteca. Trocar de biblioteca de
canvas quebra todos os scripts do canvas de uma vez. Isso é um custo real da troca e
deve entrar na conta, não ser descoberto depois.

## Atributos

| Seletor | Significado | Quem observa |
| --- | --- | --- |
| `[data-id^="folha:"]` | nó de folha no canvas | seleção, arrasto, contagem |
| `[data-id^="capa"]` | nó de capa | montagem do volume |
| `[data-id^="g-"]` | nó de grupo | "o grupo manda" |
| `[data-id^="a-"]` | nó de artefato | plano de geração |
| `[data-pin]` | achado fixado no canvas de auditoria | auditoria visual |
| `[data-pilha="topo"]` | topo da pilha de achados recorrentes | auditoria visual |
| `[data-tour-anel]` | anel que destaca o alvo do tour | `shot-tour.mjs` |
| `[data-tour-balao]` | balão de texto do tour | `shot-tour.mjs`, `shot-nexo-tour-cabe.mjs` |
| `[data-tour-proximo]` | botão "Próximo" do tour | avanço automático do tour |

O tour é o caso mais frágil: `modules/nexo/lib/passos-do-tour.ts` posiciona o balão com
`getBoundingClientRect`. Mudar `overflow`, `transform` ou `position` de um ancestral do
alvo desloca o balão sem gerar erro nenhum.

## Papéis ARIA usados como âncora

`role="log"` (rolagem do chat), `role="alert"` (faixas de estado), `role="menuitem"`, e as
consultas `getByRole` de `button`, `link`, `checkbox` e `dialog`.

Isto tem um efeito colateral bom: **corrigir a acessibilidade melhora a QA.** Os itens
P0-7, P0-8 e P1-10 do plano de refatoração trocam marcação improvisada por papéis
corretos — e cada papel correto é uma âncora mais estável do que uma classe.

## Como conferir que a lista continua verdadeira

```bash
# extrai os seletores que os scripts realmente usam
grep -rhoE '\[data-[a-z-]+[^]]*\]' scripts/*.mjs | sort -u
grep -rhoE '"\.[a-zA-Z][a-zA-Z0-9_-]*[^"]*"' scripts/*.mjs | tr -d '"' | sort -u
```

Se aparecer um seletor que não está nesta tabela, ou a tabela envelheceu ou alguém
adicionou um acoplamento sem registrar. Os dois casos pedem conserto.
