# Faixa "risco na execução" e prioridade de degrau único (16/10/2026)

## O problema, medido

Nos pareceres de 24/09 (`docs/benchmarks/027-24/parecer-nexodoc-2026-09-24-gpt6.json`
e `docs/benchmarks/117-25/parecer-nexodoc-2026-09-24-gpt6-medium.json`):

- a faixa `tecnico_contratual` tinha 33 de 62 e 32 de 55 achados, quase todos
  "Media". Valor incompatível que faz a obra sair errada (aterramento 25 Ω × 10 Ω,
  capacidade instalada menor que a carga, bacia PCD com duas descargas) ficava no
  mesmo degrau de "premissa não demonstrada" e "CEI/PCMAT a atualizar";
- dentro da faixa a certeza mexia na prioridade: regra saía "Media/Alta" por ser
  regra, e "títulos iguais em itens distintos" ficava acima do aterramento;
- 4 dos 6 críticos do 027-24 eram unidade errada, inclusive a óbvia ("túnel pet
  de 0,88 cm"), no mesmo degrau do "70 L/min × 70 L/s" do hidrante.

## Decisão

1. **Quatro faixas** (`lib/faixas-de-impacto.ts`, régua única para auditor,
   validação, leitura global, chat e conferente):
   `critico_documental` > **`risco_de_execucao`** > `tecnico_contratual` > `revisao_editorial`.
   - risco: executada como está escrita, a obra sai errada, insegura ou mais cara;
   - técnico: falta demonstrar, confirmar ou decidir; sozinho não leva a executar errado.
2. **Prioridade = faixa** (`lib/severidade.ts`): Alta, Media/Alta, Media, Baixa.
   Sem sobreposição entre faixas. A certeza vai para o motivo e desempata a ordem
   dentro da faixa (`sortAuditFindings`).
3. **Unidade**: crítica só quando o contexto não permite deduzir o valor
   pretendido; a óbvia é técnica.
4. **Regras determinísticas reclassificadas**: sobem para risco "bases de
   consumo de água × esgoto", "fluido sem central", "quantidade/nomenclatura de
   blocos"; descem para editorial "títulos duplicados em subitens irmãos",
   "título repetido em itens distintos", "numeração hierárquica incoerente".
   "Material das ferragens" fica técnico: a IA contesta que a regra específica
   pode ser exceção à geral, o que é decisão.
5. **Tela**: nível novo `risco` ("Risco na execução", token `--ds-sev-risco`
   `#f99a5f`), entre o coral do bloqueio e o âmbar da decisão. O canvas da
   auditoria mantém três tons de pino; risco usa o do técnico.

## Fora daqui

O achado que se anula ("nenhuma correção necessária") saiu do parecer no
commit 4d0cc77 (`lib/sugestao-sem-correcao.ts`), em paralelo.

## Prova

Rodadas medidas nos benchmarks; resultado em
`docs/benchmarks/faixas-2026-10-16.md`.
