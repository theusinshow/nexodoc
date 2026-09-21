# Jev (TypeSafe AI) no NexoDoc — análise antes de integrar

> 21/09/2026. **IMPLEMENTADO no mesmo dia** — os quatro encaixes estão na main
> (`01fc29f`, `86ea513`, `05b3997`). Este documento ficou como o registro do
> raciocínio; o que a implementação descobriu e corrigiu está em **§12**, no
> fim, e em três pontos ela contradiz o que está escrito aqui.
>
> Duas passadas de análise: a primeira enquadrou o Jev como substituto de
> chamadas existentes e concluiu "−5%, não vale". Esse enquadramento estava
> errado, e a segunda passada o corrige.

**Veredito:** não é troca, é **soma**. Uma camada rápida entra **ao lado** do
que existe, nunca no lugar — e o valor dela não é economizar, é **pegar o que
hoje escapa**. São quatro encaixes concretos (§7), todos aditivos, nenhum deles
capaz de apagar achado. Custo de somar os quatro: **centavos por auditoria**.

O fornecedor é a parte menos importante da decisão: o padrão roda hoje no
`gpt-5.6-luna`, que já está em produção. O Jev entra quando o volume justificar,
atrás da mesma função.

---

## 0. O que eu errei na primeira passada

Enquadrei o Jev como "o que ele substitui das chamadas que já existem". Por esse
critério ele quase não move nada, porque o gasto do NexoDoc está em *ler um
memorial inteiro* e *escrever achados* — duas coisas que o Jev não faz.

Mas não é isso que os devs estão vendo. O que eles estão vendo é **decisão de IA
em lugar onde você nunca chamaria um LLM**: dentro de um laço, por item, por
linha, por trecho. Não é "a mesma arquitetura mais barata", é "uma arquitetura
que antes não fechava a conta".

E o NexoDoc tem **exatamente** esse tipo de lugar — o maior deles tem 1.621
linhas e se chama `lib/audit-coherence.ts`. Isso a primeira passada não testou.
As seções §4 a §8 são a passada honesta.

---

## 1. Arquitetura atual (o que o código faz hoje)

Fonte: `app/api/audit/route.ts` (4.636 linhas), `lib/audit-*.ts`,
`lib/cross-document-audit.ts`, `lib/audit-coherence.ts`, `lib/pdf-text.ts`.

```
upload (POST /api/audit, multipart, ate 5 PDFs, teto 40 MB)
  |  pre-voo deterministico: limite-do-anexo, nao-e-prancha, pagina-muda
extracao   -> extractPdfText + tabela-do-pdf (grade) + transcricao
  |
regras     -> SEM IA, sempre ativa:
              . deriveMandatoryIdentityGuardFindings  (guarda obrigatoria)
              . runWithinDocumentIdentityRules        (identidade intra-doc)
              . runDocumentCoherenceRules             (1.621 linhas)
              . deriveSpelling / Summary / TechnicalReuse / MemorialConsistency
  |
global     -> 1 chamada, documento inteiro (ate 700k chars no Profundo)   [sol]
blocos     -> chunkPdfByChapter (28k chars) + agruparBlocosParaLeitura    [sol]
  |
evidencia  -> filterGroundedFindings: o trecho citado tem de existir (SEM IA)
confronto  -> so com mais de 1 arquivo: cross-document                    [IA]
  |
validacao  -> 1 chamada em lote sobre TODOS os candidatos                 [sol]
              . achado de IA: pode virar "Sugestao" (camada recolhivel)
              . achado de REGRA: NAO pode ser removido nem rebaixado ->
                vira ContestacaoDeRegra (lib/decisao-da-validacao.ts)
  |
parecer    -> severidade deterministica -> impressao-do-achado (dedupe)
              -> Postgres + IndexedDB -> UI
```

### Custo e latência MEDIDOS (banco de dev, 17 auditorias, `AiUsageEvent`)

