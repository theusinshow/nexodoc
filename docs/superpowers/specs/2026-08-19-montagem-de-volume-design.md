# Montagem de volume: a prefeitura crava, a leitura se mede, o histórico é o projeto

**Data:** 2026-08-19
**Estado:** desenho aprovado, plano por escrever

## Por que agora

Montando um volume real de 44 folhas (MET, blocos A/B/D/F), três coisas
quebraram no mesmo dia. Duas já foram consertadas e estão na `main`:

- `8c27d7e` — a descrição do carimbo saía pela metade. O corte no rótulo
  vizinho não tinha borda à direita, então `IMP` casava dentro de
  "IMPLANTAÇÃO". Dez de quinze descrições reais saíam cortadas.
- `80c1529` — o título da seção da LD era o nome da OBRA, não o da disciplina.

A terceira é a que este desenho abre, e é a pior que existe neste produto:

> **um volume de Criciúma sendo emitido com a prefeitura de Chapecó.**

## O defeito da prefeitura, provado

`server/nexo/agent/normalize.ts` resolve a prefeitura **duas vezes** sobre o
mesmo pedido — uma para a capa, outra para a separatriz. Duas resoluções
independentes do mesmo fato podem discordar, e discordam.

A capa foi endurecida (o comentário nas linhas 332-345 conta o incidente do
volume de Criciúma que saiu como Florianópolis, e o `|| firstTemplateId` foi
removido dali). **A separatriz ficou com a linha antiga**, na linha 383:

```ts
const templateId = match?.id ?? (String(p.templateId ?? "").trim() || firstTemplateId);
```

`firstTemplateId` é `ctx.prefeituras[0]?.id`. Em produção, `/api/saude` devolve
`["prefchap", "pmcriciuma", "prefflor", "prefsjose"]` — **a primeira é
Chapecó.**

Medido, com as quatro prefeituras reais na ordem real:

```
prefeitura pedida                    -> capa            | separatriz
""                                   -> capa=(vazio)    | separatriz=prefchap
"Criciúma"                           -> capa=pmcriciuma | separatriz=pmcriciuma
"Prefeitura Municipal de Criciúma"   -> capa=pmcriciuma | separatriz=pmcriciuma
"coisa nenhuma"                      -> capa=(vazio)    | separatriz=prefchap
```

O modo de falhar é pior do que "sai errado". Quando a capa não casa, ela fica
vazia e **vira pergunta**, que o engenheiro responde com Criciúma. A separatriz
não pergunta: vai de Chapecó calada. **O volume sai internamente contraditório**
— capa certa, separatriz errada —, e é preciso abrir os dois PDFs lado a lado
para descobrir.

O portão não pega: a conferência de identidade compara **as pranchas** contra a
prefeitura-alvo, e nunca o documento que o próprio software gerou.

---

## Seção 1 — A prefeitura é a identidade do PROJETO

O erro estrutural não é a linha 383; é o fato de existirem duas resoluções.
Consertar só a linha deixaria a arquitetura que produz este defeito de pé.

E a prefeitura não é um parâmetro que a capa resolve na hora de propor: ela é a
IDENTIDADE do projeto, decidida na entrada. É ela que nomeia a pasta do
histórico (Seção 4) — o que empurra a decisão para o minuto zero, onde ela é
barata, em vez da hora de gerar, onde já há trabalho em cima dela.

**1.0 — Medir o `motivo` ANTES de mexer no casamento.**

`casarPrefeituraDoCarimbo` já cruza DUAS evidências — o nome escrito (`cliente`)
e o brasão (`logoOrgao`) — e já devolve um `motivo` que separa as causas:

```
texto-e-logo | so-texto | so-logo | divergem | ambiguo | sem-evidencia
```

O comentário que o acompanha diz por que ele existe: "para que a próxima
melhoria seja dirigida por fato e não por palpite". **Ninguém nunca olhou esse
número.**

A decisão do produto é que a prefeitura TEM de ser cravada. Mas "põe IA" não é a
resposta até se saber qual motivo dispara:

