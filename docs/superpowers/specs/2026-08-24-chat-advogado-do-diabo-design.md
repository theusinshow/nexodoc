# O chat advogado do diabo

**Data:** 24/08/2026
**Estado:** implementado em 25/08/2026. Plano de execução em
`docs/superpowers/plans/2026-08-25-chat-advogado-do-diabo.md`, que registra
**duas divergências deliberadas**:

1. `encaminhar_para_geracao` é resolvido no CLIENTE, e não na rota do chat.
   `runNexoAgentTurn` precisa de `resumo`, `prefeituras`, `escritorio`,
   `tomosSugeridos` e `decisoes`, montados em 180 linhas de
   `app/api/nexo/agent/route.ts` que a rota do chat não tem — duplicá-las
   criaria duas fontes para a mesma verdade. Para o engenheiro o resultado é
   idêntico: o card de confirmação aparece igual.
2. O `auditId` sai de `auditoriaMaisRecente(results)` em vez de descer como
   prop: `NexoChat` já destrutura `results`. O risco real era a regra "a mais
   recente por `generatedAt`" ficar escrita em dois lugares e o chat responder
   sobre uma revisão enquanto o palco mostra outra — por isso ela ganhou um dono
   só, e `PalcoDoNexo` passou a chamá-la também.

Um sétimo consumidor de `origem` apareceu que esta spec não contava: o tipo
local em `components/audit-result.tsx:199`. Era declaração de tipo, não
comparação; passou a espelhar `AuditFinding["origem"]`.

**A prova com token RODOU em 27/08/2026 e PASSOU** — 15 asserções, nenhuma
falha, US$ 1,67 em quatro corridas. Ela deixou de ser roteiro manual e virou
`npm run prova:chat-token`, que confere cada citação contra um gabarito extraído
com pdfjs cru, fora do produto. Sobre `tests/117_25_md_geral_a.pdf` (218
páginas): página e valor da telha (p.62, 6,5 mm), área construída (p.99,
467,46 m²), proprietário divergente (Chapecó na p.99 contra a capa de Criciúma),
recusa limpa de um termo ausente, e evidência ancorada no achado nascido na
conversa. **Nenhuma página citada errada em três corridas de chat.**