| modelo | operação | n | in méd. | out méd. | latência méd. | custo |
|---|---|---:|---:|---:|---:|---:|
| `sol` | `audit-global` | 7 | 113.949 | 14.227 | 263 s | US$ 6,37 |
| `sol` | `audit-chunk` | 25 | 7.602 | 5.000 | 81 s | US$ 4,56 |
| `sol` | `audit-validation` | 7 | 29.382 | 6.349 | 98 s | US$ 2,36 |
| `terra` | `audit-chat-turn` | 71 | 22.676 | 104 | 2,6 s | US$ 1,39 |
| **`luna`** | **`nexo-selo`** | **100** | **6.606** | **178** | **3,3 s** | **US$ 0,108** |
| `luna` | `nexo-volume-check` | 55 | 7.159 | 376 | 4,7 s | US$ 0,069 |

Auditoria profunda real (`bbf367fe…`): 27 chamadas, 350k in, 149k out,
**US$ 6,09**, 323 s, 56 achados.

**Guarde a linha do `luna`: US$ 0,0011 por decisão de conjunto fechado, 3,3 s,
já em produção.** É contra esse número que o Jev tem de competir, não contra o
`sol`. Ver §8.

**A "Fase 0 — instrumentação" da proposta já existe.** `AiUsageEvent` grava
flow/operation/modelo/tokens/custo/duração/metadata; `scripts/gasto-da-auditoria.ts`
soma pela mesma tabela de preço do produto.

---

## 2. Jev — documentação oficial

- `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`.
- Corpo: `state` (o que julgar) + `questions` (mapa nomeado) + `model`.
- Primitivas: **`noul`** (probabilidade 0–1), **`choice`** (máx. 255 opções →
  devolve `choice`, `probabilities`, `confidence`), **`score`** (rubrica 2–10).
- Todas as perguntas viajam **na mesma chamada**, em paralelo e em isolamento;
  acrescentar pergunta quase não muda a latência. *Esta é a propriedade que
  importa* — ver §5.
- **64k tokens/requisição**, **32k** para state + a maior pergunta.
- Rate limit `jev-1.13`: 250k tok/s, 1.200 req/min — com aviso do fornecedor de
  que **mudam sem aviso**.
- **US$ 0,042 / M de entrada. Saída gratuita.**
- Erros 401 / 422 / 429 / 529, retry com backoff nos SDKs.
- Legal: ZDR só para **enterprise**; declara não treinar em dado de usuário;
  região de processamento e subprocessadores **não documentados**.
- **Early access por lista de espera. Lançou em 16/09/2026** — cinco dias antes
  desta análise.

### Claims do fornecedor — não verificados
70–500 ms; "40–200× mais rápido"; "193,6× mais rápido, 444,6× mais barato";
"0% de alucinação" (type-safety do schema); "probabilidades calibradas".
O próprio post admite que os evals foram construídos pela equipe deles, que a
referência é a **média de dois modelos grandes** (não ground truth), e que os
ganhos estão *"on the higher end of real world gains"*.

---

## 3. A evidência independente — três números que mudam tudo

Esta é a parte que faltava na primeira passada, e ela corta para os dois lados.

### 3.1 Decomposição: 62,6% → 95%
Benchmark independente com 2.000 e-mails (PhishNChips v5.2):

| abordagem | Jev | Haiku 4.5 |
|---|---:|---:|
| pergunta única ("isto é phishing?") | **62,6%** | 81,3% |
| **5 perguntas atômicas + regressão logística** | **95,0%** | 93,2% |

Jev perguntado de forma composta é **pior que um modelo pequeno**. Decomposto em
perguntas atômicas, empata com o frontier por 27× menos. E a conclusão do estudo
é a frase que deve governar qualquer adoção:

> os 95% não são o Jev — são "o Jev **mais os seus dados rotulados** mais uma
> regressão que você mantém".

### 3.2 Calibração: não confie no `confidence` de fábrica
Estudo independente em tickets sintéticos: **ECE 0,107 — 4,4× o piso de ruído**
de 0,024. Direções opostas por tipo:

- `noul` (sim/não): **sub**confiante (temperatura de reajuste 0,66)
- `choice` e `score`: **super**confiantes (3,29 e 3,40)

E o resultado que mais importa para auditoria de memorial: numa pergunta cuja
resposta dependia de informação **que não estava no texto**, o Jev acertou
**44,7% das vezes atribuindo probabilidade média de 0,74**. Confiantemente
errado no que não dá para saber.

