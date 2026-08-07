# Nexo — Roadmap do módulo assistente

**Status:** Fase 1 (casca) em construção · desligável por flag `NEXT_PUBLIC_NEXO_ENABLED`
**Objetivo:** carro-chefe do NexoDoc. O usuário solta os PDFs, conversa ("cria as LDs, as capas e junta o volume"), e o software orquestra os módulos existentes e devolve os documentos e PDFs — **sempre confirmando** o que for decisão ou irreversível.

## Princípios (inegociáveis)

1. **Fato determinístico primeiro, IA por último.** A IA entende intenção e preenche parâmetros; os motores determinísticos que já existem geram o documento. A IA nunca "escreve" o documento final.
2. **Afirma fatos, pergunta decisões.** O que o sistema consegue detectar (disciplina, nº de pranchas), ele afirma e pede confirmação — não pergunta do zero. O que é juízo do usuário (juntar volumes? quantas pranchas por tomo?), ele pergunta.
3. **Nada irreversível sem confirmação.** Documento oficial de prefeitura é alto risco. O agente propõe um plano revisável; o usuário aprova; só então emite.
4. **Não altera o conteúdo-fonte.** O Nexo empacota, gera artefatos novos (LD, capa) e audita. Nunca edita as pranchas do usuário.
5. **Kill-switch sempre.** É um módulo isolado. Se der ruim, desliga a flag e os outros módulos seguem intactos.

## Fluxo canônico (confirmado com o usuário) — o caminho principal

A unidade de trabalho é **o lote de pranchas de UMA disciplina**, não o projeto inteiro nem o memorial:

1. Engenheiro da disciplina (ex.: incêndio) anexa **as pranchas dele** + escolhe a **prefeitura**.
2. Nexo lê os **selos das pranchas** (OCR — reusa `/api/ld/extract-stamp`) → obra/fase + folhas → propõe **capa + LD**. Órgão/secretaria/formato de volume vêm do **template da prefeitura**; obra/fase do selo. Engenheiro confirma.
3. Gera capa + LD (`generateCovers`, `createLD`).
4. Depois: memorial pronto → **audita** (conferência leve sempre; completa contra o memorial quando anexado).
5. Salva resultados **nas pastas certas**, fecha.

**Casos raros** (mantidos, mas secundários): upload de pasta inteira; auditoria do memorial inteiro.

## O Dossiê do Projeto

Objeto único de estado (`modules/nexo/types.ts`) que o agente constrói ao longo da conversa e que cada ferramenta consome sem redigitar: obra, órgão, código, revisão, fase, disciplinas, arquivos e artefatos gerados. Cada fato carrega origem (`extraido | projeto | usuario | sugerido`) e `confirmado`.

## Fases

### Fase 0 — Fundação (pré-requisito; tem valor mesmo sem chat)
- [x] **Intake + extração** (keystone) — **filename-first**: `server/nexo/parse-filename.ts` + `server/nexo/disciplinas.ts` (léxico real do escritório) parseiam código, revisão, tipo (memorial/capa/separatriz/prancha/volume), disciplinas (multi) e folha **direto do nome/pasta** — fato objetivo primeiro. `classifyDocuments` usa o parser como autoritativo e só lê o conteúdo do PDF para IDENTIDADE (obra/órgão/município) + páginas. Orçamento = fora de escopo (nem lê). **Calibrado nos 4 projetos reais (640 PDFs)**: código 98%, revisão 87%, disciplina 98%; capa/separatriz que antes eram 0% agora corretas. Rota `app/api/nexo/classify` (flag+auth, aceita relPaths de upload de pasta). Card "Dossiê detectado" na UI afirma os fatos.
  - Ajuste: disciplinas do NOME são autoritativas; pasta só como fallback (evita o volume `his_inc_spd` contaminar uma prancha que é só `his`).
