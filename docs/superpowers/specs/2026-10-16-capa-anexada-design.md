# Capa anexada — o modelo de capa que o projeto já tem

Data: 16/10/2026. Status: desenho aprovado.

## Problema

A capa do volume só sai dos 4 modelos ODT do repositório
(`templates/capas/{prefchap,pmcriciuma,prefflor,prefsjose}`), com marcadores
`{{…}}` postos à mão por quem mantém o código. Projeto que já tem uma capa pronta
— de outra prefeitura, de uma variação nova, ou a capa que o cliente exigiu — não
tem como usá-la: o engenheiro monta o volume com o modelo errado ou troca a capa
à mão depois.

## Decisões

1. **O Nexo aceita uma capa pronta anexada no chat**, em ODT ou PDF.
2. **ODT vira modelo; PDF entra como está.** PDF não é editável com fidelidade
   (tapar e reescrever não bate fonte nem alinhamento numa peça que vai para a
   prefeitura).
3. **Leitura determinística primeiro, IA só no que sobrar.**
4. **Nada grava sem o engenheiro confirmar** o que cada linha da capa é.
5. **Escopo: o projeto** (decisão do Matheus, 16/10). O modelo vale para os
   volumes e revisões daquele projeto; não aparece em outros.
6. **Capa que transborda é recusada** como modelo; nas prefeituras, vira aviso.

## 1. Entrada (pré-voo)

- O anexo do chat passa a aceitar `.odt` (hoje só PDF passa pelo pré-voo).
- `PapelDoAnexo` (`modules/nexo/lib/papel-do-anexo.ts:61`) ganha `"capa"`, e o
  tipo do chip em `NexoChat.tsx:78` também.
- **ODT é sempre capa.** No contexto do Nexo não há outro uso para ODT.
- **PDF é capa quando o nome diz capa**: `parseFilename` já devolve
  `tipo="capa"` (`server/nexo/parse-filename.ts:369`), e hoje `decidirPapel`
  (`papel-do-anexo.ts:211`) o manda para prancha (`NOME_DIZ_PRANCHA`). Esse
  caso passa a ser capa.
- O chip pode ser trocado à mão, como os outros papéis.

## 2. Leitura do ODT

Rota nova `POST /api/nexo/modelo-capa` (multipart: arquivo + `projectId`).

1. Descompacta, aplica `desembrulharCamposDeUsuario`
   (`server/odt/marcadores.ts`) e extrai os parágrafos do `office:text` como
   `{ indice, texto }` (texto visível, spans juntados).
2. **Regras** (puras, `server/nexo/modelo-capa/regras.ts`), por parágrafo:
   - código `\d{3}[-_]\d{2}` → `CODIGO_EXIBIDO`;
   - mês/ano por extenso ou `MM/AAAA` → `MES_ANO`;
   - `(?TOMO \d+)?` → `TOMO`, e o **formato** sai do texto
     (`parenthesized-padded`, `plain-padded`, …);
   - `VOL(UME)?\.? <romano|número>` → `VOLUME`, e `volumeFormat` sai do texto;
   - casamento com o órgão/secretaria dos `defaults` das prefeituras e com o
     `Project.identidade` → `ORGAO`, `SECRETARIA`, `NOME_OBRA`;
   - "PROJETO EXECUTIVO/BÁSICO/…" → `FASE`.
3. **IA** só se sobrar parágrafo com texto não classificado: uma chamada
   `executeOpenAiResponse` (`lib/ai-runner.ts:198`), `reasoning.effort:"none"`,
   `json_schema` estrito: `{ indice, campo }[]`, campo ∈ marcadores conhecidos
   ∪ `"FIXO"`. Fluxo novo `nexo-modelo-capa` em `AI_MODEL_FLOW_DEFINITIONS`
   (`lib/ai-model-config.ts:26`), padrão `gpt-6-luna`.
4. Devolve a **proposta**: cada parágrafo com texto, o campo, a origem
   (`regra`/`ia`) e os formatos de tomo/volume. Nada é gravado aqui.

Obra em várias linhas: os parágrafos consecutivos marcados `NOME_OBRA` recebem
o marcador repetido — `distribuirNosMarcadores` já reparte as linhas entre as
ocorrências. O mesmo vale para `TITULO_CAPA`.

## 3. Confirmação no chat

