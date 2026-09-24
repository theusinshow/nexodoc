# 117-25 — gpt-6-sol × gpt-5.6, e o esforço de raciocínio (24/09/2026)

Segundo memorial da troca de família (o primeiro é o 027-24, em
`../027-24/comparacao-gpt6-2026-09-24.md`). Mesmo código, mesmo dia, banco de
dev, disparado por requisição. Gabarito: auditoria do ChatGPT com 15 achados
(`Downloads/auditoria_profunda_117_25.md`, não versionado).

| corrida | modelo (global/validação) | esforço | teto de saída global | auditoria |
|---|---|---|---|---|
| controle | gpt-5.6-sol (blocos terra) | medium | 22.000 (padrão) | `f0fc2ec3` |
| 6 medium | gpt-6-sol | medium | 22.000 | **falhou** |
| 6 medium | gpt-6-sol | medium | 32.000 | `16e8f1c8` |
| 6 high | gpt-6-sol | high | 32.000 | `5efb144c` |

## A primeira corrida da 6 não leu o documento

Com o teto padrão de 22.000, a leitura global do `gpt-6-sol` terminou em
`incomplete_max_output_tokens` aos 290s, e o parecer saiu só com as 9 regras. A
repetição com teto de 32.000, na mesma configuração, usou 17.639: **a saída da 6
varia muito entre corridas**, e a de 22.000 fica perto da borda. O `high` usou
26.992, e com o teto de produção ele falharia sempre.

## Recall (medidor automático, casamentos duvidosos conferidos à mão)

| | 5.6 medium | 6 medium (32k) | 6 high (32k) |
|---|---|---|---|
| total | **13/15** | **13/15** | 11/15 |
| CRÍTICA | 4/4 | 4/4 | 4/4 |
| ALTA | 6/7 | 6/7 | 5/7 |
| perdeu | AUD-009 climatização, AUD-015 elétrica | AUD-007 "Alunos", AUD-015 | AUD-007, AUD-011 cisterna, AUD-012 NBR, AUD-015 |
| achados | 66 | 55 | 65 |
| crítico / técnico / editorial | 12 / 32 / 22 | 11 / 32 / 12 | 8 / 46 / 11 |

A 6 em `medium` empata no total, mas erra em outro lugar: pega a climatização,
que a 5.6 perde, e perde o "Alunos + Funcionários", que a 5.6 pega.

## Custo e tempo (tabela oficial de 24/09)

| | 5.6 medium | 6 medium | 6 high |
|---|---|---|---|
| saída global | 18.411 | 17.639 | 26.992 |
| custo estimado | ~US$ 1,25 | ~US$ 0,62 | ~US$ 0,74 |
| tempo | 305s | 399s | 652s |

## Veredito

- **`high` não compensa na 6:** recall pior (11/15), menos críticos, o dobro do
  tempo, e não cabe no teto de produção.
- **6 em `medium` é instável:** no 117-25, uma corrida empata com a 5.6 e outra
  falha; no 027-24, perde 2 dos 9 achados. É metade do custo, mas não é
  substituto seguro da 5.6 na auditoria profunda.
- **Se a troca voltar à mesa:** o teto da leitura global
  (`NEXODOC_DEEP_GLOBAL_MAX_OUTPUT_TOKENS`) precisa subir para 32.000 junto, senão
  memorial grande sai com "AUDITORIA INCOMPLETA".