- [x] **Dossiê do Projeto** (`modules/nexo/types.ts`) — `NexoDossieDraft` + `NexoFileClassification` em uso pelo intake.
- [x] **Estrutura do projeto no Dossiê**: `classifyFilenames` (só nomes, sem ler PDF) + rota `app/api/nexo/structure` agrupam por **volume** (disciplinas + contagem capas/separatrizes/pranchas/memoriais). UI ganhou **upload de pasta** (webkitdirectory → manda nomes+relPaths, instantâneo p/ 600+ arquivos) + visão "Estrutura do projeto". Conteúdo do PDF só é lido para o **memorial** (identidade); pranchas/capas ficam filename-only (rápido). Validado no 040-26 (143 arquivos, 10 volumes corretos).
- [x] **Ferramentas headless de geração** (subagent + verificado/testado):
  - `server/nexo/tools/generate-separatrizes.ts` — `generateSeparatrizes()` (ODT+PDF+ZIP, Buffers). Testado: ODT real gerado.
  - `server/nexo/tools/generate-covers.ts` — `generateCovers()` (compõe generateOdtBuffer+convertOdtToPdf+JSZip; persistência opcional c/ userEmail explícito, sem auth()).
- [ ] **PRIMÁRIO — leitura de selo das pranchas** (arquitetura decidida via mapa do extract-stamp):
  - **Render do selo é CLIENT-ONLY** — não há render de PDF no servidor (só `getTextContent`). O crop do carimbo usa `canvas`/`toDataURL` (browser). Logo o Nexo renderiza no browser e **reusa a rota `/api/ld/extract-stamp` como está** (ela já faz auth + OpenAI→MiMo + telemetria `flow:"ld-extraction"`).
  - **Isolamento**: NÃO refatorar `ld-workspace.tsx`. O Nexo ganha helper próprio de render (copiar a lógica): pdf.js legacy + worker; `getViewport({scale:2})`; crop normalizado do selo `{x:0.52,y:0.5,width:0.47,height:0.48}` (canto inf. direito); downscale p/ ≤2400px; `toDataURL("image/jpeg",0.92)`; + `textForAi` (texto posicional das regiões do selo, cap 24000). POST por prancha, ~3 concorrentes, timeout 30s.
  - **StampExtraction** devolve: `disciplina, folha, total, numeroFolha ("NN/TT"), arquivo, conteudo, cliente, obra, fase, tituloSecao, confianca`. Daí saem as linhas da LD (folha+descrição) e a identidade da capa (obra/fase/cliente).
  - Ressalva: precisa de OpenAI/MiMo configurado (usuário confirmou que TEM em dev).
  - [x] **Helper de render + OCR** (`modules/nexo/lib/selo-render.ts`): `extractSelosFromFiles(files, onResult)` — render do crop + textForAi + POST /api/ld/extract-stamp por página, ~3 concorrentes, feedback incremental. Espelha o LD (isolado). Typecheck/compila OK.
  - [x] **Painel "Selos das pranchas"** no NexoWorkspace (SelosPanel): botão "Ler pranchas" → tabela folha/descrição/disciplina/confiança. **VALIDADO ao vivo** (usuário testou: 7 folhas EST, descrições + disciplina + confiança alta corretas).
- [x] **Selos → LD** (fecha metade do slice canônico): `server/nexo/build-ld-proposal.ts` (`buildLdProposal(selos)` → ldData+rows ordenadas por folha, identidade do selo+filename) + rota `app/api/nexo/ld` + botão "Gerar LD" no SelosPanel (baixa ODT/PDF). Metade de geração **testada headless** (selos fabricados → LD ODT 245KB, folhas 01→07 ordenadas). Falta o usuário testar o botão fim-a-fim no browser.
- [x] **Título da LD = DECISÃO editável** (ressalva do usuário): o título real varia por projeto ("PROJETO ESTRUTURAL DE CONCRETO - BLOCO B (TOMO X)"), não dá pra derivar. Campo editável no SelosPanel pré-preenchido com o palpite do selo (`tituloSecao`); vira o `sectionTitle` (marcador `{{TITULO_SECAO}}`; o "(TOMO X)" é anexado automático pela mecânica de tomos). Na Fase 2 vira pergunta do chat. Confirmado que o título editado entra no content.xml do ODT.
- [x] **Selos → Capa** (fecha o slice "pranchas → LD + capa"): `server/nexo/build-capa-proposal.ts` (`buildCapaProposal({selos, templateId, tituloCapa?, volume?})` → generalData+pages; órgão/secretaria do template, obra/fase do selo, código/disciplina/revisão do nome; converte volume arábico→romano quando o template pede; mês/ano da data atual) + rota `app/api/nexo/capa` + seletor de prefeitura + "Gerar capa" no SelosPanel (baixa ZIP/ODT/PDF). **Testado headless**: template Chapecó → capa ODT 253KB, órgão/obra/volume(I)/código corretos.
### Achados do teste ao vivo (2026-07-21) + estado

