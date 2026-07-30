# Kit de design do Nexo — anexe esta pasta inteira

Tudo que a ferramenta de design precisa para produzir o sistema visual do Nexo
sem precisar perguntar nada. Gerado em 2026-07-30.

## O que tem aqui

| Arquivo | O que é | Como usar |
|---|---|---|
| `01-contexto-e-regras.md` | Quem usa o software, o norte criativo, a paleta fixa, a gramática de cor, a linha d'água do vidro e o movimento | **Cole como contexto/instruções do projeto.** Vale para todas as sessões |
| `02-lotes.md` | Nove pedidos, na ordem | Um por vez. Nunca todos juntos |
| `03-inventario.md` | A lista completa do que existe no software | Referência. **Não é pedido** |
| `04-tokens.css` | Os tokens reais, com os nomes exatos | Devolva os tokens com estes mesmos nomes |
| `telas/` | 12 capturas do software rodando hoje | Anexe junto. Valem mais que qualquer descrição |

## A ordem

1. Cole `01-contexto-e-regras.md` como contexto do projeto.
2. Anexe as imagens de `telas/`.
3. Peça o **lote 1** (fundamentos) de `02-lotes.md`, com o bloco de fechamento junto.
4. Confira contra os sete critérios do fechamento. Só então vá para o lote 2.

Cada lote depende do anterior: os fundamentos definem os primitivos, que montam
o chat, que monta as telas. Pular a ordem produz peças que não encaixam.

## Por que não pedir tudo de uma vez

Porque o resultado seria média. Nove pedidos focados, cada um conferido antes do
seguinte, é o que separa um sistema de uma galeria de telas bonitas.

## O que NÃO está aberto a redesenho

A paleta, a gramática de cor (teal = interativo, os três sinais = status,
rust = ênfase), a linha d'água do vidro, a família tipográfica, a grade de 4px e
o orbe como identidade. Essas decisões já estão em produção e sustentam o
significado da interface — a ferramenta redesenha a **execução** delas, não as
regras.

O que está aberto: tudo o mais. Especialmente as quatro cores novas (lote 1), a
execução do orbe e da logo (lote 2), e o desenho de cada componente.

## Uma exigência prática

Os tokens voltam com o **nome exato** das variáveis de `04-tokens.css`
(`--status-ok`, `--glass-tint`, `--duration-shell`, …). Nome diferente vira
trabalho de tradução e depois vira bug.

## Origem

Este kit é uma cópia de trabalho. A fonte é o repositório do software:
`DESIGN.md` (as regras), `docs/design-system-briefing.md` (o inventário),
`docs/design-system-prompts.md` (os lotes) e `app/globals.css` (os tokens).
Se algo aqui divergir de lá, o repositório vence.