Isso é fatal para metade das perguntas que um memorial provoca, porque metade
delas é "isto está errado ou eu só não estou vendo o resto do documento?".
Mitigação obrigatória: toda `choice` precisa de uma opção **"nada disto"**, e só
a faixa de **0,99** pode automatizar antes de haver dado nosso.

### 3.3 O concorrente que ninguém está citando
Agregado de terceiro, concordância com Fable 5.1 como referência, por milhão de
respostas julgadas:

| | concordância | custo / M |
|---|---:|---:|
| Fable 5.1 (referência) | — | US$ 33.000 |
| **DeepSeek V4.1 Flash** | **93,5%** | US$ 260 |
| **Jev** | 91,5% | US$ 160 |
| GPT-5.6 Luna | — | US$ 400 |

**O DeepSeek Flash concorda 2 pontos melhor que o Jev por US$ 100 a mais por
milhão.** Ou seja: a vantagem do Jev não é qualidade, é preço — e só compensa
onde "US$ 100 por milhão" é dinheiro. Ver §7.

---

## 4. Por que os devs estão certos (e no que exatamente)

O que é genuinamente novo, e que eu subestimei:

1. **Saída gratuita.** Todo teto de saída do NexoDoc existe porque saída custa
   US$ 20/M no `sol` — e o produto já pagou por isso: *"24% dos blocos
   censurados no teto entre jun e ago/2026"*, e uma auditoria em que 71% do
   gasto foi para 20 blocos que truncaram e devolveram zero. Uma camada com
   saída gratuita **não tem teto de saída**. Isso remove uma classe inteira de
   defeito, não um custo.
2. **Fan-out especulativo.** 30 perguntas numa chamada custam o mesmo que 1,
   porque o preço é do `state`. Você passa a perguntar tudo que *poderia*
   importar, em vez de só o que vale a chamada.
3. **Latência de 70–500 ms** contra 3,3 s do `luna` medido aqui. Decisão dentro
   de laço passa a ser possível, não só barata.
4. **Probabilidade como saída de primeira classe.** Hoje `confianca` no
   NexoDoc é *string livre vinda do modelo* — não calibrada, não comparável,
   não ordenável. Uma distribuição de probabilidade permitiria ordenar achados
   por P(real), coisa que o produto não sabe fazer.

Nada disso é marketing. É por isso que o pessoal está animado, e a animação faz
sentido **para produtos que tomam milhões de decisões**.

---

## 5. Onde isso bate no NexoDoc: `audit-coherence.ts`

O lugar mais forte não está em nenhuma das listas da proposta original.

`lib/audit-coherence.ts` tem **1.621 linhas** e ~12 regras. Algumas são
aritmética pura e estão certas como regra — `runFireLoadArithmeticRule`,
`runDeclaredTotalAreaRule`, `runSewageExceedsWaterRule`. **Essas o Jev não
encosta** (a documentação independente lista aritmética como fraqueza dele).

Mas as outras são **julgamento semântico escrito em regex, com janela
arbitrária**:

| regra | o julgamento real | a constante arbitrária |
|---|---|---|
| `runBrandWithoutSimilarRule` | "a marca foi citada sem ressalva de equivalência?" | `ALCANCE_DA_RESSALVA = 420` caracteres |
| `runDuplicateParagraphRule` | "estes dois parágrafos são o mesmo texto reaproveitado?" | `MIN_PARAGRAFO = 180`, `MAX_DISTANCIA_DE_PAGINAS = 0` |
| `runSiblingDuplicateTitleRule` | "dois irmãos com o mesmo título são erro ou repetição legítima?" | limite de título 2–118 chars |
| `runBrokenCrossReferenceRule` | "esta remissão aponta para item que existe?" | regex de 6 verbos de remissão |
| `runDeclaredNonComplianceRule` | "isto é uma declaração de não conformidade?" | lista fechada de frases |
| `cross-document-audit.ts` | "estes dois nomes são a mesma obra?" | tabela à mão de 9 siglas + lista de stop-words + caso especial da palavra `bairro` |

