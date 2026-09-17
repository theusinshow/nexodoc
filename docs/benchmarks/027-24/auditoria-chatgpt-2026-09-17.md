# Benchmark 027-24 — auditoria do ChatGPT

**Documento:** `027_24_md_geral_a.pdf` — Beira Mar de São José – Barreiros – Urbanização da
Orla – Parque, Restaurante e Lanchonete. Projeto Executivo, Memorial Descritivo Vol. I,
outubro/2025, 190 páginas. Prefeitura Municipal de São José.

**Origem:** auditoria feita pelo ChatGPT a pedido do Matheus em 17/09/2026, escrita para
servir de benchmark contra o NexoDoc. Status final dado por ele: **com incongruência
relevante**. Identidade da obra: coerente (ele não achou troca de código nem de município).

**Parecer do NexoDoc comparado:** `parecer-nexodoc-2026-09-17.json` (auditoria
`849c9e8a`, profunda, 55 achados). Foi rodada ANTES do conserto da leitura da capa, com a
obra de referência errada "• Diário de Obra em dia" — por isso o INC-001.

    node scripts/recall-vs-benchmark.ts docs/benchmarks/027-24/auditoria-chatgpt-2026-09-17.md \
      docs/benchmarks/027-24/parecer-nexodoc-2026-09-17.json

## Achados

As páginas foram conferidas no texto extraído do PDF (17/09/2026); o ChatGPT só citou
páginas nos achados 1 e 4.

| ID | Criticidade | Página | Categoria | Achado |
|---|---|---|---|---|
| AUD-001 | ALTA | 17 e 21 | Hierarquia documental | Contradição na precedência: "em caso de divergência entre as especificações e os projetos, prevalecerão os projetos" (p.17) × item 2.5 "As especificações técnicas e normas de execução citadas neste memorial prevalecerão sobre todos os projetos" (p.21). Incongruência confirmada. |
| AUD-002 | ALTA | 180 | Hidrossanitário | Caixa de gordura da lanchonete: "Adotado N = 471 para cada caixa de gordura especial" mas "V = 2 × 75 + 20, V calculado = 170 litros". 170 L só fecha com N=75; cópia do bloco do restaurante (N=471, V=962 L). Incongruência confirmada. |
| AUD-003 | MÉDIA | 12 e 13 | Texto desatualizado | Capa diz PROJETO EXECUTIVO, mas a abertura diz "Este relatório apresenta a terceira etapa do desenvolvimento do projeto", e o item 1.3 diz que a Etapa 3 é o Projeto Básico e a Etapa 5 o Executivo. Forte indício de texto remanescente. |
| AUD-004 | MÉDIA | 13 | Escopo contratual | Item 1.3: "Serão realizadas 4 entregas mensais de projeto", mas lista 5 etapas (estudo preliminar, anteprojeto, básico, paisagismo/urbanização, executivo). Incongruência confirmada. |
| AUD-005 | MÉDIA | 138 | Reaproveitamento de texto | Quadro de medição: disjuntores "identificados com o número do apartamento correspondente", num empreendimento sem apartamentos (restaurante, lanchonete, quiosque, iluminação). Reaproveitamento indevido. |
| AUD-006 | MÉDIA | 15 e 157 | PPCI / escopo | PPCI: área total 1.041,72 m² = restaurante 861,74 m² + lanchonete 179,98 m²; o quiosque de ~17,50 m² com sanitário, declarado no escopo, não entra. Ponto de atenção. |
| AUD-007 | MÉDIA | 164, 176 e 180 | Compatibilização | Populações: PPCI restaurante 206 e lanchonete 73 pessoas × hidrossanitário restaurante 238, lanchonete 41, quiosque 15. Pode ter critério distinto; falta explicação. Compatibilização necessária, não erro confirmado. |
| AUD-008 | BAIXA | 137 e 138 | Editorial | Itens 11.4 e 11.5 ambos intitulados "Quadro para Medidores"; o 11.5 trata dos quadros das muretas das barracas. Título duplicado/incorreto. |
| AUD-009 | BAIXA | 15 | Estrutura documental | Produtos finais listam Projeto de Sinalização e Projeto de Obras Complementares (entre outros), sem capítulo próprio no memorial. Pode estar em volume à parte. Ponto de atenção. |

## Outros sinais citados sem virar achado

Subtítulos duplicados ("Slalon" em 6.3.7.2.3 e 6.3.7.2.4, p.65); referências a
"rodovia/corpo estradal" na terraplenagem de um projeto de urbanização; concordância e
construções de modelos anteriores. Antônio Carlos aparece por causa da jazida de
empréstimo, não é conflito de município.

## O que ele considerou um bom resultado

Pegar pelo menos os cinco primeiros da matriz dele: AUD-001, AUD-002, AUD-003, AUD-004 e
AUD-005. Os que distinguem auditoria inteligente de busca por palavra: a hierarquia
(relacionar p.17 com p.21) e a caixa de gordura (N=471 × V=2×75+20).
