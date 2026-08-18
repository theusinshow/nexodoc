# O parecer que some — Design

> Spec fechada por brainstorm (17/08/2026). Item 4 de
> `docs/observacoes-do-uso-2026-08-17.md`, reclassificado depois de conferir a
> implementação: **a causa não é a que o documento supunha.**

## 1. Problema

Sair da conversa e voltar devolve a conversa, o título e todas as mensagens — e
não devolve o parecer. O palco volta ao estado inicial, o memorial retido some, e
o gabarito (obra, prefeitura, município) volta em `—`. O anel de consumo continua
mostrando `78k · $0.257`: **o dinheiro foi gasto e a auditoria rodou.**

Observado no `084_25-CRICIUMA` em 17/08/2026, com a auditoria **já concluída** —
o parecer chegou a aparecer no palco antes de a conversa ser trocada.

O custo não é a tela vazia: é auditar de novo. Uma auditoria Deep de 218 páginas
custa da ordem de US$ 1,50 em token, e o parecer perdido é o insumo do benchmark
AUD-001..025.

## 2. Diagnóstico

São **três** falhas independentes, todas silenciosas. Confundi-las leva a
consertar a errada — o documento de observações apostou na terceira, que é a
menos provável das três.

### (a) A corrida entre o snapshot e o flush — é esta que apaga o parecer

`snapshotRef` é a fonte que `persistNow` grava. Ele é sincronizado **num
effect**, depois do commit (`conversation-store.tsx:329`), e o comentário diz por
quê: *"o React Compiler proíbe tocar ref.current durante o render."*

O fim de uma auditoria (`ConfirmationCard.tsx:2299`, `:2344`):

```js
await saveResult({ ..., payload: r });   // setResults(...) + schedulePersist() → timer de 500ms
} finally {
  marcarAuditoriaPendente(null);          // → flushPersist() SÍNCRONO
}
```

O `saveResult` da auditoria recebe `files: []` — o laço que dá `await` nunca
executa, e ele retorna no mesmo microtask. O `finally` roda **antes** do effect
que atualiza o `snapshotRef`. Então `flushPersist()`:

1. lê `snapshotRef.current.results` — a versão **anterior** à auditoria;
2. `clearTimeout` **cancela** o debounce de 500 ms que gravaria o parecer;
3. grava esse registro truncado no disco **e no servidor**.

A prova de que o mecanismo é real está no mesmo arquivo: `marcarAuditoriaPendente`
(`:1013`) e `salvarMemorial` (`:1030`) **remendam `snapshotRef.current` à mão**
antes de chamar `flushPersist`, com o comentário *"o snapshot só acompanha o
estado depois do render, e aqui a gravação é imediata"*. Quem escreveu conhecia o
atraso e corrigiu **o próprio campo**. Remendar um campo deixa todos os outros
velhos — inclusive `results`.

**Consequência que decide o desenho:** o parecer não chegou nem ao disco nem ao
servidor. Recuperá-lo comparando as duas cópias é impossível — as duas estão
igualmente truncadas.

**Por que nem sempre acontece:** qualquer mutação posterior (uma mensagem no
chat, um achado marcado como resolvido) dispara `schedulePersist` com o
`snapshotRef` já em dia, e a conversa se conserta sozinha. A perda depende de a
pessoa sair antes disso — que foi o que houve.

### (b) `salvarMemorial` lança e ninguém escuta

`putBlob` é aguardado **antes** de `setMemorialMeta` e do `flushPersist`
(`conversation-store.tsx:1026`). Se ele rejeitar — o memorial do 084_25 tem
5,1 MB —, a função lança, e as três chamadas em `NexoWorkspace.tsx` (`:493`,
`:512`, `:779`) são `void conv.salvarMemorial(...)`: a rejeição vira unhandled e
some. Memorial **e** dossiê se perdem juntos.

Explica exatamente duas das três perdas do print: o memorial retido e o gabarito
em `—`.

### (c) O disco engole a própria falha

```js
putConversation(rec)
  .then(refreshList)
  .catch(() => {});
```

`conversation-store.tsx:474`. O comentário logo acima diz *"O DISCO PRIMEIRO,
SEMPRE... é o que faz um F5 não perder nada"*, e a linha seguinte descarta o
resultado. `nexo-sync.ts` — o arquivo ao lado — abre declarando a doutrina
contrária: *"O que ela NÃO faz é engolir a falha... o modo de falhar que esse
projeto já pagou caro é o silencioso: parece que salvou."*