E há a camada de pós-processamento — `isLowValueModelFinding`,
`isLikelyFalseIdentityFinding`, `filterFalsePositiveIdentityFindings`,
`compactRepeatedIdentityFindings`, `shouldKeepIdentityCandidate`,
`ehNomeProprio`, `sugestaoEhAcionavel`. Todas fazem a mesma coisa: **um
julgamento semântico, por item, em código**, porque perguntar a um modelo por
item nunca fechou a conta.

Isso é literalmente a categoria de problema que o Jev existe para atender. E o
tamanho do laço é conhecido: um memorial de 132 páginas vira ~25 blocos; uma
auditoria produz ~56 achados. Com fan-out, **25 chamadas com 30 perguntas cada
cobrem o documento inteiro, com garantia de cobertura e sem teto de saída**.

Custo disso no Jev: 25 × 7.600 tokens = 190k → **US$ 0,008**.
No `luna`: **US$ 0,04**. No `sol`: US$ 0,76 mais a saída.

---

## 6. O que continua sendo "não use"

Nada aqui mudou entre as duas passadas — e a evidência independente reforçou.

| caso | veredito | motivo |
|---|---|---|
| **Filtro de contexto antes do modelo grande** | **NÃO** | Reverte a cobertura total; reconstrói o defeito de 17/08 (validação julgava com 8% do documento, e foi assim que os FPs "Escola Geral" sobreviveram — o validador nunca viu a p. 181). Economiza US$ 0,19 numa auditoria de US$ 6,09. E "context rot" é fraqueza documentada do próprio Jev. |
| Gravidade / faixa de impacto | **NÃO** | `lib/severidade.ts` é determinístico *de propósito*: "a consequência define a faixa". Decisão de 12/08/2026, tomada **tirando** IA daqui. |
| Tipo de documento | **NÃO** | `lib/audit-classify.ts` já faz, sem IA, na entrada. |
| Disciplina (página com cabeçalho) | **NÃO** | Está escrito na página. Docblock explícito: "POR QUE ISTO É REGRA E NÃO IA". |
| `084_25` × `084-25` | **NÃO** | Já normalizado. A própria proposta suspeitava; confirmado. |
| Aritmética (carga de incêndio, áreas, vazões) | **NÃO** | Regra está certa, e aritmética é fraqueza documentada do Jev. |
| Leitura de selo / prancha | **NÃO** | É visão. Jev não tem. |
| Gerar ou reescrever achado | **NÃO** | Jev não produz texto. A validação de hoje reescreve `descricao`/`conflito`/`sugestao_correcao` — não dá para substituí-la, só o eixo da decisão. |
| Roteador de agentes | **ADIAR** | Não existem agentes especializados. |
| `DecisionEngine` / `/services/` | **NÃO** | Overengineering para um consumidor. `AiProvider = "openai"` é decisão, não esquecimento. |

---

## 7. Os três encaixes — onde a camada rápida SOMA

O objetivo não é substituir nada. É pôr um **conferente** ao lado do motor, que
trabalha junto com ele e pega o que hoje escapa. Nenhum dos três apaga achado;
os três só acrescentam.

### Encaixe 1 — Segunda assinatura no achado de regra
**Mata falso positivo, sem poder matar achado.**

Hoje: `deriveMandatoryIdentityGuardFindings`, `runWithinDocumentIdentityRules` e
`runDocumentCoherenceRules` emitem achado, e `lib/decisao-da-validacao.ts`
**blinda** esse achado — a validação não pode removê-lo nem rebaixá-lo. Quando a
regex erra, o erro vai inteiro para o parecer. Os casos escritos nos comentários:
117_25 ("Unidade Básica de Saúde Vila Manaus" × "UBS VILA MANAUS"), 084_25
("Escola Geral", p. 181), 084_25 de novo (gabarito com parêntese, "ginásio").

Com a camada: cada achado de regra recebe 4–5 **perguntas atômicas** de conjunto
fechado sobre o par. A discordância vira `ContestacaoDeRegra` — **o canal já
existe**, já vai para o parecer e para o log de quem mexe na regra.

