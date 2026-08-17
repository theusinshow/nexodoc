# Arquitetura da auditoria Deep — diagnóstico e avaliação da proposta

> 17/08/2026. **Nenhuma linha de código foi alterada por esta análise.**
> Tudo abaixo foi conferido na implementação, não na documentação.

---

## 1. Como o Deep funciona HOJE

### Fluxo real (`app/api/audit/route.ts`, `deepAnalyzeFile`)

```
extractPdfText                       pdfjs → páginas + texto  (0 IA)
  ↓
deriveMandatoryIdentityGuardFindings capa × corpo             (0 IA)
runWithinDocumentIdentityRules       identidade intra-doc     (0 IA)
runDocumentCoherenceRules            8 regras de coerência    (0 IA)
  ↓
analyzeIdentityWithModel             DESLIGADA (flag)
  ↓
analyzeFileGloballyWithModel         1 CHAMADA · doc inteiro
  ↓
analyzeDocumentCoherenceWithModel    só se texto > 700k E flag → nunca dispara
chunks                               chunkLimit = 0 → ZERO blocos
  ↓
runCrossDocumentRules                só com 2+ arquivos       (0 IA)
  ↓
validateFindingsWithModel            1 CHAMADA
  ↓
dedupeFindings → filterFalsePositive → compactRepeatedIdentity → sortAuditFindings
```

**No Deep de arquivo único: 2 chamadas de IA.**

### Parâmetros conferidos

| Item | Valor | Onde |
|---|---|---|
| Modelo (memorial/deep) | `gpt-5.6-sol` | `DEFAULT_AUDIT_MEMORIAL_DEEP_MODEL` |
| Modelo dos blocos | agora tem override próprio | `ai-providers.ts:468` |
| Esforço | **`medium`** | `getReasoningEffort` — `high` abortou em 480s e 900s no 063_26 |
| Contexto da global | **700.000 chars** | `DEFAULT_DEEP_GLOBAL_CONTEXT_CHARS` |
| Saída da global | **22.000 tokens** (teto 32k) | `getDeepGlobalMaxOutputTokens` |
| Blocos no Deep | **0** | `chunkLimit`, `route.ts` |
| **Contexto da validação** | **45k por arquivo, 90k total** | `buildValidationContext:82` |
| Teto de achados | **60, sendo ≤30 editoriais** | prompt, `route.ts:2328` |

### Regras determinísticas que já existem

`runDocumentCoherenceRules` — 8 regras: hierarquia documental, remissão quebrada,
parágrafo duplicado, marca sem "ou similar", aritmética de carga de incêndio,
**área total declarada divergente**, concessionária fora da microrregião,
linguagem rodoviária.

`runWithinDocumentIdentityRules` — identidade intra-documento.
`runCrossDocumentRules` — 6 campos entre arquivos (município, obra, endereço,
proprietário, código, revisão).

---

## 2. Diagnóstico — por que o recall caiu para 24%

São **cinco** causas distintas. Confundi-las leva a consertar a errada.

### (a) CONFIGURAÇÃO — a corrida nem foi Deep

O relatório do 084_25 diz **"Nível: Padrão"**. Causa direta: a remoção do slot
`nivel` (17/08) deixou o agente propor `{ kind: "auditoria" }` sem o campo, e
`clampNivel` (`normalize.ts:285`) devolve `"standard"` para qualquer coisa que
não seja literalmente `"deep"`.

No Padrão a global recebe **90.000 de 547.855 chars — 16%**, amostrados em
cabeça/meio/cauda, e lê 8 blocos.

**Isto sozinho explica a maior parte dos 19 achados perdidos**: eles estão em
p.14, 21-22, 37, 40, 48, 50-52, 140, 166-167, 175, 180-181, 188 — o miolo, que a
amostragem descarta. Os 6 acertos estão em p.25-29 e 207-218 — cabeça e cauda.

> **Nenhuma conclusão sobre arquitetura pode ser tirada deste benchmark.**
> Ele mediu a amostragem, não o motor.

### (b) DETERMINÍSTICO — a regra existe e não alcança o dado

`runDeclaredTotalAreaRule` (`audit-coherence.ts:792`) existe e deveria pegar
AUD-009/010/011. Não pegou, e o motivo é estrutural:

```js
/[áa]rea\s+(?:total\s+constru[íi]da|...)[^\d\n]{0,25}?(\d...)\s*m²/gi
```

