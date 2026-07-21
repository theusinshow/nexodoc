# Nexo — Roadmap do módulo assistente

**Status:** Fase 1 (casca) em construção · desligável por flag `NEXT_PUBLIC_NEXO_ENABLED`
**Objetivo:** carro-chefe do NexoDoc. O usuário solta os PDFs, conversa ("cria as LDs, as capas e junta o volume"), e o software orquestra os módulos existentes e devolve os documentos e PDFs — **sempre confirmando** o que for decisão ou irreversível.

## Princípios (inegociáveis)

1. **Fato determinístico primeiro, IA por último.** A IA entende intenção e preenche parâmetros; os motores determinísticos que já existem geram o documento. A IA nunca "escreve" o documento final.
2. **Afirma fatos, pergunta decisões.** O que o sistema consegue detectar (disciplina, nº de pranchas), ele afirma e pede confirmação — não pergunta do zero. O que é juízo do usuário (juntar volumes? quantas pranchas por tomo?), ele pergunta.
3. **Nada irreversível sem confirmação.** Documento oficial de prefeitura é alto risco. O agente propõe um plano revisável; o usuário aprova; só então emite.
4. **Não altera o conteúdo-fonte.** O Nexo empacota, gera artefatos novos (LD, capa) e audita. Nunca edita as pranchas do usuário.
5. **Kill-switch sempre.** É um módulo isolado. Se der ruim, desliga a flag e os outros módulos seguem intactos.

## O Dossiê do Projeto

Objeto único de estado (`modules/nexo/types.ts`) que o agente constrói ao longo da conversa e que cada ferramenta consome sem redigitar: obra, órgão, código, revisão, fase, disciplinas, arquivos e artefatos gerados. Cada fato carrega origem (`extraido | projeto | usuario | sugerido`) e `confirmado`.

## Fases

### Fase 0 — Fundação (pré-requisito; tem valor mesmo sem chat)
- [x] **Intake + extração** (keystone) — **filename-first**: `server/nexo/parse-filename.ts` + `server/nexo/disciplinas.ts` (léxico real do escritório) parseiam código, revisão, tipo (memorial/capa/separatriz/prancha/volume), disciplinas (multi) e folha **direto do nome/pasta** — fato objetivo primeiro. `classifyDocuments` usa o parser como autoritativo e só lê o conteúdo do PDF para IDENTIDADE (obra/órgão/município) + páginas. Orçamento = fora de escopo (nem lê). **Calibrado nos 4 projetos reais (640 PDFs)**: código 98%, revisão 87%, disciplina 98%; capa/separatriz que antes eram 0% agora corretas. Rota `app/api/nexo/classify` (flag+auth, aceita relPaths de upload de pasta). Card "Dossiê detectado" na UI afirma os fatos.
  - Ajuste: disciplinas do NOME são autoritativas; pasta só como fallback (evita o volume `his_inc_spd` contaminar uma prancha que é só `his`).
- [x] **Dossiê do Projeto** (`modules/nexo/types.ts`) — `NexoDossieDraft` + `NexoFileClassification` em uso pelo intake.
- [ ] **Demais ferramentas headless** — mapeadas por subagents (assinaturas prontas), a implementar como composição fina das funções puras já existentes:
  - `generateCovers` (compõe `generateOdtBuffer` + `convertOdtToPdf` + JSZip; persistência opcional). PURO, baixo risco.
  - `createLD` (compõe `validateRows` de `ld-rules` + `generateOdtBuffer` de `ld-generation` + `convertOdtToPdf`). O gate real `ldBlockers` é UI-only; o núcleo objetivo é `validateRows`.
  - `generateSeparatrizes` (compõe `generateSeparatorOdtBuffer` + `convertOdtToPdf`). PURO.
  - `assembleVolume` (compõe `buildRowPdf` de `assembly-builder`, recebe `Map<id,ArrayBuffer>`). `suggestVolumeAssembly` precisa **extrair** `buildLocalSuggestions` de dentro de `suggest/route.ts` p/ um lib.
  - `runAudit` — CARO: exige extrair ~40 helpers inline de `app/api/audit/route.ts` p/ um lib. Deixar por último (ou por enquanto o Nexo chama a rota existente).
- [x] Semente de estado compartilhado: `getProjectContextForUser` (carrega id/code/name/client/status) — o Dossiê estende isso.

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