Quem faz isso hoje é o `sol`, em lote, a US$ 0,28 e 98 s — e justamente sobre o
tipo de achado de que ele é impedido de tratar. A camada faz por decisão, em
centenas de milissegundos, e o veredito dela é **insumo**, nunca ação.

### Encaixe 2 — Rede de arrasto onde o modelo grande não leu
**Mata falso negativo. É o encaixe mais valioso.**

O motor já sabe, com precisão, onde ele não olhou. `CoberturaDoArquivo` grava
`caracteres_lidos / caracteres_totais` e `blocos_lidos / blocos_totais`;
`resumo-do-esforco.ts` existe porque um parecer chegou a afirmar 98 blocos tendo
lido 8. Medido: **24% dos blocos censurados no teto entre jun e ago/2026**, e
uma auditoria em que 71% do gasto foi para 20 blocos que truncaram e devolveram
zero.

Hoje o sistema só consegue **declarar** o buraco. Tapá-lo custa outra passada de
`sol` — US$ 0,76 de entrada por bloco, mais a saída, mais 81 s.

Com a camada: **todo bloco que o motor não leu é varrido** com a lista fechada
de defeitos recorrentes — as ~12 regras de coerência transformadas em perguntas,
mais o que o escritório sabe que erra. Cobertura garantida, **sem teto de saída**
(a saída do Jev é gratuita; no `luna` são ~200 tokens).

- 25 blocos × 7.600 tokens = **US$ 0,008** no Jev, **US$ 0,04** no `luna`.
- O achado sai marcado como `rede` — profundidade menor que a do `sol`,
  declarada como tal, mas **existindo** em vez de nunca ter sido procurado.
- `coberturaCompleta()` deixa de ser binária: passa a ter *lido a fundo* e
  *varrido*, e "análise parcial" deixa de significar "ninguém olhou".

Os dois níveis trabalham juntos de verdade aqui: o caro descobre onde lê, o
rápido garante que **nenhuma página fica sem ninguém olhando**.

### Encaixe 3 — Certeza medida em vez de string livre
**Melhora a ordenação, sem mexer na matriz.**

`lib/severidade.ts` decide a prioridade por **consequência × certeza**, e a regra
é explícita: *"a consequência define a faixa; a certeza move dentro dela, nunca
para fora"*. A função `certeza()` usa `finding.confianca` — que, para achado de
IA, é **campo de texto livre que o próprio modelo escreveu sobre si**. Não é
calibrado, não é comparável entre achados, não é ordenável.

Trocar esse insumo por uma probabilidade medida melhora a matriz **sem alterar
uma linha da regra dela**. É upgrade puro: mesma arquitetura, entrada melhor.

### Encaixe 4 (candidato) — "estes dois são o mesmo defeito?"
`impressao-do-achado.ts` documenta a medição: a chave antiga rendia **7%** de
estabilidade entre duas corridas do mesmo documento; a atual rende **48%**, e as
chaves que rendiam mais fundiam defeitos distintos. Sobram ~52% de achados que
reaparecem como novos na reauditoria.

"Estes dois relatos são o mesmo defeito?" é `noul` puro, sobre um state de duas
frases. Aditivo: na dúvida, mantém os dois — que é o comportamento de hoje.

---

## 8. Quanto custa SOMAR (não trocar)

Os quatro encaixes, por auditoria profunda real (56 achados, 25 blocos):

| encaixe | decisões | com Jev | com `luna` |
|---|---:|---:|---:|
| 1 — assinatura no achado de regra | ~15 × 5 perguntas | US$ 0,0002 | US$ 0,017 |
| 2 — rede de arrasto nos blocos | 25 × 30 perguntas | US$ 0,008 | US$ 0,040 |
| 3 — certeza calibrada | 56 | US$ 0,0006 | US$ 0,062 |
| 4 — dedupe pareado | ~200 pares | US$ 0,003 | US$ 0,020 |
| **total somado** | | **~US$ 0,012** | **~US$ 0,14** |

Contra uma auditoria de **US$ 6,09**: o conferente inteiro custa **0,2%** com
Jev, **2,3%** com `luna`. Em nenhum dos dois o custo é argumento contra.