- `sem-evidencia` — o modelo não leu `cliente` nem `logoOrgao`. Aqui uma leitura
  melhor resolve.
- `divergem` / `ambiguo` — as evidências se contradizem, ou apontam duas
  prefeituras. Aqui nenhuma IA resolve: a contradição é o fato, e decidir por
  cima dela é exatamente o chute que produziu o incidente Florianópolis.

O gabarito é grátis, como o das descrições: o rodapé das LDs entregues traz o
caminho de rede do escritório — `P:\cad\prefchap _26\...` —, ou seja, **o
id do template está impresso no documento**. Os quatro projetos dos samples
viram quatro casos com resposta conhecida, sem gastar token.

Este passo é pré-requisito de qualquer mudança no casamento. O que ele apontar
entra no plano; o que ele não apontar não vira trabalho.

**1.1 — Uma resolução por turno.** `normalizeProposals` casa a prefeitura UMA
vez, antes do laço, e distribui o mesmo valor (ou o mesmo vazio) a todo
documento que a imprime. `firstTemplateId` **deixa de existir no arquivo**: a
variável é o defeito, não um detalhe dele.

**1.2 — Vazio trava, não chuta.** Sem prefeitura decidida, nenhum documento do
volume é gerado — nem os que não imprimem brasão. Um volume é uma peça só, e
entregar metade dela enquanto a identidade está em aberto é o mesmo convite ao
erro por outro caminho.

**1.3 — A separatriz aparece TRAVADA, não some.** Ela fica listada no plano,
marcada como pendente, com a pergunta ao lado. Sumir esconderia que o volume
tem uma separatriz — e uma peça que falta é tão grave quanto uma peça errada.

**1.4 — Portão de coerência antes de gerar.** A construção impede que
documentos divergentes nasçam; o portão pega o que a construção não pega — o
engenheiro editar a prefeitura de UM documento depois. Antes de gerar, o plano
confere que todos concordam. Divergência recusa e **diz qual documento
discorda**, com os dois valores.

`postCheck` já recebe UM `templateId`, ou seja, a conferência já trata a
prefeitura como propriedade do volume. É a camada de cima que quebra isso.

**1.5 — Teste com a ordem real.** As quatro prefeituras com **Chapecó em
primeiro**, porque é a ordem que produz o erro. Um teste com Criciúma em
primeiro passaria verde com o defeito intacto — e essa é exatamente a armadilha
que deixou este defeito vivo depois de o irmão dele ter sido corrigido.

**O que NÃO muda:** `matchPrefeitura`. Ele está certo — subtrai o endereço do
escritório antes de casar, e exige que o texto nomeie um órgão (foi assim que o
caso Florianópolis foi fechado). O defeito nunca foi o casamento; foi o que se
faz quando ele devolve `null`.

---

## Seção 2 — A bancada de medição da leitura

"Melhorar a coleta" sem medir é chute. O defeito de hoje estava numa regex, não
no modelo — e ninguém teria adivinhado isso.

**O gabarito já está impresso.** Os samples trazem **61 LDs entregues** e **457
pranchas** em quatro projetos reais (040-26, 113-22, 116-25, 156-25). A LD que o
escritório entregou É a resposta certa. Sondado em
`040_26_his_ld_a.pdf`, sai limpo:

```
Nº DA FOLHA   ARQUIVOS            DESCRIÇÃO
01/11         040_26_his_001_a    PLANTA DE IMPLANTAÇÃO
02/11         040_26_his_002_a    PLANTA BAIXA SANITÁRIO PAVIMENTO TÉRREO – PARTE I
```

A primeira linha é `PLANTA DE IMPLANTAÇÃO` — o caso que hoje virava "PLANTA DE",
no documento real, entregue ao cliente.

**2.1 — Lado gabarito.** Cada `*_ld_*.pdf` lido com `extractPdfText`. Uma linha
que começa com `NN/TT` abre um registro; linha que não começa assim é
continuação da descrição anterior (as linhas 02, 04 e 07 do exemplo quebram em
duas e três linhas).

