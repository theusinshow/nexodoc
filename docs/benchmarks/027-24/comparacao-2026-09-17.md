# 027-24 — NexoDoc × ChatGPT (17/09/2026)

Conferência manual, achado por achado, com as páginas e as citações checadas no texto
extraído do PDF. Benchmark: `auditoria-chatgpt-2026-09-17.md`. Parecer:
`parecer-nexodoc-2026-09-17.json` (auditoria `849c9e8a`, profunda, 55 achados, 6min55s).

## Recall

**Manual: 7/9.** O `recall-vs-benchmark.ts` diz 8/9 porque casa AUD-003 ("terceira
etapa", p.12–13) com INC-018 ("4 entregas", p.13): mesma página e termos em comum, achados
diferentes. O casador **errou para mais** aqui, contra o que o comentário dele promete.

| Benchmark | NexoDoc | Prio NexoDoc | Nota |
|---|---|---|---|
| AUD-001 hierarquia p.17 × p.21 | INC-007 (regra) | Media/Alta | pegou; ChatGPT: ALTA |
| AUD-002 caixa de gordura N=471 × 2×75+20 | INC-017 (ia) | Media/Alta | pegou como "premissa não rastreável"; é conta errada |
| AUD-003 "terceira etapa" em executivo | — | — | **não pegou**; o texto está na p.12 |
| AUD-004 4 entregas × 5 etapas | INC-018 | Media/Alta | pegou |
| AUD-005 "número do apartamento" | INC-030 | Media/Alta | pegou |
| AUD-006 PPCI sem o quiosque | INC-031 | Media/Alta | pegou, com a mesma soma |
| AUD-007 populações PPCI × HID | INC-015 | Media/Alta | pegou, e achou "439 pessoas" a mais |
| AUD-008 11.4 e 11.5 mesmo título | INC-029 (regra) | Media/Alta | pegou |
| AUD-009 produtos finais sem capítulo | — | — | **não pegou** (ponto de atenção dele) |

Dos "outros sinais": Slalon duplicado = INC-022/INC-033; rodovia na terraplenagem = INC-020.

## Gravidade: o defeito que este benchmark expõe

O topo do parecer (Alta, "bloqueia a emissão") tinha:

| ID | Achado | Leitura |
|---|---|---|
| INC-001 | capa × "Diário de Obra Em Dia" | **falso positivo** do defeito de leitura da capa (consertado em `9429c83`) |
| INC-002 | 2.269,34 × soma 2.269,36 m³ | diferença de 0,02 m³, arredondamento; não bloqueia emissão |
| INC-003 | tambor túnel "0,88 cm × 3,60 cm" | real (unidade), editorial-técnico |
| INC-004 | caixaria "espessura de 2,5 m" | real (unidade), editorial-técnico |
| INC-005 | hidrante 70 L/min × 70 l/s | real, e grave (fator 60) |
| INC-006 | reservatório "3 dias de demanda" × demanda 44,86 L/dia | real, troca demanda por captação (291,20 L/dia) |

Enquanto os dois que o benchmark põe no topo — hierarquia contraditória (INC-007) e caixa
de gordura (INC-017) — ficaram em Media/Alta ("exige decisão técnica").

## Duplicados no parecer

INC-022 = INC-033 (Slalon; regra + IA) e INC-044 = INC-045 (parágrafo duplicado na p.80;
regra + IA).

## Exclusivos do NexoDoc conferidos no texto (amostra, não os 46)

Reais: INC-004 (2,5 m), INC-005 (70 L/min × 70 l/s), INC-006 (reservatório), INC-010
(cobre "0,254 mícrons"; NBR 13571 pede 254 µm), INC-021 ("reforma/repintura", alvenaria
existente), INC-024 ("pavimentos térreo, primeiro e segundo" em edificação de 1 pavimento),
INC-026 ("banheiros entre as salas de atividades" — reaproveitamento, como o "apartamento").

Não conferidos: os demais. A precisão do parecer inteiro não está medida.

---

# Segunda corrida — depois da calibração (17/09/2026, auditoria `5cb5b3b2`)

Parecer: `parecer-nexodoc-2026-09-17-calibrado.json` (profunda, 60 achados, 7min22s).
Mesma produção, mesmo PDF, obra de referência lida da capa. No ar: leitura da capa
(`9429c83`), régua única de faixa e validação que não rebaixa regra (`7b768dd`),
arredondamento (`0d9e183`), preço do sol (`4ab08ef`).

## Recall

**Manual: 8/9.** O casador diz 9/9 porque volta a casar AUD-003 ("terceira etapa") com o
INC-010 ("4 entregas"). O "terceira etapa" segue **não pego**. O que entrou:
AUD-009 (produtos finais sem capítulo) = INC-012.

## Gravidade

| | Antes (`849c9e8a`) | Depois (`5cb5b3b2`) |
|---|---|---|
| Hierarquia p.17 × p.21 | técnico (INC-007) | **crítico, INC-001** |
| Caixa de gordura | técnico, "premissa não rastreável" | **crítico, INC-007, "valor adotado diferente do usado na fórmula"** |
| 2.269,34 × 2.269,36 | crítico (INC-002) | **editorial (INC-049)** |
| Identidade × "Diário de Obra" | crítico, falso (INC-001) | **não existe** |
| Faixas | 6 crítico · 26 técnico · 23 editorial | 9 crítico · 31 técnico · 20 editorial |

Os 9 críticos: hierarquia (regra), poste "60x40m", tambor "0,88 cm", caixaria "2,5 m",
cobre "0,254 mícrons", hidrante 70 L/min × 70 L/s, caixa de gordura, reservatório, memória
dos contentores prometida e ausente.

Custo registrado: leitura global US$ 0,9118 (sol a $4/$20) + validação US$ 0,1743 + 15
transcrições ~US$ 0,008.

## Defeito que esta corrida revelou

O cabeçalho do parecer (`obra`, `orgao`, `municipio`) saiu da leitura solta do texto:
obra = linha "OBRA :" da tabela de drenagem, órgão com secretaria e obra colados,
município "Antônio Carlos" (a jazida). Consertado em `lib/identidade-do-parecer.ts`
(gabarito → capa → texto) depois desta corrida; o parecer `5cb5b3b2` gravado continua com
o cabeçalho errado.