É a falha menos provável das três neste incidente (exigiria quota estourada), mas
é a que continuará existindo depois de (a) ser corrigida, e é a única que hoje
não tem defesa nenhuma.

### (d) O eclipse — por que o servidor não salva ninguém hoje

`restoreConversation` (`:827`) escolhe a cópia por **presença**, não por data:
`getConversation(id)` e, só se não houver nada, `lerDoServidor(id)`. Uma cópia
velha no disco eclipsa uma cópia boa no servidor. O comentário daquela linha diz
que o conflito de versões *"é resolvida na lista, por `updatedAt`, não aqui"* — a
lista compara data, o caminho de abertura não.

Isoladamente isto não causou o incidente (por (a), o servidor também está
truncado), mas é o que impede a recuperação em qualquer falha só-de-disco.

## 3. Decisões

| Tema | Decisão |
|---|---|
| Escopo | **Recuperar e deixar de mentir.** Prevenção (quota, "já existe parecer, não gaste de novo") fica fora |
| Fonte da verdade | O disco **continua** sendo a gravação que vale no instante. Não invertemos para "servidor primeiro" |
| Escolha na abertura | Por **`updatedAt`**, não por presença |
| Recuperação do parecer | Pelo `auditId`, contra `/api/audits/[id]`, pelo caminho que `use-abrir-auditoria-por-link` já executa |
| Reconstrução | **Nenhum artefato é reconstruído "por fora".** Só o parecer volta, e pelo caminho já testado |
| Aviso de falha | **Graduado pelo risco** (§6) |
| Ordem | (a) primeiro. É a raiz; sem ela as outras peças recuperam de um servidor que também está truncado |

### Por que não inverter para "servidor primeiro"

`restoreConversation:827` prefere o disco por uma razão escrita: *"o disco tem os
BYTES dos artefatos e o servidor não. Preferir o servidor por ser 'a fonte da
verdade' trocaria uma conversa completa por uma sem arquivos."* A proposta do
documento de observações ("o navegador vira cache, não fonte") derrubaria essa
decisão e perderia os blobs. Comparar `updatedAt` resolve o mesmo problema sem
pagar esse preço.

## 4. Arquitetura — as três peças

### Peça 1 — O snapshot deixa de mentir para o flush

`saveResult` passa a remendar `snapshotRef.current.results` de forma síncrona,
exatamente como `salvarMemorial` já faz com `memorialMeta` e
`marcarAuditoriaPendente` com o bilhete. Não é padrão novo: é terminar um
trabalho começado no mesmo arquivo.

Com isso a ordem entre `saveResult` e o `finally` deixa de importar, e qualquer
flush posterior grava completo.

`saveResult` passa a usar `flushPersist` em vez de `schedulePersist`: artefato
pago não espera 500 ms para existir no disco. O debounce continua sendo o certo
para digitação; não para um parecer.

**Ganho:** o defeito para de acontecer. As peças 2 e 3 existem para o que já se
perdeu e para as falhas que sobrarem.

### Peça 2 — A recuperação

Duas camadas, nesta ordem:

**2a. Escolha por data.** `restoreConversation` compara o `updatedAt` do disco
com o da lista remota — que o store **já mantém em memória** (`remotasRef`,
atualizada na montagem, e `ConversationSummary` carrega `updatedAt`,
`nexo-db.ts:206`). No caso comum não há requisição nenhuma; só quando o servidor
é mais novo é que `lerDoServidor` é chamado. O registro vencedor passa pela
rehidratação de hoje: blobs achados no disco viram URL, os que faltarem já são
marcados com `bytesAusentes`.

*Corrida a tratar:* se `remotasRef` ainda não carregou quando a conversa abre, a
comparação não acontece.

**Decisão: a abertura NÃO espera a lista remota.** Bloquear toda abertura de
conversa por uma requisição de rede, para um caso raro, trocaria uma perda rara
por uma lentidão constante. Quando a lista não chegou, 2a é simplesmente pulada —
e **2b continua valendo**, porque ela consulta o parecer pelo `auditId`
diretamente, sem depender da lista. A camada de baixo cobre o furo da de cima; é
para isso que elas estão em ordem.