Testando o slice pranchas→LD+capa, apareceram 3 coisas:

1. **[FEITO] Bug "Vol. Vol. I" na capa** — era **bug pré-existente do Gerador de Capas**, não do Nexo: os 3 templates romanos (Chapecó/Floripa/São José) têm o literal "Vol. " no ODT E o `formatVolume(roman)` também adicionava "Vol." → duplicava. Criciúma (numérico) já saía certo. **Corrigido na raiz** (aprovado pelo usuário): `formatVolume` agora devolve o valor CRU (`lib/cover-utils.ts`); o rótulo vem do template. Novo `formatVolumeDisplay(value, format)` para a UI não regredir (usado no resumo do StepCoverGroups). Conserta **os dois módulos**. Validado: ODT sai "Vol. I", sem duplicar. `generatePages` mantém o param `_volumeFormat` (posicional) só por compat.
   - **Reconferir**: gerar uma capa no Gerador de Capas ORIGINAL (`/capas`) pra confirmar que o "Vol. I" ficou certo lá também.

2. **[PARA AMANHÃ] Volume da capa editável** — o volume às vezes é manual e "trocado bastante dentro dos volumes", e **afeta só as capas**. `buildCapaProposal` já aceita `volume?` (arábico). Falta: campo de volume no painel da capa (SelosPanel) + enviar na chamada `/api/nexo/capa`.

3. **[PARCIAL — continuar amanhã] Tomos** — projeto grande precisa dividir em tomos (o Gerador de LD já tinha; não foi trazido — era simplificação do MVP). Nº de tomos é DECISÃO do engenheiro.
   - **FEITO**: `buildLdProposal(selos, numTomos=1)` já divide as folhas com `buildBalancedTomos(total, numTomos)` (lib/ld/ld-rules). Default 1 = compatível.
   - **FALTA**: (a) `buildCapaProposal` setar `tomoQuantity = numTomos` (uma capa por tomo, com "(TOMO 01)"); (b) rotas `/api/nexo/ld` e `/api/nexo/capa` receberem `numTomos` e repassarem; (c) UI: campo "número de tomos" (compartilhado LD+capa) no SelosPanel, enviado nas duas chamadas; (d) smoke-test LD com tomos (folhas divididas em faixas) + capa com N páginas.
- [x] **`createLD`** (`server/nexo/tools/create-ld.ts`): valida (`validateRows`) → `generateOdtBuffer`(ld) → `convertOdtToPdf` → relatório de inconsistências. Recusa se houver blocking (a menos que `enforceValidation:false`). Trata os DOIS tipos `ReviewRow` (ld-generation vs ld-rules) com normalizer. **Testado**: LD ODT real de 244KB. Barrel em `server/nexo/tools/index.ts`.
- [ ] **Conferência leve** (auditoria do caso comum): folhas/código/revisão/disciplina batem entre pranchas, capa e LD — sem depender do memorial.
- [ ] Secundário: `assembleVolume` (`buildRowPdf`, Map<id,ArrayBuffer>) + extrair `buildLocalSuggestions`; `runAudit` completo (CARO, por último) para a auditoria rara contra o memorial.
- [x] Semente de estado compartilhado: `getProjectContextForUser` (id/code/name/client/status) — o Dossiê estende isso.

### Blocos/tomos (pendência refinada)
A estrutura já modela **volumes**. Falta o nível **bloco/tomo** dentro do volume (pastas `arquivos separados/<n>_<disc>/[TOMO N]`) — dá pra derivar do `relPath` que já é capturado. Próximo refinamento do Dossiê.

**Encoding — investigado, sem bug:** o "mojibake" observado ("Básica"→"BÃ¡sica") era artefato do terminal (Windows `python -m json.tool` lendo bytes UTF-8 como cp1252). Confirmado server-side: `extractPdfText` devolve os acentos corretos (á=U+00E1, ú=U+00FA), sem `Ã`/`Â` órfãos. Nada a corrigir — e deliberadamente **não** vamos adicionar um "reparo" de mojibake, que corromperia texto correto. Vigiar se algum PDF real (ToUnicode ruim / escaneado) trouxer mojibake de verdade.