E é por isso que a escolha do fornecedor **não é a decisão importante aqui**. Na
escala do NexoDoc (~50.000 decisões/mês), a diferença entre Jev e `luna` é de
**US$ 12 por mês**:

| camada rápida | US$/mês | latência | fornecedor novo |
|---|---:|---:|:-:|
| Jev | 8 | 70–500 ms | sim, early access de 5 dias |
| **`luna` — já em produção** | **20** | 3,3 s (medido) | **não** |
| `sol` (para comparar) | 1.650 | 80 s | não |

O que decide é o **padrão**, não o fornecedor: o benchmark independente mostra
que 62,6% → 95% veio da **decomposição em perguntas atômicas**, e isso vale
igual no `luna`. Construir a função certa hoje com `luna` e trocar a
implementação por Jev depois é uma linha; construir errado e ter de refazer a
integração é o custo real.

---

## 8b. O desenho

```
                 EXTRACAO
                    |
   +----------------+----------------+
   |                                 |
REGRA (soberana, sem token)   MODELO GRANDE (le, descobre, escreve)
   |                                 |
   |  achado de regra                |  achado de IA + cobertura medida
   |                                 |
   +--------> CONFERENTE  <----------+      camada rapida, ADITIVA
              (luna hoje, Jev depois)
                    |
      +-------------+-------------+-------------+
      |             |             |             |
   assina o      varre o que    mede a        funde o
   achado de     ninguem leu    certeza       repetido
   regra         (Encaixe 2)    (Encaixe 3)   (Encaixe 4)
      |             |             |             |
      v             v             v             v
  Contestacao   achado "rede"  P(real)      dedupe
  (ja existe)   (novo)         calibrado

  REGRA DE OURO: o conferente NUNCA remove nem rebaixa achado.
  Ele assina, varre, mede e agrupa. Falhou / 429 / timeout ->
  a auditoria sai exatamente como sai hoje.
```

---

## 9. Riscos

| risco | gravidade | mitigação |
|---|---|---|
| `confidence` mal calibrado (**ECE 4,4× o piso**, `choice` superconfiante) | **Alta** | Nenhum limiar antes de temperatura ajustada com dado nosso. Só faixa 0,99 automatiza. |
| **Confiantemente errado no indecidível** (44,7% certo a P=0,74) | **Crítica** | Toda `choice` com opção "nada disto" / `insufficient_information`. Metade das perguntas de memorial é indecidível a partir do trecho. |
| Pergunta composta rende **pior que modelo pequeno** (62,6% vs 81,3%) | Alta | Decompor é obrigatório, não otimização. |
| Early access de 5 dias; rate limits "mudam sem aviso" | Alta | Nunca no caminho síncrono. Fallback: sem a camada, a auditoria roda como hoje. |
| Falso negativo se a camada puder suprimir achado | **Crítica** | Só anexa contestação. Nunca remove. |
| Sem dado para calibrar | Alta | Em dev: 23 `CONFIRMED`, 59 sem veredito, **zero `FALSE_POSITIVE`**. O gabarito hoje são os FPs escritos nos comentários e `docs/benchmarks/`. |
| `JEV_API_KEY` vazando | Alta | Precedente real: `sk-proj` em 169 linhas do banco e no painel admin. Fora de `metadata`, fora do painel. |
| Documento de cliente saindo para terceiro | Alta | ZDR só enterprise, região não documentada. Mandar dois nomes e uma frase — nunca o memorial. |
| Alias de modelo muda a calibração em silêncio | Média | Pinar versão (`jev-1.13.0`), não `jev-latest`. |
| Segundo fornecedor reverte "um provedor só" (13/08) | Média | Por isso Fase 3 roda em `luna`. |

---

## 10. Matriz final

