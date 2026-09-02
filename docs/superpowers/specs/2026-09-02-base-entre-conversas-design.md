# A base da reauditoria fora da conversa — e a folha que era o código

**Data:** 02/09/2026
**Origem:** levantamento do reuso feito neste mesmo dia. Dois itens ficaram
abertos; este spec fecha os dois.

## Tópico 1 — a base entre conversas

### O problema

A rota `/api/audit` aceita qualquer base anterior por id (escopada por
`projectId`), e desde `ae5d47f` a `chaveDoDocumento` reconhece `_a` → `_b` e a
via assinada como o mesmo documento. Mas quem escolhe a base é o cliente, e ele
só olha a **conversa atual**:

```ts
// modules/nexo/components/ConfirmationCard.tsx
const auditoriaAnterior = results
  .filter((r) => r.kind === "auditoria" && r.artifactId !== id)
  ...
```

Consequência: corrigir os erros do memorial e voltar numa conversa nova relê
100% do documento, sem dizer que havia base. O comentário no código explica a
escolha ("comparar com a de outra conversa arriscaria emparelhar revisões
diferentes que convivem") — o risco era real quando a única chave era o nome
exato do arquivo. Com `chaveDoDocumento` ele fica contido: chaves diferentes não
casam, e um pareamento errado degradaria para "nenhum capítulo bate", que relê
tudo.

### Decisão

**Acha e mostra; o engenheiro confirma.** A base vem marcada para reusar, com um
clique para recusar. Nada é reusado às escondidas, e a base aparece ANTES de
gastar.

### Onde a busca mora

Estender `/api/audit/delta`, e não criar rota nova: ela já recebe o arquivo e já
calcula a impressão atual. Passa a aceitar `auditIdAnterior` **opcional** mais
`projectId`; sem o id, procura. Uma chamada, uma ida ao servidor.

### Como procura sem carregar o mundo

`Audit.report` é um JSON grande (achados, síntese). Puxar os 20 últimos para ler
um nome de arquivo seria caro. `AuditText` já guarda `fileName` por auditoria:

1. `auditText.findMany` selecionando **só** `auditId` e `fileName` — das
   auditorias `COMPLETED` do projeto, mais recentes primeiro. Nunca `pages` nem
   `capitulos`, que são o volume do registro.
2. Filtra por `chaveDoDocumento` contra o nome do arquivo.
3. Carrega o `report` **de uma só**: a candidata vencedora.

Escopo: `projectId` mais `auditWhereForActor` — a regra de acesso que já existe.
Auditoria ligada a projeto pertence ao **escritório**, então a base de um colega
no mesmo projeto é elegível; a tela diz de quem é.

### A regra que não pode ser esquecida

A busca só oferece base que **`avaliarBase` aceita** — versão do auditor,
análise parcial, folha muda não lida. Sem isso o defeito de `ae5d47f` volta pela
porta ao lado: o cartão prometendo economia que a auditoria depois recusa.
Candidata reprovada é descartada e a busca segue para a próxima.

### O que aparece na tela

```
COMPARADO À AUDITORIA DE 28/08, 14:32 · outra conversa · Fulano
86% do texto já foi lido antes. Entrou: 7 - ESTRUTURAS.
                                              [ não usar esta base ]
```

"Não usar" apenas não manda o `auditIdAnterior`: a auditoria roda inteira, como
sempre rodou. A origem (`outra conversa` + quem rodou) só aparece quando a base
NÃO é da conversa atual — dentro da conversa a frase segue como está hoje.

### Empate e ausência

- Mais de uma candidata válida → a **mais recente**.
- Projeto ainda não resolvido (anexo antes do vínculo) → não procura, e o cartão
  fica como hoje.
- Nenhuma candidata → como hoje: nada aparece, auditoria completa.

## Tópico 2 — a folha que era o código

### O problema

Duas regras de "número da folha" convivem em `server/nexo/parse-filename.ts`:

| função | regra | correta? |
|---|---|---|
| `sheetNumberFromFilename` | tira o código do projeto, pega o **último** número | sim — é a que o fluxo de volume usa |
| o campo `folha` de `parseFilename` | pega o **primeiro** grupo de 3 dígitos | não — é sempre o código |

`040_26_his_001_a.pdf` reporta folha **40**, não 1.

### Medição

Rodadas as duas contra os 654 PDFs de `docs/`:

- `parsed.folha` está errado em **651 (99,5%)**.
- Unificar muda o `tipo` em **6 (0,9%)**, todos `outro → prancha`. Nenhum entra
  ou sai de `memorial`, então o roteamento memorial-vs-prancha não se mexe.

### Decisão

`parsed.folha` passa a derivar de `sheetNumberFromFilename`. Uma regra só.

Consumidor único hoje: `server/nexo/classify-documents.ts:73`, que alimenta o
dossiê do Nexo.

Efeito colateral bem-vindo: `114_19_VOLUME ÚNICO.pdf` sai de `prancha` para
`outro` — mais honesto, e sem mudar para onde ele vai.

## Fora de escopo

- Trocar o roteamento memorial-vs-prancha do nome para o conteúdo. Renomear
  resolve, e a decisão de manter é de 02/09.
- Reuso entre PROJETOS. A base é escopada por `projectId` no servidor e assim
  fica.

## Provas

| Prova | O que fecha | Custa IA? |
|---|---|---|
| `test:base-anterior` | escolhe a mais recente **válida**, pula a reprovada por `avaliarBase`, não casa chave diferente, e não carrega `pages` | não |
| `test:parse-filename` (estendido) | a folha do 040-26 é 1..11 e não 40; as 6 mudanças de tipo ficam fixadas | não |
| `prova:base-entre-conversas` | corrida real: auditar, abrir conversa nova, anexar a revisão, ver a base aparecer | sim, 1 auditoria |