### Fase 1 — Casca do módulo (atrás de flag) ← ATUAL
- [x] Flag `isNexoEnabled()` (`lib/feature-flags.ts`).
- [x] Módulo `modules/nexo` + rota `/nexo`, registrado na UI **como principal** (gated pela flag).
- [ ] Layout do workspace: intake (upload) à esquerda, chat à direita. Sem autonomia ainda — só recebe arquivos e roteia.

### Fase 2 — Agente + confirmação ← EM ANDAMENTO
Decisão de rumo (2026-07-22, com o usuário): o app **não tem infra de tool-calling** (tudo single-shot + parse JSON; DeepSeek nem suporta tools, MiMo sem cliente). Em vez de construir o loop já, faseamos: **base agora, loop depois**. O "cérebro" fica isolado num ponto trocável, então subir pro loop de tool-calling é trocar uma peça, não reescrever.
- [x] **Motor = roteador de intenção (Opção 1)**: 1 chamada de IA por turno em `server/nexo/agent/run-turn.ts` (`runNexoAgentTurn`). Recebe os FATOS determinísticos (via `buildLdProposal`) + prefeituras + conversa; devolve `NexoAgentTurn { reply, proposals }`. Reusa `executeOpenAiResponse` (flow `audit-chat`, gpt-5.5). Parse JSON tolerante; normaliza propostas (mapeia prefeitura→templateId, clampa tomos, defaults do selo). Degrada pro texto puro se o JSON falhar. **A IA nunca gera — só preenche parâmetros.**
- [x] **Checkpoints = cards editáveis** (`modules/nexo/components/NexoChat.tsx`): cada proposta vira card com params + **[Confirmar e gerar] / [Corrigir]**. A geração (irreversível) só dispara no clique, via `postLd`/`postCapa` (`modules/nexo/lib/generate.ts`) → rotas determinísticas. Download inline no card.
- [x] **Padrão afirma-fato/pergunta-decisão**: o prompt injeta os fatos lidos e proíbe re-perguntá-los; só pergunta o que é decisão (prefeitura, título, tomos). Rota `app/api/nexo/agent` guarda: sem selos → pede ler pranchas primeiro.
- [x] Wiring: `NexoWorkspace` eleva os selos lidos (SelosPanel) pro chat; placeholder "Fase 2" trocado pelo `NexoChat`. `tsc`/`eslint`/`next build` verdes.
- [ ] **FALTA validação E2E ao vivo** (precisa OpenAI + auth): conversar → propor → confirmar → baixar; conferir se a IA mapeia a prefeitura certa e respeita os fatos.
- [ ] Futuro (limpeza): flow dedicado `nexo-agent` em `ai-providers` (hoje reusa `audit-chat`).

### Fase 2b — subir pro loop de tool-calling (quando a Fase 3 justificar)
- [ ] Loop de tool-calling OpenAI (estender/burlar `executeOpenAiResponse` p/ `tools` + rodadas da Responses API). Só OpenAI. Troca só o `run-turn.ts`.

### Fase 3 — Caminho encadeado completo
- [ ] upload → propõe **LD + capa** (confirmando) → monta **volume** (regras de `volume-rules`) → **auditoria** automática → devolve ODT/PDF/ZIP + relatório.

### Fase 4 — Endurecimento
- [ ] Corpus de projetos reais (o usuário fornece; guardar em `docs/samples/`).
- [ ] Métricas: acerto da extração, custo/latência, logs de decisão auditáveis.
- [ ] Promoção gradual: assistivo → co-piloto → porta de entrada principal.

## Kill-switch

`NEXT_PUBLIC_NEXO_ENABLED=true` liga o módulo (aparece como principal na home e a rota `/nexo` funciona). Ausente/qualquer-outro-valor = desligado (produção segura por padrão). Definido em `.env.local` para dev.

## Backlog de UI da leitura (anotado e RESOLVIDO em 2026-08-07)

**Os três foram implementados.** O que segue é o registro do que se viu em uso
real e do porquê de cada correção — vale mais do que a lista de tarefas.

Levantado com um projeto de verdade em mãos (`013_26_est_geral.pdf`, 5 folhas).
Nada disso bloqueia o fluxo — são correções de leitura da tela.

### 1. O chip "é o memorial" não se lê como ação — FEITO