Card "Modelo de capa" na conversa: uma linha por parágrafo com texto —
o texto original à esquerda, o campo à direita num seletor (marcadores +
"texto fixo"). A origem `ia` leva o selo discreto de "sugerido". Botões:
**Usar este modelo** / **Descartar**. Correção pelo chat também vale
(decisão do engenheiro, mesma precedência de `nexodoc-preencher-pelo-carimbo`).

## 4. Gravação

Ao confirmar (`PUT /api/nexo/modelo-capa`):

1. **Injeta os marcadores** (`server/nexo/modelo-capa/injetar.ts`, puro): no
   parágrafo `i`, troca o conteúdo de texto pelo `{{CAMPO}}`, mantendo o
   `text:style-name` do parágrafo e o do primeiro span. Parágrafos `FIXO` ficam
   intactos.
2. **Ensaio**: gera uma capa com dados de teste longos (obra de 4 linhas,
   título de 2 linhas, `TOMO 04`) via `generateOdtBuffer` + `convertOdtToPdf`
   e conta páginas. A referência é o próprio ODT anexado convertido em PDF
   (1 página, ou 2 se o modelo tem contracapa). Mais páginas que isso → **recusa**, com
   o motivo no card ("a capa transborda para a 2ª página com uma obra de 4
   linhas — ajuste o espaço no modelo e anexe de novo").
3. Grava os bytes no cofre (`guardarNoCofre`, `lib/cofre.ts:87`, cifrado) e
   uma linha na tabela nova:

```prisma
model ModeloDeCapaDoProjeto {
  id             String   @id @default(cuid())
  projectId      String   @unique
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  storedFileId   String
  config         Json     // campos, tomoFormat, volumeFormat, defaults lidos
  nomeOriginal   String
  criadoPorId    String
  createdAt      DateTime @default(now())
}
```

   Um modelo ativo por projeto (`@unique`). Anexar outro mostra "substituir o
   modelo de 16/10?" antes de gravar.

## 5. Uso na montagem

- `server/templates/registry.ts` ganha a resolução `projeto:<projectId>`: lê
  config da tabela e bytes do cofre. `generateOdtBuffer`
  (`server/odt/index.ts:33`) passa a aceitar os bytes do modelo, além do
  caminho em disco.
- Precedência do modelo em `normalizeProposals` (`server/nexo/agent/normalize.ts:426`):
  **decisão do engenheiro > modelo do projeto > prefeitura pelo carimbo**.
  `buildCapaProposal` aplica o `config` do modelo do projeto do mesmo jeito que
  o de prefeitura.
- O card da capa diz a procedência: "modelo do projeto, anexado em 16/10".
- O resto da cadeia (`generateCovers` → volume) não muda.

## 6. PDF como está

- Uso único, não grava modelo. Entra como a parte `capa` do volume
  (`VolumePartSource`, `server/nexo/volume-parts.ts:88`), sem gerar ODT.
- Vários tomos: o mesmo PDF em todos, e o card avisa "a capa em PDF entra igual
  em todos os tomos; para numerar o tomo, mande o ODT".
- Não passa por IA.

## 7. Contagem de páginas em toda capa

`generateCovers` (`server/nexo/tools/generate-covers.ts:84`), depois de
`semPaginasEmBranco`: se o PDF de uma capa tem mais páginas que o modelo
(1 por capa, 2 em Florianópolis que tem contracapa), o card da capa mostra o
aviso. Nos 4 modelos de prefeitura é aviso, não bloqueio; fecha a pendência do
transbordo de Criciúma/Chapecó que passava calado.

## 8. Testes

- **Ida e volta, sem token** (`test:nexo:modelo-capa`): para cada um dos 4
  modelos do repositório, gerar uma capa real com dados conhecidos, entregar o
  ODT gerado à leitura (só regras + respostas de IA fixas) e conferir que cada
  campo volta no parágrafo onde o marcador original estava, e que o formato de
  tomo/volume bate com o `config.json`.
- Injeção: o ODT injetado, gerado com os mesmos dados, produz o mesmo texto
  que o modelo original.
- Ensaio de páginas: um modelo com espaço apertado é recusado.
- Prova no navegador (build de produção): anexar um ODT, confirmar, montar o
  volume, ler o PDF da capa por coordenada (`scripts/shot-nexo-frame-capa.mjs`).

## Custo

Uma chamada `gpt-6-luna` por modelo anexado, e só quando as regras não
classificam tudo: < US$ 0,001. Gerar volumes depois não chama IA.

## Fora do escopo

- Editar PDF (tapar e reescrever).
- Promover o modelo do projeto a modelo da prefeitura.
- Mais de um modelo ativo por projeto.
