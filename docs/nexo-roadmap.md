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
  - Ressalva: precisa de OpenAI/MiMo configurado; em dev pode não estar (testar com chave real ou mock).
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

### Fase 2 — Agente + confirmação
- [ ] Loop de tool-calling (Claude API) com as ferramentas da Fase 0.
- [ ] Checkpoints estruturados **[Confirmar] / [Corrigir]** (cards, não texto solto).
- [ ] Padrão afirma-fato/pergunta-decisão implementado.

### Fase 3 — Caminho encadeado completo
- [ ] upload → propõe **LD + capa** (confirmando) → monta **volume** (regras de `volume-rules`) → **auditoria** automática → devolve ODT/PDF/ZIP + relatório.

### Fase 4 — Endurecimento
- [ ] Corpus de projetos reais (o usuário fornece; guardar em `docs/samples/`).
- [ ] Métricas: acerto da extração, custo/latência, logs de decisão auditáveis.
- [ ] Promoção gradual: assistivo → co-piloto → porta de entrada principal.

## Kill-switch

`NEXT_PUBLIC_NEXO_ENABLED=true` liga o módulo (aparece como principal na home e a rota `/nexo` funciona). Ausente/qualquer-outro-valor = desligado (produção segura por padrão). Definido em `.env.local` para dev.

## Perguntas em aberto
- Persistência do dossiê: memória de sessão vs. gravar em `Projeto` no banco?
- Modelo/custo por sessão (extração de PDF grande + tool-calling encadeado).
- Onde parar a autonomia: emitir final direto nunca, sempre revisão? Definir por tipo de artefato.