Ela exige a **frase** "área total construída" imediatamente antes do número. Os
valores do benchmark (`4.448,91` no texto × `4.530,98` na tabela) estão numa
**célula de tabela** — sem frase nenhuma.

**A camada determinística inteira é ancorada em PROSA. Os achados numéricos do
benchmark moram em TABELAS.**

E até hoje de manhã as tabelas eram achatadas numa linha só
(`nexodoc-quebra-de-linha`), então nenhuma regra de tabela poderia funcionar
mesmo que existisse. **A correção de quebra de linha de hoje é pré-requisito de
tudo que se queira fazer com tabelas** — e ainda não foi explorada.

### (c) COBERTURA DA VALIDAÇÃO — o validador julga com 8% do documento

`buildValidationContext` chama `buildDocumentContext(file.extracted)` **sem
`analysisLevel`** — cai no recorte de 90k do Padrão — e depois corta em 45k por
arquivo.

**Numa auditoria Deep de 547k chars, o validador vê 8% do documento.**

Consequência direta e verificável: o falso positivo INC-003/004 ("Escola Geral",
p.181) sobreviveu porque **o validador provavelmente nunca viu a página 181**.
Ele não pôde refutar o que não leu.

Isto está documentado no próprio arquivo, com um comentário `ATENÇÃO ao nível` —
ou seja, é conhecido e não foi tratado.

### (d) PROMPT — uma chamada, dez trabalhos

O prompt da global pede identidade, cálculo, norma, hierarquia, escopo,
especificação, redação e classificação de impacto, sobre ~137k tokens, com teto
de 60 achados. Sem instrumentação não dá para separar o que se perde por
contexto longo do que se perde por competição de objetivos.

### (e) ARQUITETURAL — só depois de (a) a (d)

Só resta atribuir à arquitetura o que sobreviver aos quatro consertos acima.
**Hoje esse número é desconhecido.**

---

## 3. Avaliação da proposta, camada a camada

### 0. Extração / indexação — **RECOMENDADA, e é a mais urgente**

Existe: `pdf-text.ts` (páginas, `charCount`, `chunkPdfByChapter`),
`texto-do-pdf.ts` (costura por medida de vão), `getPageChapter`,
`disciplina-da-pagina.ts` (disciplina por cabeçalho), `impressaoDosCapitulos`.

Rastreabilidade **está preservada**: toda evidência carrega página, e
`locateTermOnPage` ancora o pin por coordenada.

**Falta o essencial: tabela.** `ExtractedPdfPage` é `{ page, text }` — texto
plano. Não há células, linhas, colunas nem cabeçalhos. O pdf.js entrega
`transform[4]`/`[5]` (x, y) por item — **os dados para reconstruir grade estão
disponíveis e são descartados**.

Sem isso, nenhuma regra numérica séria é possível, e o Ledger nasceria cego
justamente onde estão os números.

### 1. Camada determinística ampliada — **RECOMENDADA**, com ressalva à premissa

Você mandou questionar o "17 de 19 não precisam de IA". **Estava otimista.**
Reclassificando:

| Achado | Classe | Observação |
|---|---|---|
| AUD-004 "Atende? Não" | **A — 100% determinístico** | o documento se acusa; é regex |
| AUD-018 títulos 3.4.7/3.4.8 iguais | **A** | comparação de strings |
| AUD-021/022 numeração e remissão | **A** | já existe `runBrokenCrossReferenceRule` |
| AUD-016 unidade "(M)" para 15,0 | **A** | célula de tabela — depende de tabela |
| AUD-001/002 EEB + bairro Ceará | **B** | regra existe; falhou por gabarito truncado |
| AUD-009/010/011 áreas | **B** | aritmética trivial, **mas** decidir que "área arquitetônica" e "área total da tabela" são comparáveis é semântico |
| AUD-019 vazões | **B** | somar é trivial; saber que as duas somam para o total é semântico |
| AUD-012 gramada 1.949,67 × 1.947,47 | **B** | idem |
| AUD-017 405 × 1,30 ≈ 527 | **B** | a relação (empolamento) é conhecimento de domínio |
| AUD-008 455,81 A × 450 A | **B** | comparar é trivial; saber que disjuntor protege aquele transformador é semântico |
| AUD-006/007 motobomba | **C** | exige entender curva e regime |
| AUD-005 ocupação mista | **C** | interpretação normativa |
| AUD-014 parquinho × drenagem | **C** | conflito de escopo |
| AUD-015 CBUQ 5 × 4 cm | **C** | pode ser duas camadas |
| AUD-024 propriedade privada | **C** | exige documento externo |
| AUD-013 bases entre disciplinas | **C** | |
| AUD-023 responsabilidade técnica | **C** | (o Nexodoc já achou) |
| AUD-025 "Página 1" sobreposta | **A** | artefato de render |