**2b. Rede pelo `auditId`.** Se, depois de 2a, a conversa tem sinal de que
existiu auditoria e nenhum artefato de parecer, buscar `/api/audits/[id]` e
reconstruir pelo caminho de `use-abrir-auditoria-por-link`.

É a única camada que recupera o 084_25 já perdido, porque `persistCompletedAudit`
grava o parecer no Postgres pelo **backend**, sem passar pela corrida (a).

**Apagar precisa continuar sendo apagar.** Sem defesa, 2b ressuscitaria na
próxima abertura o parecer que a pessoa apagou de propósito — e um produto que
desfaz a exclusão do usuário é pior que um que perde o arquivo, porque o primeiro
faz isso para sempre. **Decisão:** `removeResult` registra o `artifactId` numa
lista de exclusões deliberadas da conversa, e 2b não recupera o que está nela.
Um campo opcional, no mesmo padrão schemaless de `ajustes` e `achadosResolvidos`.

**Onde mora o `auditId`.** Hoje ele sobrevive em dois lugares que não dependem da
corrida — o bilhete `auditoriaPendente` (gravado com `flushPersist` **antes** da
auditoria começar) e as chaves de `achadosResolvidos` — e num que depende: o
`payload` do artefato (`ConfirmationCard.tsx:2212` já o lê de lá). O bilhete é
apagado no `finally`, então não é carregador confiável depois do fim.

**Decisão:** persistir o `auditId` na conversa no instante em que a auditoria
**começa**, ao lado do bilhete e com a mesma gravação imediata, e mantê-lo depois
que o bilhete é limpo. Um campo, escrito uma vez, fora do caminho da corrida.

### Peça 3 — Erro visível, graduado

`putConversation` deixa de engolir: a falha vira estado, como `gravarNoServidor`
já faz com `EstadoDaSincronizacao`. As três chamadas `void conv.salvarMemorial(...)`
ganham tratamento e avisam.

## 5. Fluxo de abertura, depois

```
restoreConversation(id)
  ↓
disco = getConversation(id)          bytes moram aqui
remoto = remotasRef[id]              updatedAt já em memória, custo zero
  ↓
remoto mais novo que disco?  → lerDoServidor(id) e usar esse registro
                             → senão, usar o do disco
  ↓
rehidrata blobs (inalterado: falta byte → `bytesAusentes`, não some)
  ↓
tem sinal de auditoria e nenhum parecer?
  → GET /api/audits/[auditId] → saveResult, pelo caminho de use-abrir-auditoria-por-link
  ↓
falha de gravação pendente? → aviso graduado (§6)
```

## 6. O aviso, graduado pelo risco

| Situação | Trabalho | Aviso |
|---|---|---|
| Disco falhou, servidor gravou | **a salvo** | discreto e informativo: gravado no servidor, não neste computador |
| Servidor falhou, disco gravou | **a salvo** | o indicador de sincronização de hoje, inalterado |
| **Os dois falharam** | **em risco** | faixa persistente e inegável |
| Memorial não gravou | parcial — o parecer existe, reauditar não | aviso próprio: sem os bytes não dá para auditar de novo |

O critério: alarme só onde o próximo clique pode custar trabalho. Aviso que
aparece à toa é aviso que se aprende a ignorar — e o produto já tem quatro alvos
sem rótulo no rodapé pelo mesmo motivo.

## 7. Fora do escopo