**2.2 — Lado leitura.** Cada prancha passada pelo **leitor de produção**:
`acharCaixaDoSelo` → `textoPorPosicao` → `conteudoDoSelo`, mais `parseFilename`
para folha e disciplina.

**2.3 — A conversão de coordenada sai para um módulo puro.** Hoje a passagem de
`transform` do pdf.js para coordenada normalizada mora dentro de
`selo-render.ts`, que é client-only. Ela precisa ser compartilhada: se a bancada
reimplementar essa conversão, ela mede uma **cópia** do leitor, e um número
sobre uma cópia é pior que número nenhum.

**2.4 — Casamento pelo código do arquivo** (`040_26_his_001_a`), que é a chave
que existe nos dois lados.

**2.5 — O relatório.** Por campo (descrição, folha, total, disciplina): % de
acerto e a **lista nominal** dos que erraram, com lido e esperado lado a lado.
A descrição sai com DUAS contagens — igual exato, e igual ignorando acento e
pontuação. A fonte quebrada da família EST troca acento, e isso não é o mesmo
erro que perder metade do texto; somar os dois esconderia qual dos dois está
acontecendo.

**2.6 — O limite, dito na cara.** A bancada mede a **metade determinística**.
A contribuição do modelo de visão só se mede gastando token. Hoje isso pesa
pouco — com a fonte sã, `tituloDaPrancha` devolve a leitura da geometria e o
modelo só decide acento. Mas o número **não** é "a leitura está X% certa"; é "a
parte que não custa nada está X% certa". O relatório precisa dizer isso, senão
vira uma garantia que ninguém deu.

**Custo: zero.** Nenhuma chamada de modelo.

---

## Seção 3 — O card que se lê

`FolhaNode` corta a descrição em `line-clamp-2`. Com 44 folhas na tela, conferir
significa abrir cada uma — e conferir é justamente o que se vai fazer ali.

O `line-clamp-2` sai. Em lugar dele:

- **Uma altura só para todos os cards**, definida pela descrição mais longa do
  conjunto **até um teto**. A grade não pode virar escada — cartão de alturas
  diferentes destrói a varredura visual, que é a razão de a tela existir.
- **O teto é o que cabe sem quebrar a grade.** Acima dele o card não cresce
  mais: a descrição ganha **rolagem interna**, nunca reticências. Reticências
  escondem exatamente a metade que o defeito de hoje comia, e é essa metade que
  se veio conferir.
- O teto sai medido dos samples, não escolhido: a descrição mais longa das 457
  pranchas é o caso real que ele precisa acomodar.

---

## Seção 4 — O histórico é o projeto

Hoje o histórico não representa o trabalho. Duas derivações diferentes
convivem, e nenhuma faz o que o escritório faz:

| Caminho | O que deriva | Resultado |
|---|---|---|
| Volume (`deriveFolderKey`) | só o **código** do carimbo | `084_25` — pasta sem prefeitura |
| Auditoria (`tituloDaConversa`) | `centroDeCustoDaAuditoria(codigo, orgao)` | `084_25-CRICIUMA` — mas vira **título**, não pasta |

A função que monta o nome certo **já existe** e está sendo usada no lugar
errado.

**4.1 — A pasta é o projeto.** Chave `CODIGO-MUNICIPIO` (`084-25-CRICIUMA`),
derivada por UMA função para os dois caminhos. O carimbo entrega `084_25`; a
normalização para hífen acontece na derivação, e não em cada chamador.

**4.2 — Um nível só.** Pastas no topo, conversas dentro. `084-25-CRICIUMA`
aparece UMA vez, com o volume metálico e a auditoria do memorial lado a lado —
que é como o projeto existe na cabeça de quem trabalha nele. A partição em duas
seções some: ela partia o projeto em dois lugares.

**4.3 — O filtro vira etiqueta.** Montagem/Auditoria continua, mas esconde
ITENS, não seções. Pasta que fica sem item visível desaparece da lista. As
contagens continuam sendo do total, não do filtrado — um contador que zera junto
com o que ele descreve não informa nada.

**4.4 — O nome da conversa é o que ela É.**