| Decisão | Det. | Camada rápida | LLM grande | Humano |
|---|:-:|:-:|:-:|:-:|
| Código `084_25`/`084-25`, município × alvo | ✅ | | | |
| Tipo de documento, disciplina (com cabeçalho) | ✅ | | | |
| Evidência existe no texto (`filterGroundedFindings`) | ✅ | | | |
| Aritmética: carga de incêndio, áreas, vazões | ✅ | | | |
| Gravidade / faixa de impacto | ✅ | | | |
| **"EEE Lagoa da Serra" = "Estação Elevatória…"?** | | **✅** | | |
| **Marca sem ressalva de equivalência** (janela de 420 chars) | | **✅** | | |
| **Parágrafo reaproveitado de outro projeto** | | **✅** | | |
| **Título irmão duplicado é erro ou repetição legítima?** | | **✅** | | |
| **Dois achados são o mesmo defeito?** (dedupe, hoje 48%) | ○ | **✅** | | |
| Faixa de impacto quando o modelo não declarou | ○ | ✅ | | |
| Trecho genérico é reúso? (indecidível pelo trecho) | | ○ | ✅ | |
| Achar e descrever o achado | | | ✅ | |
| Correlação entre dezenas de páginas (>32k de state) | | | ✅ | |
| Leitura visual de prancha / selo | | | ✅ | |
| Aceitar ou recusar o achado; mudar a regra | | | | ✅ |

"Camada rápida" = `luna` hoje, Jev quando o volume justificar.

---

## 11. Plano — um encaixe por vez, nenhum irreversível

A ordem é por **risco crescente**, não por valor. O Encaixe 2 vale mais, mas o 1
é o que se prova sem inventar gabarito novo.

**Passo 1 — a função, não o fornecedor.** Um arquivo:
`state` + perguntas de conjunto fechado → escolha + probabilidade. Implementada
com `luna`, gravando em `AiUsageEvent` num flow novo. Sem pasta `/services/`,
sem registro de providers. É a única abstração que não é overengineering, porque
é ela que permite trocar `luna` por Jev depois sem tocar em mais nada.

**Passo 2 — decompor o Encaixe 1.** Não perguntar "é a mesma obra?". Perguntar
as atômicas: "o nome curto é sigla do longo?", "os nomes próprios coincidem?",
"há qualificador de local divergente?", "o texto permite decidir?". **Toda
escolha com opção `insuficiente`** — é a mitigação obrigatória contra o
"confiantemente errado no indecidível" (§3.2).

**Passo 3 — harness offline.** No molde de
`scripts/medir-validacao-sol-vs-terra.ts`: replica os FPs já escritos nos
comentários do código e os conflitos reais do kit de erros plantados. Custo:
centavos. **Portão:** se a decomposição não resolver os FPs documentados sem
perder conflito real, o problema não é o modelo — e o Jev também não salvaria.

**Passo 4 — sombra em produção**, atrás de controle no padrão de
`lib/controles-da-plataforma.ts`. Grava, não aparece no parecer.

**Passo 5 — ligar o Encaixe 1.** Divergência vira `ContestacaoDeRegra`.

**Passo 6 — Encaixe 2, a rede de arrasto.** Só depois que o Passo 3 tiver
provado que as perguntas atômicas funcionam neste vocabulário. É o de maior
valor e o de maior superfície: exige a lista fechada de defeitos recorrentes,
que hoje está espalhada em `audit-coherence.ts`.

**Passo 7 — Encaixes 3 e 4.** Certeza calibrada e dedupe pareado, ambos com
baseline medido para comparar (`severidade.ts` e os 48% de
`impressao-do-achado.ts`).

**Passo 8 — só então comparar `luna` × Jev**, com harness pronto e gabarito na
mão. Entrar na lista de espera do Jev **agora** é de graça e não compromete nada.

### O que nunca muda, em nenhum passo
Falhou, deu timeout, 429, resposta inválida → a auditoria sai **exatamente** como
sai hoje. O conferente é soma; sem ele o motor é o de sempre.

---

## Fontes