**O teto de 8 voltas deixou de ser palpite.** Medido: 2 voltas nas perguntas
diretas, 3 na do termo ausente, e 5/8/6 na pergunta aberta ("procure um erro que
a auditoria deixou passar") — que encostou no teto numa corrida e ainda assim
entregou achado ancorado. **Fica em 8**; baixar cortaria busca legítima.

O que continua não provado: parecer antigo em banco real (modo degradado), e
documento escaneado, sem camada de texto para reler.

## O pedido

O chefe foi explícito: *"seja o advogado do diabo"*. O chat que acompanha a
auditoria tem de responder **qualquer** pergunta sobre o memorial auditado e
**encontrar erro que o motor deixou passar** — com evidência que sustente.

## O diagnóstico (por que hoje é impossível)

Três fatos apurados no código em 24/08/2026:

1. **O chat do palco é o roteador de intenção do Nexo**
   (`server/nexo/agent/run-turn.ts`). Ele recebe os selos e
   `FatosDoMemorial` (obra, município, código, endereço). Ele **não recebe o
   parecer nem o texto do memorial**. Ele existe para propor parâmetros de LD,
   capa, separatriz, volume e auditoria.

2. **A rota `app/api/audit/chat/route.ts` está morta.** Nenhum consumidor desde
   que as telas standalone foram aposentadas. E mesmo viva ela só enxergava o
   JSON compactado do parecer: o prompt dela manda literalmente *"Não diga que
   releu o PDF"*.

3. **O texto extraído do PDF não é guardado em lugar nenhum.**
   `app/api/audit/route.ts:3772` extrai por corrida e descarta. No banco sobra
   só `AuditFile.extractedCharCount`. O provedor de blob está em `"none"`
   (`lib/file-storage.ts:14`) — os bytes do PDF vivem no navegador.

Conclusão: o chat nunca viu o documento. Nenhum ajuste de prompt resolve isso.

## As decisões tomadas

| Pergunta | Decisão |
|---|---|
| Alcance | Parecer **+** texto do memorial **+** contexto do projeto |
| Destino do erro achado no chat | Vira **achado de verdade** no parecer |
| Momento | **Depois do parecer pronto** (durante a corrida, o chat segue como hoje) |
| Postura | **Reativo, mas nunca puxa-saco**: discorda quando tem base |
| Mecanismo | **Laço de ferramentas** (tool-calling), não contexto cheio nem RAG |

### Por que ferramentas, e não as alternativas

- **Contexto cheio** (memorial inteiro no prompt a cada turno): o
  `063_26_md_geral_a.pdf` tem 73 páginas e 173k chars (≈43k tokens) e entraria
  em toda pergunta. O cache de prefixo já foi medido e **não rende aqui**. Pior:
  com 73 páginas coladas, o modelo erra o número da página.
- **RAG leve** (uma busca por turno, blocos injetados): o advogado do diabo
  precisa **navegar** — "e na página seguinte?", "onde mais aparece essa cota?".
  Uma busca única não navega; ele responde com o que a primeira busca trouxe e
  cala sobre o resto.
- **Ferramentas**: a página e a evidência **saem da ferramenta determinística**,
  nunca da cabeça do modelo. É o que torna a afirmação verificável — e é a única
  das três em que "achado novo" nasce com prova que sustenta.

O princípio é o mesmo do resto do produto: **fato determinístico primeiro, IA
por último**. A IA escolhe o que olhar; quem responde *onde está* é o código.

## Arquitetura

Quatro peças, uma spec só.

### Peça 1 — A memória do documento

O texto extraído passa a ser gravado junto com a auditoria.

**Onde:** `lib/audit-persistence.ts`, dentro de `persistCompletedAudit`. A função
**já recebe** `uploadedFiles: UploadedAuditFile[]`, e cada item já carrega
`extracted: ExtractedPdf` com todas as páginas. Não é preciso mudar a rota de
auditoria nem re-extrair nada: é gravar o que já está na mão, dentro da
transação que já existe.

**Modelo novo em `prisma/schema.prisma`:**

```prisma
/// O texto do documento auditado, guardado para o chat pós-parecer poder RELER
/// o memorial em vez de falar de cor sobre o parecer. Sem isto o chat nunca viu
/// o documento — só o JSON dos achados.
///
/// Guardamos o TEXTO, não o PDF: os bytes vivem no navegador e o provedor de
/// blob está em "none". ~173 KB para um memorial de 73 páginas.
model AuditText {
  id        String   @id @default(cuid())
  auditId   String
  fileName  String
  /// Uma entrada por página: { page, text }. É daqui que sai o número da página
  /// que o chat cita — o modelo nunca o inventa.
  pages     Json
  /// O ÍNDICE por capítulo (`chunkPdfByChapter`), SEM o texto: título, página
  /// inicial, final e nº de chars. Guardar o texto aqui também dobraria o
  /// armazenamento — o texto do capítulo se reconstrói das páginas.
  capitulos Json
  charCount Int
  createdAt DateTime @default(now())
  audit     Audit    @relation(fields: [auditId], references: [id], onDelete: Cascade)

  @@index([auditId])
}
```

`Audit` ganha `texts AuditText[]`.

**Pareceres antigos não têm texto.** Comportamento degradado explícito: o chat
funciona só com o parecer e **diz na resposta** que não tem o documento desta
auditoria, sugerindo reauditar para habilitar a releitura. Nunca finge ter lido.

### Peça 2 — O chat com ferramentas

`app/api/audit/chat/route.ts` é **reescrita** (a atual está morta; o portão de
sessão `requireActor`, o CORS e a classificação de falha do provedor são
aproveitados como estão).

Novo módulo `server/audit/chat/` com o laço, espelhando a separação que
`server/nexo/agent/` já usa (rota fina, cérebro isolado e trocável):

- `run-chat-turn.ts` — o laço de tool-calling
- `ferramentas.ts` — as definições e as implementações
- `prompt.ts` — as instruções do advogado do diabo

**As ferramentas (todas determinísticas):**

| Ferramenta | O que devolve | Reusa |
|---|---|---|
| `listar_capitulos()` | O índice do memorial: capítulo, página inicial, chars | `chunkPdfByChapter` |
| `buscar_no_memorial(termo)` | Trechos com a **página real** e o texto ao redor | normalização do tipo `esqueleto` (ver `scripts/prova-evidencia-ancorada.ts`) |
| `ler_paginas(de, ate)` | O texto literal do intervalo (teto de páginas por chamada) | `textoDaPaginaParaIA` |
| `ler_achado(id)` | O achado inteiro do parecer, com todos os campos | `Audit.report` |
| `historico_da_obra()` | Pareceres anteriores do mesmo `projectId` + aprendizados ativos | Prisma + `listAuditLearnings` |
| `registrar_achado({...})` | Grava um achado novo no parecer (ver Peça 3) | Peça 3 |
| `encaminhar_para_geracao()` | Delega o turno ao roteador de intenção do Nexo | `runNexoAgentTurn` |

**`encaminhar_para_geracao` existe por um motivo concreto:** com o parecer no
palco, todo turno vai para este chat. Se o engenheiro disser "monta o volume",
sem essa saída ele perderia o Nexo. A ferramenta roda `runNexoAgentTurn` e a
rota emite as `proposals` resultantes no mesmo contrato SSE que o cliente já
entende — o card de confirmação aparece igual.

**Teto do laço:** máximo de voltas configurável
(`NEXODOC_AUDIT_CHAT_MAX_TOOL_TURNS`, default 8). Estourou o teto, o chat
responde com o que juntou e **diz que parou por limite** — nunca silencia. Cada
volta passa por `executeOpenAiResponse`, que já cobra e telemetra por chamada;
nada muda na contabilidade de custo.

**A postura, no prompt.** As regras que fazem o advogado do diabo:

- Responda **qualquer** pergunta sobre o memorial. Se não souber, **busque**
  antes de dizer que não consta.
- **Nunca concorde por educação.** Se um achado do parecer não se sustenta na
  evidência, diga isso e mostre o trecho que o contradiz.
- **Nunca afirme página ou trecho sem ter chamado uma ferramenta.** Se a
  ferramenta não achou, diga que não achou — não aproxime.
- Ao encontrar um problema real que não está no parecer, **registre-o** com
  `registrar_achado`.
- Distinga erro documental crítico, ponto técnico/contratual e revisão
  editorial — a régua do escritório, igual à do motor.

### Peça 3 — O achado nascido no chat

`AuditFinding.origem` já existe como `"regra" | "ia"` (`lib/audit-report.ts:83`).
Passa a ser `"regra" | "ia" | "chat"`.

**Por que isso é seguro:** os seis consumidores de `origem` testam `=== "regra"`
(`lib/audit-report.ts:108,931,956`, `lib/audit-reuso.ts:156`,
`lib/audit-verify.ts:228,255`, `lib/severidade.ts:68`). Um achado `"chat"` cai
no mesmo ramo que um achado `"ia"` em severidade, verificação e reuso — que é o
comportamento correto: ele **é** nascido de IA, e deve passar pela mesma trava
anti-alucinação e pelo mesmo reancoramento entre versões. Nenhum desses ramos
muda.

O que muda:

- `registrar_achado` valida a evidência **contra o texto guardado** antes de
  aceitar: se o trecho citado não existe na página informada, a ferramenta
  **recusa** e devolve o erro ao modelo, que tenta de novo. É a ideia de
  `audit-verify.ts`, só que rodando no ato.
- O achado recebe `id` na série do parecer, `origem: "chat"` e a impressão
  digital (`lib/impressao-do-achado.ts`), para ter linhagem entre versões.
- Grava no `Audit.report` (Json) e incrementa `totalFindings` e
  `total_incongruencias`.
- A rota devolve o achado ao cliente no fluxo SSE; o cliente funde no estado e
  regrava no IndexedDB — o parecer persiste em dois lugares, e os dois precisam
  concordar.
- Canvas, fila e feedback derivam do parecer: **enxergam o achado novo de
  graça**, sem alteração.
- No card, o achado nascido no chat é identificável pela origem — o engenheiro
  precisa saber que veio da conversa, não da varredura.

**O que o chat NÃO faz sozinho.** Se ele concluir que um achado **existente** é
falso positivo, ele **propõe** e o engenheiro decide. `AuditFeedback.verdict`
alimenta o benchmark do motor; deixar a IA escrever ali contamina a única régua
que mede se a auditoria está melhorando. Acrescentar achado é aditivo;
desqualificar achado alheio é julgamento sobre a auditoria, e esse é do
engenheiro.

### Peça 4 — O contexto do acervo

É a ferramenta `historico_da_obra()`: uma consulta Prisma por `projectId`
trazendo os pareceres anteriores da mesma obra (data, veredito, nº de achados,
achados críticos) mais `listAuditLearnings({ activeOnly: true })`. Barata, por
isso fica nesta spec em vez de virar sub-projeto.

Serve ao advogado do diabo diretamente: *"esse mesmo erro foi apontado na
revisão anterior e continua aqui"* é o tipo de frase que só existe com acervo.

## Fluxo de dados

```
Auditoria roda  →  extractPdfText  →  parecer
                          │
                          └─→ persistCompletedAudit → AuditText (páginas + capítulos)

Engenheiro pergunta no palco (parecer presente)
        │
        ▼
POST /api/audit/chat  { auditId, pergunta, histórico }
        │
        ├─ carrega parecer (Audit.report) + AuditText
        ▼
   laço de ferramentas (teto de 8 voltas)
        │   buscar_no_memorial / ler_paginas / ler_achado /
        │   listar_capitulos / historico_da_obra
        │
        ├─ registrar_achado → valida evidência → grava no report → SSE ao cliente
        ├─ encaminhar_para_geracao → runNexoAgentTurn → proposals no SSE
        ▼
   resposta em texto (SSE, streaming) + achados novos
```

## Roteamento do chat

O cliente decide para onde mandar o turno:

- **Parecer no palco** (`salvo?.auditId` presente em `PalcoDoNexo`) →
  `/api/audit/chat`
- **Sem parecer** → `/api/nexo/agent`, exatamente como hoje

`NexoChat` passa a receber `auditId` como prop. Hoje ele não o conhece: o
`auditId` vive em `PalcoDoNexo` (`salvo?.auditId`), então a peça que contém os
dois precisa descê-lo até o chat.

## Erros e limites

| Situação | Comportamento |
|---|---|
| Parecer antigo, sem `AuditText` | Responde só com o parecer e **avisa** que não tem o documento |
| Ferramenta não encontra o termo | Diz que não encontrou; **não aproxima** nem inventa página |
| Teto de voltas estourado | Responde com o que juntou e **diz que parou por limite** |
| `registrar_achado` com evidência que não bate | Ferramenta recusa e devolve o erro ao modelo, que corrige |
| Banco não configurado | Chat responde só com o parecer enviado pelo cliente |
| Falha do provedor | `classifyProviderFailure`, como as outras rotas |

## Testes

- **Puro, sem token, sem banco:** as ferramentas são funções sobre estruturas.
  Cada uma testável em Node cru, como `server/nexo/agent/fatos.ts` já é.
  - `buscar_no_memorial` acha o termo e devolve a página **certa**
  - `ler_paginas` respeita o teto de páginas
  - `registrar_achado` **recusa** evidência que não existe no texto
  - o laço para no teto de voltas e sinaliza que parou
- **Com banco, sem token:** `AuditText` grava e lê; parecer antigo cai no
  caminho degradado.
- **Com token, uma vez:** uma pergunta real sobre um memorial do kit de erros
  plantados, conferindo que a página citada bate com o PDF.
- **No navegador:** a asserção mede a **caixa contra a janela**, não só o DOM.

## Fora de escopo

- Passada cética proativa ao fim da auditoria (foi considerada e recusada:
  gastaria modelo em toda auditoria; o chat é reativo).
- Chat durante a corrida da auditoria, com parecer parcial.
- Chat sobre memorial sem auditoria rodada.
- A IA escrever `AuditFeedback.verdict`.