- Volume: as siglas das disciplinas que ele carrega — `MET`, ou `MET · HIS · INC`
  no misto (seis dos oito volumes reais são mistos, então o caso composto é o
  caso comum, não a exceção).
- Auditoria de memorial: `Memorial`.

**4.5 — A pasta nasce ao ANEXAR.** Assim que código e prefeitura são
conhecidos, sem esperar documento nenhum ser gerado. É o "flagra de cara": o
projeto se identifica na entrada.

**4.6 — Sem prefeitura cravada, não há pasta.** A conversa fica em "Sem pasta"
até a decisão. **Nunca existe pasta com nome pela metade** — um `084-25` que
depois vira `084-25-CRICIUMA` é uma pasta que muda de identidade debaixo de quem
está usando, e quem já a tinha aberto perde a referência.

**O que sai deste desenho:** a proposta anterior — "a conversa aparece nas duas
seções" — foi descartada. Ela resolvia o sintoma (a conversa sumia da montagem)
mantendo a causa (o tipo de trabalho mandando na estrutura). Com a pasta no
topo, o problema deixa de existir em vez de ser contornado.

**Não é defeito o que eu supus no começo:** as conversas chamadas "Nova
conversa" no banco de dev são fixtures de teste sem memorial e sem selos. A
escada de `tituloDaConversa` está certa; ela muda só para passar a nomear pela
disciplina no caso do volume.

---

## Ordem do dia

1. **Prefeitura — o vazamento** (1.1 a 1.5). Primeiro, e não é negociável: é o
   único defeito aqui capaz de fazer um documento errado chegar ao cliente.
2. **Prefeitura — medir o `motivo`** (1.0), contra o gabarito do rodapé das LDs.
   Custo zero. É o que diz se "cravar sempre" é leitura melhor ou pergunta
   melhor.
3. **Bancada da leitura** (Seção 2) — mede antes de mexer.
4. **Consertar o que as duas medições apontarem**, na ordem do estrago. Sem
   escopo fechado aqui de propósito: fechá-lo antes de medir seria adivinhar.
5. **Histórico** (Seção 4) — a refatoração da pasta. Depende de 1 e 2: o nome da
   pasta É a decisão da prefeitura, então ele não pode vir antes dela.
6. **Card legível** (Seção 3) — independente dos outros; cai para o fim por ser
   o de menor consequência.

## Fora de escopo

- **UI de correção em massa.** Foi considerada e descartada: a decisão é que a
  leitura tem que acertar. Corrigir 44 folhas mais rápido é melhorar a derrota.
- **`matchPrefeitura`.** A REGRA de casamento fica como está — ela recusa
  endereço de escritório e exige que o texto nomeie um órgão, e foi assim que o
  caso Florianópolis foi fechado. O que 1.0 pode mudar é a EVIDÊNCIA que chega
  até ela, nunca o critério.
- **Modo com token na bancada.** Fica o gancho, não a implementação.
- **A escada de `tituloDaConversa` para auditoria.** Continua como está: centro
  de custo, obra, primeira frase. O que muda é o caso do VOLUME, que passa a se
  chamar pela sigla — e é mudança de comportamento, não conserto de defeito.

## Como se sabe que funcionou

| Seção | Prova |
|---|---|
| 1 | Teste puro sobre `normalizeProposals` com Chapecó em primeiro: pedido não-casado devolve vazio para capa E separatriz. Portão recusa plano com documentos discordantes. E a distribuição de `motivo` nos 4 projetos sai impressa, com o acerto medido contra o `prefchap`/`pmcriciuma` do rodapé. |
| 2 | A bancada roda e imprime números sobre 4 projetos reais. O número de partida fica registrado — sem ele não há como provar melhora depois. |
| 3 | Card com a descrição mais longa dos samples visível por inteiro, medido contra a caixa do card e não só presente no DOM. |
| 4 | Conversa com `results: [capa, auditoria]` aparece UMA vez, dentro da pasta do projeto. Volume misto se chama `MET · HIS · INC`. Sem prefeitura, a conversa está em "Sem pasta" e nenhuma pasta parcial existe. |
