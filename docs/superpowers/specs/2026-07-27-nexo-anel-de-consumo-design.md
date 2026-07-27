# Nexo — anel de consumo na barra: consumo e modelos por conversa

**Data:** 2026-07-27
**Estado:** desenho aprovado, pronto para virar plano de implementação

## Problema

A barra do Nexo não diz nada sobre o que a IA custou. O único indicador existente
é o `UsageArc` perto do label do Nexo, e ele tem dois defeitos:

1. **Inventa um teto.** Preenche contra `SOFT_CAP = 200_000`, com um comentário no
   próprio código admitindo que "não é um limite real". Cheio não significa nada.
2. **Conta menos do que aparenta.** Soma só a leitura de selos e os turnos do
   agente — os dois pontos onde o cliente recebe `usage` de volta. Auditoria e
   análise de volume consomem IA e ficam de fora, então o número é menor que a
   verdade sem avisar.

E nada em lugar nenhum diz **qual modelo** atendeu cada trabalho.

## O que este trabalho NÃO é

Não é um medidor de limite/cota. Não existe regra de limite por usuário neste
produto — não há `budget`, `plan` ou `quota` no schema — e este desenho
deliberadamente não inventa uma. O anel mostra **o que foi consumido**, não
**quanto ainda resta**.

Fora de escopo (YAGNI): histórico entre conversas, gráfico temporal, teto,
alerta de gasto, e conversão para reais.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Recorte | **A conversa atual** | Responde "quanto custou este trabalho", casando com o modelo mental conversa=obra do Nexo. Precisa sobreviver ao restaurar uma conversa do histórico. |
| O que o anel codifica | **Composição por modelo** (círculo sempre completo, fatiado) | Um círculo completo significa "este é o total", não "você chegou no limite". Dispensa denominador e mostra tokens e modelos na mesma peça. |
| Fonte do dado | **`AiUsageEvent` no banco** | Fonte única e verdadeira: pega toda chamada de IA, inclusive as que o cliente nunca vê, e já traz `estimatedCostUsd`. |
| Detalhe | **Por tarefa, com modelo e custo** | Responde as duas perguntas do pedido: no que gastou e com qual modelo. |
| `UsageArc` antigo | **Aposentado** | Dois indicadores do mesmo número, um deles com teto falso, é pior que um só. |

## Arquitetura

### 1. Amarrar o consumo à conversa (servidor)

`AiUsageEvent` **não tem** hoje por onde referenciar uma conversa. (`relatedType`/
`relatedId` existem no `AiTask`, que é outra tabela e só é criado quando o
chamador passa `agent` — o que nenhum fluxo do Nexo faz.)

Portanto: **migração** acrescentando à `AiUsageEvent`

```prisma
conversationId String?
@@index([conversationId])
```

`RecordAiUsageArgs` (`lib/ai-usage.ts:12`) e `ExecuteOpenAiResponseArgs`
(`lib/ai-runner.ts:26`) ganham o mesmo campo opcional, repassado até a gravação.
Sendo opcional, todo chamador existente segue compilando e gravando `null`.

O cliente manda `conversationId` nas rotas que consomem IA a partir do Nexo. São
**três** pontos de entrada — verificados no código, não presumidos:

| Entrada | `flow` | Rótulo para o usuário | Chamadas ao modelo |
|---|---|---|---|
| `app/api/nexo/agent/route.ts` | `nexo-agent` | Turnos da conversa | 2 (turno normal e transmitido) |
| `app/api/ld/extract-stamp/route.ts` | `ld-extraction` | Leitura de selos | 2 (OpenAI e o fallback MiMo) |
| `app/api/audit/route.ts` | `audit` | Auditoria do memorial | 7, todas via `executeAuditModelResponse` |

A auditoria é a que o arco de hoje ignora — incluí-la é o que torna o número
honesto. E ela sozinha responde por 7 dos 11 pontos de gravação. **Não é uma
linha repetida sete vezes:** as sete chamadas vivem em funções de módulo
separadas, cada uma com seu objeto `args`, nenhuma enxergando o escopo do
`POST`. O `conversationId` atravessa oito funções (as sete mais a intermediária
`deepAnalyzeFile`). É o pedaço mais caro do trabalho.

**A análise de volume ficou de fora porque não existe neste caminho.** Nenhuma
rota `/api/nexo/*` além do agente importa IA; o fluxo `volume-analysis` pertence
ao módulo `/volumes`, fora da conversa. Uma versão anterior deste spec a listava
por engano.

**A auditoria vai por multipart**, não JSON (`modules/nexo/lib/audit.ts:46` monta
um `FormData`), então ali o `conversationId` é um campo do form.

**O eixo "tarefa" é o `flow`, não o `operation`.** `flow` é um enum estável que
mapeia 1:1 no que o engenheiro percebe como tarefa; `operation` varia dentro do
mesmo trabalho (`nexo-selo` e `nexo-selo-image` são ambos "leitura de selos") e
não acrescenta nada na tela.