**Placar honesto: A = 5 · B = 6 · C = 8.**

A conclusão muda: **a maioria precisa de IA para o JULGAMENTO**, mas quase toda
ela precisa de determinismo para a **DESCOBERTA**. É o padrão B que domina — e é
exatamente o que a proposta de Ledger + reconciliação endereça.

### 2. Document Ledger — **RECOMENDADO, com escopo reduzido**

O produto **já tem um proto-Ledger**: `extractIdentityFingerprint` e
`collectMentions` (`cross-document-audit.ts`) colhem valores com página,
evidência e canônico. `FIELD_SPECS` é literalmente um schema de fatos com
`patterns` + `canonical`.

O Ledger seria a generalização disso de 6 campos de identidade para grandezas
numéricas. **É evolução de código existente, não invenção.**

**Onde o Ledger ganha:** resolve exatamente o problema "p.37 = X, p.166 = Y" sem
o modelo precisar lembrar de ambos dentro de 137k tokens. Comparar 40 números
extraídos é trivial; achar 2 números distantes num contexto longo é o que
modelos fazem pior.

**Onde o Ledger PIORA — e é real:**

- **Perde o modificador.** "área construída **do bloco B**" e "área construída
  **total**" viram dois números da mesma grandeza; compará-los gera falso
  positivo. É o mesmo defeito que produziu o "Escola Geral" — estruturar sem
  qualificar.
- **Extração é onde nasce o erro.** Um valor extraído errado vira um achado
  confiante. Precisa de `confianca_extracao` e de nunca emitir achado sem
  reapresentar o trecho.
- **Schema fechado engessa.** Cada disciplina nova pede campo novo.

**Schema mínimo que o código sustenta hoje:**

```
{ grandeza, valor, unidade, qualificador, pagina, trecho,
  disciplina, origem: "prosa"|"tabela", confianca }
```

O `qualificador` é o campo que impede o Ledger de virar fábrica de falso
positivo. Sem ele, não vale construir.

### 3. Reconciliação determinística — **RECOMENDADA**

É a metade que dá valor ao Ledger. Gera **candidatos**, não achados; a IA decide
se é erro. Isso é o oposto do modo atual (IA descobre e a regra não participa) e
é o que reduz custo e alucinação ao mesmo tempo.

### 4. Auditorias especializadas — **RECOMENDADA COM ALTERAÇÕES**

Um auditor por disciplina (10+) é **excesso**. Riscos: custo linear, contradição
entre auditores, 10 prompts para manter, e perda de relação entre disciplinas —
que é justamente onde estão AUD-013 e AUD-014.

**Recomendo agrupar por NATUREZA DO ERRO, não por disciplina** — 4 auditores:

| Auditor | Escopo | Esforço |
|---|---|---|
| Identidade e escopo | obra, local, escopo, reaproveitamento | baixo |
| Técnico-numérico | candidatos da reconciliação | alto |
| Normativo-contratual | normas, responsabilidade, prevalência | médio |
| Editorial | português, duplicação, estrutura | **mínimo** |

Justificativa: a disciplina já é detectada (`disciplinaPorPagina`) e serve para
**rotear contexto**, não para multiplicar agentes. E erros da mesma natureza
compartilham critério — é isso que um prompt ensina bem.

### 5. "Uma chamada por capítulo" — **você está certo em desconfiar**

Medi hoje: 72 capítulos de ~5k chars num memorial de 361k. Um bloco por capítulo
custou **US$ 14,77 contra US$ 4,46 agrupados** — mesma cobertura. **Quem domina
o custo é o NÚMERO de chamadas** (prompt fixo + teto de saída por chamada), não
o tamanho do texto.

E blocos de 28k **truncaram 20 de 25 vezes** hoje, queimando o teto inteiro.

**Estratégia melhor:** blocos por **densidade**, não por capítulo — agrupar até
~10k chars respeitando fronteira de capítulo (já implementado em
`agruparBlocosParaLeitura`), com esforço por tipo de conteúdo.

### 6. Auditor global com função nova — **RECOMENDADO, é a melhor ideia da proposta**

