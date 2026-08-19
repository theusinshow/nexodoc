# Montagem de volume: a prefeitura, a leitura medida, e o card que se lê

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

## Seção 1 — A prefeitura é uma decisão do VOLUME

O erro estrutural não é a linha 383; é o fato de existirem duas resoluções.
Consertar só a linha deixaria a arquitetura que produz este defeito de pé.

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

## Seção 4 — O histórico de quem faz as duas coisas

`derivarTipoDeTrabalho` testa auditoria primeiro. Uma conversa que montou volume
E auditou memorial vira "auditoria" e **some da seção de montagem**, mesmo tendo
gerado documento de volume. Visto no banco:

```
"Exemplo guiado — Escola Municipal Vila Nova"
   results: [capa, auditoria]   →   tipo=auditoria
```

O tipo deixa de ser uma partição e vira um **conjunto**: a conversa aparece nas
DUAS seções quando fez os dois trabalhos. As contagens ao lado dos rótulos
passam a somar mais que o total de conversas — e isso é honesto, não erro: elas
contam trabalhos, não linhas.

**Não é defeito o que eu supus no começo:** as conversas chamadas "Nova
conversa" no banco de dev são fixtures de teste sem memorial e sem selos. A
escada de `tituloDaConversa` está certa e fica como está.

---

## Ordem do dia

1. **Prefeitura** (Seção 1) — primeiro, e não é negociável. É o único defeito
   aqui capaz de fazer um documento errado chegar ao cliente.
2. **Bancada** (Seção 2) — mede antes de mexer.
3. **Consertar o que a bancada apontar**, na ordem do estrago medido. Sem
   escopo fechado aqui de propósito: fechá-lo antes de medir seria adivinhar.
4. **Card legível** (Seção 3).
5. **Histórico** (Seção 4).

## Fora de escopo

- **UI de correção em massa.** Foi considerada e descartada: a decisão é que a
  leitura tem que acertar. Corrigir 44 folhas mais rápido é melhorar a derrota.
- **`matchPrefeitura`.** Está correto; ver Seção 1.
- **Modo com token na bancada.** Fica o gancho, não a implementação.
- **Nomenclatura de conversa.** Não é defeito; ver Seção 4.

## Como se sabe que funcionou

| Seção | Prova |
|---|---|
| 1 | Teste puro sobre `normalizeProposals` com Chapecó em primeiro: pedido não-casado devolve vazio para capa E separatriz. Portão recusa plano com documentos discordantes. |
| 2 | A bancada roda e imprime números sobre 4 projetos reais. O número de partida fica registrado — sem ele não há como provar melhora depois. |
| 3 | Card com a descrição mais longa dos samples visível por inteiro, medido contra a caixa do card e não só presente no DOM. |
| 4 | Conversa com `results: [capa, auditoria]` aparece nas duas seções, e as contagens refletem isso. |
