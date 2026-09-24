# 027-24 — gpt-6-sol × gpt-5.6 (24/09/2026)

Pergunta: dá para trocar a auditoria profunda de memorial para a família 6, que
custa menos? Duas corridas no MESMO código (main em `71de078`), mesmo PDF, mesmo
dia, banco de dev, disparadas por requisição (sem a tela):

| | Controle (produção de hoje) | Família 6 |
|---|---|---|
| leitura global | gpt-5.6-sol | gpt-6-sol |
| validação | gpt-5.6-sol | gpt-6-sol |
| blocos | gpt-5.6-terra | gpt-6-sol |
| auditoria | `e8b9522c` | `b87efd0a` |
| parecer | `parecer-nexodoc-2026-09-24-controle-56.json` | `parecer-nexodoc-2026-09-24-gpt6.json` |

**As duas deixaram 15 páginas sem ler.** Elas são desenhadas, não escritas, e a
transcrição só vai quando a tela manda `textoRecuperado`. Em 17/09 a tela mandou,
e é por isso que aquela corrida pegou o AUD-006. A comparação entre as duas daqui
é justa; a comparação com 17/09 não é.

## Recall, conferido à mão

O `recall-vs-benchmark.ts` diz 9/9 para o controle e 8/9 para a 6. As duas contas
estão infladas: casar "terceira etapa" com "4 entregas" é o erro já registrado em
17/09, e casar "PPCI sem o quiosque" com "divergência de área" é o mesmo erro.

| Benchmark | Controle 5.6 | Família 6 |
|---|---|---|
| AUD-001 hierarquia p.17 × p.21 | INC-001 (regra), crítico | INC-001 (regra), crítico |
| AUD-002 caixa de gordura N=471 | INC-009, crítico | INC-006, crítico |
| AUD-003 "terceira etapa" | — | — |
| AUD-004 4 entregas × 5 etapas | INC-045 | INC-024 |
| AUD-005 "número do apartamento" | INC-043 | INC-038 |
| AUD-006 PPCI sem o quiosque | — (só divergência de área) | — (só divergência de área) |
| AUD-007 populações PPCI × hidro | **INC-029, exato** | **—** |
| AUD-008 11.4 e 11.5 mesmo título | INC-042 | INC-039 |
| AUD-009 produtos finais sem capítulo | INC-051 (ponto de atenção) | **—** |
| **Total** | **7/9** | **5/9** |

## Gravidade

| | Controle 5.6 | Família 6 |
|---|---|---|
| achados | 58 | 62 |
| crítico / técnico / editorial | 10 / 33 / 15 | 6 / 37 / 19 |

A família 6 manteve no topo os dois achados que o benchmark põe lá (hierarquia e
caixa de gordura). Não marcou como críticos, e em alguns casos nem achou, estes
quatro: extensão entre estacas (p.44), unidade na p.54, unidades de passagem da
lanchonete (p.164) e memória prometida e ausente (p.189).

## Custo e tempo (tabela oficial, conferida em 24/09)

| | Controle 5.6 | Família 6 |
|---|---|---|
| global (entrada/saída) | 131.714 / 19.571 | 131.714 / 20.129 |
| validação (entrada/saída) | 39.311 / 9.511 | 39.454 / 7.872 |
| custo estimado | ~US$ 1,27 | ~US$ 0,62 |
| tempo total | 354s | **656s** |

A família 6 custa metade e demora quase o dobro: global 275s contra 189s,
validação 156s contra 92s.

## Veredito

**Não trocar a auditoria profunda para `gpt-6-sol`.** Ela perde 2 dos 9 achados do
benchmark e 4 críticos, e o ganho é de US$ 0,65 por auditoria. É uma corrida de
cada lado, e o ruído entre corridas do mesmo modelo não está medido
([[nexodoc-validacao-terra]]): o resultado é um sinal contra a troca, não uma prova
de que a 6 seja pior. Nada aqui mede o luna (selo, LD, transcrição) nem o chat.