Hoje a global tenta achar tudo em 137k tokens. Recebendo Ledger + resumos +
achados das camadas anteriores, ela faria só o que ninguém mais faz: **contradição
entre partes distantes**.

O código **já produz o insumo**: `runtime.sintese` (resumo por capítulo, gravado
em todo parecer) existe e, até hoje, nunca tinha sido lido por nada.

Ganho estimado de contexto: de ~137k tokens para ~15-25k.

### 7. Validação focalizada — **FORTEMENTE RECOMENDADA. É o melhor custo-benefício da lista.**

Hoje: 1 chamada com 45k de contexto amostrado (8% do doc) julgando ~25 achados.

Proposto: por achado, `hipótese + evidência A + evidência B + contexto local`.

**Por que quase certamente aumenta a precisão:** o validador passa a **ver a
página do achado**. Hoje ele julga sem ela — foi assim que o "Escola Geral"
sobreviveu.

**Custo:** N chamadas pequenas contra 1 média. Provavelmente sobe, mas pouco: o
contexto local de um achado é ~2k chars contra 45k. Mitigável validando só
`confiança média` e `severidade alta` (a triagem que o item 12 da proposta sugere,
e que eu endosso).

### 8. Consulta normativa — **DESNECESSÁRIA AGORA**

**Não existe nada** de normas no repositório: nenhum módulo, base ou índice. Os
achados normativos atuais (INC-014/015) são "verifique a vigência" — honestos e
úteis sem base normativa.

Construir RAG de normas é um projeto próprio, com licenciamento de conteúdo ABNT.
**Fora do caminho crítico.** O ganho no benchmark é ~1 achado.

### 9. Passada editorial própria — **RECOMENDADA**

Barata e desimpede a principal. Dos 25 achados do Nexodoc, **7 são editoriais** —
e o prompt reserva metade do teto de 60 para eles. Separar libera o teto técnico
e permite esforço mínimo no editorial (é o trabalho mais fácil da lista).

### 10. Teto de 60 achados — **PROBLEMA REAL**

Fica no prompt (`route.ts:2328`), não em código, e é **global durante a
descoberta**. Num documento de 218 páginas isso pode cortar antes de terminar.

**Sua alternativa está certa:** teto **por bloco** + dedupe + ranking depois.
Limitar na descoberta é decidir o que não olhar; limitar na apresentação é decidir
o que mostrar.

### 11. Achado estruturado — **JÁ EXISTE, quase todo**

`AuditFinding` já tem `categoria`, `tipo`, `prioridade`, `confianca`,
`evidencia`, `pagina`, `impacto`, `origem`, `tier`, `disciplina`,
`termo_busca`. **Falta pouco:** `evidencias[]` (plural — hoje é uma string
concatenada com `|`) e `requer_validacao`.

A triagem por confiança/severidade que você propõe **é implementável hoje** com o
que já existe.

### 12. Dedupe e ranking — **JÁ EXISTE, e vai precisar de mais**

`dedupeFindings` (chave: arquivo+tipo+página+120 chars), `compactRepeatedIdentityFindings`,
`filterFalsePositiveIdentityFindings`, `sortAuditFindings`.

Com 4 auditores + regras + global, a chave textual atual **não basta**: dois
auditores descrevem o mesmo defeito com palavras diferentes. Vai precisar de
fingerprint por `(página, grandeza/termo, tipo)` e merge que preserve a melhor
evidência.

---

## 4. Riscos que eu levanto contra a proposta

1. **Complexidade de depuração.** Hoje: 2 chamadas. Proposto: extração + ledger +
   reconciliação + 4 auditores + global + N validações. Quando o parecer sair
   errado, achar onde é ordem de grandeza mais difícil. **Exige rastro por
   camada no relatório.**
2. **O Ledger pode piorar a análise** onde o texto é mais rico que a estrutura —
   ver o problema do qualificador.
3. **Custo escondido:** cada auditor reenvia contexto. Com 4 auditores × N blocos,
   o prompt fixo é pago 4N vezes.
4. **Latência.** Hoje ~250s. Com paralelização real (o `getChunkConcurrency` já
   existe, teto 4) dá para segurar, mas o pior caso cresce.
5. **Onde a chamada monolítica é SUPERIOR:** contradições que dependem de ler
   duas partes distantes com o texto original na frente. Um Ledger perde nuance;
   um resumo perde mais ainda. **É por isso que a global deve continuar existindo**
   — com função nova, não extinta.