`modules/nexo/components/NexoChat.tsx:696`. É um **botão** que troca o papel do
arquivo (prancha ↔ memorial), mas está desenhado como rótulo: 10px, cor
`muted-foreground`, `underline decoration-dotted`. Colado ao chip `NA FILA
PRANCHA`, o anexo mostra dois textos seguidos — um que é estado, outro que é
ação — sem nada distinguindo os dois. Quem lê não sabe se está sendo informado
de que o arquivo É o memorial, ou convidado a torná-lo memorial.

Ponto levantado junto, a confirmar antes de implementar: **"memorial só texto"**.
Pode ser (a) o memorial é sempre um documento de texto, e o convite só deveria
aparecer em PDF sem carimbo; ou (b) o rótulo deveria ser texto puro, sem cara de
link. Perguntar qual antes de mexer.

### 2. A faixa de progresso da leitura — FEITO

`modules/nexo/components/NexoWorkspace.tsx:1123-1136`. Hoje é uma linha de texto:
`Lendo os selos — 0 de 5 folhas analisadas`.

**Trocar por uma barra segmentada: um retângulo por prancha.** A referência que o
engenheiro desenhou tem duas escalas — poucos segmentos largos para lotes
pequenos, muitos quadradinhos estreitos para lotes grandes —, então a régua
precisa se adaptar à contagem em vez de ter largura fixa por folha. Um volume
real vai de 5 a 200 folhas.

**O erro sai daqui.** A faixa mostra só o avanço. Folha que falhou ou veio sem
título é assunto do canvas, onde dá para ver QUAL folha e agir sobre ela — e é
para lá que o `${semTitulo} sem título` da linha 1135 tem de migrar. Aviso em
barra de progresso não tem o que se faça a respeito, e a barra some quando a
leitura acaba, levando o aviso junto.

### 3. Identificação da prefeitura: usar o logo, não só o texto — FEITO

O casamento existe e roda em produção — `casarPrefeituraDoCarimbo`
(`server/nexo/agent/normalize.ts:130`) conta o campo `cliente` de todas as
folhas e casa o dominante via `matchPrefeitura` (linha 76). Mas usa **uma
evidência só: o texto**. O brasão está impresso na prancha e não é olhado.

O dado já tem schema pronto: `logoPresente` e `logoOrgao`
(`app/api/nexo/selo-check/route.ts:60-81`). O que falta é que ele só existe na
**conferência de identidade**, que roda depois da montagem e sobre uma amostra de
até 4 folhas. Na leitura inicial não há campo de logo nenhum — `extract-stamp`
não menciona logo em lugar algum. Levar esses dois campos para o `extract-stamp`
e usá-los como segunda evidência no casamento é o caminho, e não custa chamada
nova: entra na mesma leitura de visão que já roda por prancha.

**Duas armadilhas que o desenho tem de respeitar:**

A prancha tem **dois logos** — o da prefeitura e o da PROSUL. `logoOrgao` já foi
escrito para isso: atribui o brasão pelo que está **escrito** nele ou colado a
ele, e devolve `null` quando há brasão sem nome legível, em vez de tentar
reconhecer o desenho. Manter essa regra ao mover o campo; um reconhecedor de
imagem "adivinhando" o brasão é exatamente o erro que a conferência existe para
pegar.

`nomeiaOrgao` (linha 72) exige que o texto diga `prefeitura|municipio|governo`.
**Não afrouxar.** Ela existe porque o endereço do escritório —
`Rua Saldanha Marinho... Centro - Florianópolis - SC` — está impresso nas 71
pranchas de um projeto real, e citar a cidade bastava para casar: um volume de
Criciúma saiu como Florianópolis. Coberto por `scripts/test-nexo-agent.ts:88`.

**Antes de mexer, instrumentar.** Quando o slot `templateId` é perguntado, hoje
não se sabe qual dos três casos ocorreu: `cliente` ausente em todas as folhas,
`plausibleCount === 0` (não casou nada), ou `plausibleCount > 1` (variantes da
mesma cidade — esse é decisão humana de propósito e deve continuar perguntando).
Os três pedem correções diferentes; sem saber qual acontece nos projetos deste
escritório, a melhoria é chute.

## Perguntas em aberto
- Persistência do dossiê: memória de sessão vs. gravar em `Projeto` no banco?
- Modelo/custo por sessão (extração de PDF grande + tool-calling encadeado).
- Onde parar a autonomia: emitir final direto nunca, sempre revisão? Definir por tipo de artefato.
