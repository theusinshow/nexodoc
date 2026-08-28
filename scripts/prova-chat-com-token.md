# Prova com token — o chat cita a página certa

**EXECUTADA EM 27/08/2026, e passou: 15 asserções, nenhuma falha.**

Este roteiro era manual — abrir o PDF na página citada e conferir a olho. Virou
código:

    PROVA_PAGA=1 npm run prova:chat-token

`scripts/prova-chat-com-token.mjs` roda a auditoria, confere a memória, faz as
seis perguntas e **confere cada citação contra um gabarito extraído com pdfjs
cru** — nenhum módulo do produto participa do julgamento. Trocou-se a leitura a
olho pelo mesmo motivo que o produto inteiro existe: julgamento humano cansado
erra número de página, e prova que só passa com paciência não roda duas vezes.

O guarda `PROVA_PAGA=1` existe porque ela paga modelo.

## O que a corrida de 27/08 mediu

Documento: `tests/117_25_md_geral_a.pdf` — UBS Vila Manaus, Criciúma, 218
páginas, 465.196 caracteres. Auditoria `standard`: 130 s, 25 achados.

| pergunta | o que se mediu | resultado |
|---|---|---|
| espessura da telha | página **62**, valor **6,5 mm** | bateu |
| área total construída | página **99**, **467,46 m²** — e não a área do terreno da p.13 | bateu |
| proprietário | **Chapecó** na p.99, contra a capa de Criciúma | bateu, e registrou a divergência |
| escada rolante | termo que **não existe** no documento | negou, e ainda separou a escada FIXA das p.12/38/43/44 |
| "concorda com o INC-001?" | todo trecho entre aspas existe mesmo | todos ancoraram |
| "procure um erro que passou" | evidência do achado novo ancora na página declarada | ancorou |

**Nenhuma página citada estava errada em nenhuma das três corridas de chat.**

## O teto de voltas: 8 era palpite, agora é medido

Voltas por pergunta, três corridas:

| pergunta | corridas |
|---|---|
| espessura / área / proprietário / INC-001 | **2** voltas |
| escada rolante (termo ausente) | **3** voltas |
| "procure um erro que a auditoria deixou passar" | **5, 8 e 6** voltas |

**O teto de 8 FICA.** A pergunta aberta encostou nele numa das corridas — e
mesmo assim entregou achado com evidência ancorada (p.115). Baixar para 6
cortaria uma busca legítima no meio; o número não é folga, é o custo real de
procurar num memorial de 218 páginas.

## Custo — medido, não estimado

| corrida | o que rodou | US$ |
|---|---|---|
| 1ª | auditoria + 6 perguntas | 0,6019 |
| 2ª | só as perguntas (`PROVA_AUDIT_ID`) | 0,3296 |
| 3ª | só as perguntas | 0,4381 |
| 4ª | só as perguntas | 0,3016 |
| | **total do dia** | **1,67** |

`PROVA_AUDIT_ID=<id>` reaproveita uma auditoria já feita e a corrida cai para
~US$ 0,33 — o motor relendo um documento que não mudou custava US$ 0,35 por
repetição, e prova cara não roda de novo.

**Rode em `standard`.** Auditoria de memorial em `deep` vai para o `gpt-5.6-sol`
e custa ~US$ 1,95 contra US$ 0,25 do `gpt-5.6-terra` — 8x por uma resposta que
não muda: a página sai de ferramenta determinística sobre o texto guardado.

## Antes de rodar

1. `npm run dev` **recém-iniciado**. Um `next dev` velho dá falha de portão
   consistente e falsa.
2. Banco configurado: sem ele não há `AuditText`, e o chat cai no modo degradado
   — caminho legítimo, mas não é o que esta prova mede.
3. Teto de gasto conferido. **O teto do ambiente não protege esta corrida:** sem
   `NEXODOC_MONTHLY_BUDGET_USD` não há teto, e quem administra é isento do
   bloqueio de propósito (`isentoDoTeto`). Por isso a prova imprime o gasto
   antes e depois — quem segura o orçamento é quem lê a saída.

## O que ela ainda NÃO prova

- O comportamento com parecer antigo, gravado antes de `AuditText` existir. O
  modo degradado está provado só nos testes puros.
- Documento **escaneado**, sem camada de texto. Este memorial tem texto
  extraível; o chat não foi medido onde não há o que reler.