### 2. Agregação (servidor)

`GET /api/nexo/usage?conversationId=…` devolve dois cortes do mesmo conjunto:

```ts
{
  porModelo: { model: string; totalTokens: number; costUsd: number | null }[],
  porTarefa: { flow: string; model: string; totalTokens: number; costUsd: number | null }[],
  totalTokens: number,
  totalCostUsd: number | null,
}
```

**Segurança:** a consulta filtra sempre pelo `userEmail` da sessão, além do
`conversationId`. O `conversationId` é um UUID gerado no cliente
(`conversation-store.tsx`, `crypto.randomUUID()`) — ele identifica, não autentica.
Sem o filtro por usuário, adivinhar um id exporia consumo alheio.

**Custo:** `estimatedCostUsd` é nulo quando o modelo não está na tabela de preços
(`lib/ai-usage.ts:29`) ou quando o provider não é OpenAI. O total soma o que
existe e a UI marca "—" no que falta; em nenhuma hipótese estima por conta
própria.

**Sem banco configurado:** `isDatabaseConfigured()` já guarda a gravação. O
endpoint devolve zeros, e o anel simplesmente não aparece.

### 3. Cliente

`useConversationUsage(conversationId)` — hook com `{ data, refresh }`. Busca ao
montar, ao trocar de conversa, e sob `refresh()` explícito. Quem chama `refresh()`:

- o chat, ao receber o `done` do turno;
- o workspace, ao terminar a leitura de selos e ao terminar auditoria/volume.

O `api-usage.tsx` (contador cego em memória) **sai**. Mantê-lo criaria uma segunda
verdade divergindo da primeira a cada retentativa ou falha.

### 4. UI

**`UsageDonut`** — na barra do composer, à direita, antes do enviar. Círculo
sempre completo, fatiado por modelo, com o total abreviado ao lado (`15,5k`).
Escondido enquanto o consumo for zero, como o arco de hoje. Clicar abre o popover.

**Popover** — uma linha por par **(tarefa, modelo)**, com tokens e custo; rodapé
com o total:

```
Consumo desta conversa
──────────────────────────────────────────
Leitura de selos   gpt-5-mini   8,2k   $0,004
Turnos da conversa gpt-5.5      5,1k   $0,021
Auditoria          gpt-5.5      2,2k   $0,009
──────────────────────────────────────────
Total                          15,5k   $0,034
```

Uma tarefa que tenha usado dois modelos (ex.: leitura de selos com um fallback)
aparece em **duas linhas**, com o nome da tarefa repetido. É o contrário de
esconder: a troca de modelo dentro do mesmo trabalho é justamente o que o
engenheiro precisa ver. As linhas vêm ordenadas por tokens, maior primeiro.

**Cores das fatias:** escala derivada do teal do sistema (2 a 4 modelos na
prática). Nada de paleta categórica arco-íris — brigaria com a identidade e
sugeriria semântica onde só há distinção.

**Acessibilidade:** o donut é decorativo (`aria-hidden`); o botão que o contém
carrega o rótulo textual com o total, e o popover é a versão legível do dado. A
informação nunca depende só de cor — cada fatia tem sua linha na tabela.

## Degradação

| Situação | Comportamento |
|---|---|
| Sem banco configurado | Anel não aparece |
| Endpoint falha | Anel não aparece; nenhum erro na cara do usuário (é informação acessória) |
| Modelo fora da tabela de preços | Tokens aparecem, custo vira "—" |
| Conversa restaurada do histórico | Busca pelo `conversationId` restaurado; o número volta igual |
| Chamada de IA anterior a esta feature | `conversationId` nulo, fica fora da conta — passado não é reescrito |

## Testes

O grosso é I/O (Prisma + rota), que este repositório não cobre com teste
automatizado. O que dá para testar puro, no padrão `scripts/test-nexo-*.ts`:

- **agregação**: dada uma lista de eventos, agrupar por modelo e por fluxo, somar
  tokens, somar custo ignorando nulos, e devolver `null` no total quando nenhum
  evento tem preço. Função pura, sem Prisma, chamada pela rota.
- **rótulos**: `flow` → nome em português, com fallback para o próprio `flow`
  quando aparecer um fluxo novo (nunca mostrar string vazia).

Verificação manual ao final: gerar consumo real numa conversa pelos quatro
caminhos e conferir que a soma do popover bate com as linhas da `AiUsageEvent`.

## Riscos

**O maior risco é a plumbing dos três pontos de entrada.** Se um deles não
carimbar o `conversationId`, o anel volta a mentir por omissão — só que agora com
mais autoridade, porque se apresenta como completo. A verificação manual acima
existe para isto: é o único jeito de provar que os três caminhos chegam.

O ponto mais fácil de errar é a auditoria: são sete chamadas na mesma rota, e
esquecer uma produz um número quase certo, que é pior que um obviamente errado.