- [API reference — docs.typesafe.ai](https://docs.typesafe.ai/api.md) · [Legal](https://docs.typesafe.ai/legal.md)
- [Introducing System One Models & Jev — fornecedor](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [Calibração, decomposição e shadow eval (62,6% → 95%; ECE 0,107)](https://www.beri.net/article/typesafe-jev-typed-decision-model-calibration-decomposition-shadow-eval)
- [Using TypeSafe's Jev for evals — Langfuse](https://langfuse.com/blog/2026-09-18-using-typesafes-jev-for-evals)
- [Padrões de uso — awesome-jev](https://github.com/Anil-matcha/awesome-jev-by-typesafe)
- [TypeSafe (Jev) — Pydantic AI](https://pydantic.dev/docs/ai/models/typesafe/)
- [Rate limits, contexto e preço — OpenTweet](https://opentweet.io/jev/limits)
- [What "System One Models" actually are — TrueFoundry](https://www.truefoundry.com/blog/typesafe-ai-jev)


---

## 12. O que a implementação mudou (21/09/2026, à tarde)

Os quatro encaixes foram construídos e ligados no mesmo dia. Três coisas que
este documento afirmava não sobreviveram ao contato com a API e com os PDFs.

### 12.1 A documentação do fornecedor erra, e erra em silêncio

`criteria` de um `noul` **não é string**, é objeto. Mandar string é 422. E as
chaves importam: medido no mesmo estado, `{true, false}` deu 0,82 e `{yes, no}`
deu 0,89 — idêntico a não mandar critério nenhum. **O polo errado passa no
schema e é ignorado sem erro**, devolvendo um número que parece calibrado e não
leu a rubrica.

### 12.2 A decidibilidade não pode multiplicar (Encaixe 3)

O desenho original media a certeza como `P(é defeito) × P(dá para decidir)`.
Medido nos 13 casos com gabarito meu: a decidibilidade fica baixa para **quase
tudo** (0,22 a 0,48), porque conferir quase qualquer achado de memorial
"precisaria de outro documento" numa leitura estrita. O "0,254 microns" — erro
de mil vezes, conferido no PDF — saía a **0,26** e caía no PISO da faixa.

Isso é agosto/2026 reencenado com um número novo. A decidibilidade agora só
**segura a promoção**: impede o indecidível de chegar ao teto, e não empurra
ninguém para baixo.

Resultado final: reais média **0,81**; não-reais média **0,44**; separação
**0,37**. E nenhum achado real no piso — asserção travada na prova.

### 12.3 O Encaixe 1 tem uma fronteira que o documento não previa

A §7 dizia "cada achado de regra recebe 4–5 perguntas atômicas". A prova
reprovou: perguntando para TODA regra, o conferente contestou a regra de
linguagem rodoviária do 025-24, que está **certa**. E a resposta dele também
estava — ele lê o trecho e a alegação, e mais nada. Para saber que "eixo da
rodovia" é resíduo é preciso saber que a obra é a urbanização de três praças, e
isso está na página 11.

A fronteira real:

| Família | Decide-se | Contesta? |
|---|---|:-:|
| Identidade (nome, órgão) | dentro do trecho | ✅ |
| Marca sem ressalva | dentro do trecho | ✅ |
| Hierarquia, resíduo, peça não listada, aritmética | contra o resto do documento | ❌ |

E não é coincidência que as duas que contestam sejam exatamente as que
produziram falso positivo blindado: **regex erra justamente onde a decisão é de
linguagem**.

### 12.4 A rede de arrasto quase varreu o documento inteiro

"Não está na lista de blocos que foram ao modelo" não é "ninguém leu". No
Profundo o plano de blocos é ZERO por desenho. A primeira versão teria enchido
toda corrida Profunda de achados de rede sobre páginas que o `sol` acabou de
ler. `blocosNaoLidos` faz a interseção honesta.

E a rede tem um limite medido: ela **não** pega conta que não fecha. Um sim/não
sobre 5.216 caracteres não soma três números. Aritmética é trabalho de regra.

### 12.5 O que foi provado, e com o quê

| encaixe | prova | custo da corrida |
|---|---|---|
| 3 — certeza | 13 achados com gabarito meu | ~US$ 0,001 |
| 1 — assinatura | 3 FPs documentados + 4 regras certas | ~US$ 0,0005 |
| 2 — rede | 5 blocos de PDF real, com controle negativo | ~US$ 0,002 |
| 4 — dedupe | 10 testes puros (filtro determinístico) | US$ 0 |

Nenhum dos quatro pode remover ou rebaixar achado. Sem `JEV_API_KEY`, ou com o
Jev fora do ar, a auditoria sai exatamente como saía antes.