**Alternativa mais barata que a proposta inteira, e que eu colocaria primeiro:**
consertar (a), (b), (c) e medir. Se o recall for a 60-70%, boa parte desta
arquitetura vira otimização, não necessidade.

---

## 5. O QUARTO problema crítico (você perguntou se existe)

**Sim: a validação enxerga 8% do documento** (§2c). Eu o classificaria acima do
"relatório honesto" na ordem, porque:

- é a única defesa contra falso positivo;
- os 3 FPs de hoje passaram por ela;
- e o veredito 🔴 NÃO EMITIR foi construído sobre eles.

Um validador que não vê a página do achado não valida — carimba.

---

## 6. Arquitetura recomendada

```
EXTRAÇÃO            páginas + capítulos + disciplina + TABELAS (falta)
   ↓
DETERMINÍSTICO      regras atuais + não conformidade declarada
                    + estrutura + Ledger de grandezas
   ↓
RECONCILIAÇÃO       candidatos numéricos (não achados)
   ↓
LEITURA POR BLOCO   ~10k chars, fronteira de capítulo, 4 naturezas
   (paralelo)       editorial com esforço mínimo
   ↓
GLOBAL REDUZIDA     Ledger + sínteses + achados → só contradição distante
   ↓
VALIDAÇÃO FOCAL     por achado, com a página dele; triada por confiança
   ↓
DEDUPE + RANKING    fingerprint por (página, termo, tipo)
   ↓
RELATÓRIO           com COBERTURA declarada
```

**A diferença central para hoje:** a IA deixa de ser o mecanismo de DESCOBERTA e
passa a ser o de JULGAMENTO. É a doutrina que o projeto já tem escrita
("regra = fato objetivo, IA = contexto") e que a implementação atual não cumpre.

---

## 7. Estratégia incremental — com benchmark entre cada etapa

| Fase | O quê | Custo | Recall esperado |
|---|---|---|---|
| **0** | Baseline: rodar o 084_25 no Deep de verdade | ~US$ 1,50 | **medir** |
| **1** | 4 fixes: nível deep · cobertura no relatório · gabarito truncado · **validação vê a página** | ~0 | ↑↑ + FPs ↓ |
| **2** | Não conformidade declarada + estrutura (títulos, numeração) | ~0 | +3 achados |
| **3** | Cobertura total (já pronta, desligada) | ↑↑ | ↑↑ |
| **4** | Tabelas na extração → Ledger numérico + reconciliação | ~0 na descoberta | +6 achados |
| **5** | Passada editorial separada | baixo | libera teto técnico |
| **6** | 4 auditores + global reduzida | ~↔ | resto |

**Fases 1, 2 e 4 quase não custam token** — são determinísticas. A fase 3 é a
cara. Fazer 1-2 antes de 3 significa medir o ganho barato antes de pagar o caro.

---

## 8. Métricas

`scripts/audit-precision-recall.ts` já existe, mas **só roda os motores
determinísticos** — não mede o pipeline com IA. Precisa de um harness que rode a
auditoria completa contra o benchmark AUD-001..025.

Recall **por natureza** (identidade, numérico, estrutural, normativo, editorial,
técnico) é mais acionável que o geral: 24% não diz onde investir; "numérico 0%,
estrutural 66%" diz.

Custo, tokens e latência **já estão instrumentados** (`AiUsageEvent`,
`npm run gasto:auditoria`). Não precisa construir nada.

## 9. Critério de parada

Descartar mudança que custe **>30% mais** por auditoria e entregue **<3 pontos**
de recall; ou que dobre a latência por <5 pontos. E parar de somar camadas quando
o **falso positivo** subir — precisão perdida custa mais que recall ganho num
produto que sustenta emissão de projeto.

## 10. Recomendação final

**Se eu fosse o responsável técnico hoje:**

1. **Não refatoraria nada esta semana.** Os 4 fixes + cobertura total e medir. A
   probabilidade de o recall saltar para 60%+ só com isso é alta, e refatorar
   antes de saber seria repetir o erro que me custou US$ 6 hoje: mudar arquitetura
   com base em número que media outra coisa.
2. **Médio prazo, buscaria a arquitetura do §6** — em especial tabelas → Ledger →
   reconciliação, que é onde está o maior bloco de achados perdidos e o menor
   custo marginal.
3. **Não construiria RAG normativo** nem um auditor por disciplina. Complexidade
   alta, ganho pequeno no benchmark.

**A pergunta que decide tudo é a Fase 0**, e ela custa ~US$ 1,50.