- **Prevenção de gasto duplicado** ("já existe parecer para este arquivo, abra em
  vez de gastar de novo"). Vale, e é item próprio.
- **Gestão de quota do IndexedDB.** A peça 3 faz a falha aparecer; administrá-la
  é outro trabalho.
- **Reabrir do histórico.** A recuperação desta spec é automática na abertura da
  conversa. Um botão explícito no histórico depende da rearrumação do item 2 das
  observações, que ainda não tem brainstorm.
- **Reconstruir volume, LD ou capa.** Só o parecer.

## 8. Testes

Segue o padrão do repositório: `scripts/test-*.ts` em node cru (type-stripping),
`node:assert/strict`, import relativo com extensão `.ts`, **verificado por exit
code, nunca pela última linha**.

| O quê | Como, sem navegador e sem token |
|---|---|
| Peça 1 | O remendo do snapshot é lógica pura sobre um objeto: aplicar um resultado a um snapshot e afirmar que `results` saiu completo |
| Peça 2a | A escolha por data recebe dois `updatedAt` e devolve quem vence. Puro, e é onde moram os casos de borda (empate, remoto ausente, lista não carregada) |
| Peça 2b | A decisão *"tem sinal de auditoria e não tem parecer"* é uma função de um registro. Pura |
| Peça 3 | A graduação do aviso é uma função de dois booleanos para um nível. Pura |

O que **não** dá para provar sem abrir o produto: que o effect realmente perde a
corrida no navegador real. Essa é a primeira verificação da implementação, com o
console aberto — e é barata. **"Compila limpo" não é evidência de que roda**
(`docs/validacao-2026-08-13.md`).

## 9. Riscos

1. **A causa (a) é dedução, não reprodução.** O encadeamento é forte e está
   corroborado pelos remendos que o próprio arquivo faz, mas a implementação
   começa confirmando-o — não consertando-o. Se a reprodução mostrar outra coisa,
   esta spec volta ao brainstorm.
2. **`flushPersist` em todo `saveResult`** troca um debounce por uma gravação
   síncrona no caminho da montagem de volume, que salva vários artefatos em
   sequência. Medir antes de assumir que é gratuito.
3. **A lista de exclusões deliberadas (§4, peça 2b) é estado novo que pode
   divergir.** Ela vive na conversa e o parecer vive no Postgres: apagar numa
   máquina e abrir noutra, antes da sincronização, ainda recupera. Aceitável —
   o erro é recuperável por um segundo clique, e o oposto perde trabalho pago.
4. **Aviso demais.** A graduação existe para conter isto, mas o julgamento de
   "discreto" só se verifica com a tela aberta.

## 10. Reprodução — a causa (a) foi REFUTADA

> 17/08/2026, Task 1 do plano. Custo: zero token.

**O que foi feito.** Semeada uma conversa no IndexedDB com um bilhete
`auditoriaPendente` apontando para a auditoria `51f1c9f5-…` (084-25-CRICIUMA, 25
achados, já gravada no Postgres). Aberta a conversa pela barra lateral, o
`use-reconectar-auditoria` rodou o caminho inteiro — `consultarAuditoria` →
`saveResult({files: []})` → `marcarAuditoriaPendente(null)` → `flushPersist` —
sem chamar modelo nenhum.

**Resultado:**

```
[persist] ["auditoria-teste"] bilhete: null
disco:    { results: ["auditoria-teste"], bilhete: 0 }
```

**O parecer foi gravado.** O flush leu o snapshot JÁ atualizado. O effect que
sincroniza `snapshotRef` roda antes do `finally` — ao contrário do que §2(a)
deduziu.

**Um falso positivo pelo caminho, que vale registrar.** Numa execução anterior o
disco ficou com `results: []` e pareceu confirmar a tese. A captura mostrou que a
conversa aberta era o **projeto de exemplo**, não a semeada: o parecer que eu
havia lido como "na tela" era o `exemplo-auditoria` do tour. Corrigido o teste
para fechar o tour e clicar na conversa certa, o defeito não aparece. Foi a
captura que desmentiu a leitura — o log sozinho teria confirmado a tese errada.

**Limite honesto desta prova.** Foi exercitado `use-reconectar-auditoria`, não o
`finally` do `ConfirmationCard`. As duas têm a mesma forma, mas não são o mesmo
código, e exercitar a segunda exige rodar uma auditoria de verdade, com custo. A
refutação é forte, não total.

### O que muda

- **Peça 1 sai do escopo.** Implementá-la seria consertar um defeito que não se
  consegue demonstrar — o erro que a análise de arquitetura registra ter custado
  US$ 6 ("mudar arquitetura com base em número que media outra coisa").
- **As peças 2 e 3 ficam, e ganham peso.** As causas (b), (c) e (d) têm certeza
  de código e explicam o incidente sozinhas, sem precisar da corrida.
- **A ordem inverte: a peça 3 vai primeiro.** Ela é a que teria contado a causa
  verdadeira em vez de deixar deduzi-la. Enquanto a gravação falha calada,
  qualquer diagnóstico deste produto é dedução.
- **(c) passa a ser a hipótese principal** para a perda do parecer: com um
  memorial de 5,1 MB na mesma conversa, quota estourada é candidato natural — e
  `putConversation(...).catch(() => {})` a esconderia exatamente assim.
