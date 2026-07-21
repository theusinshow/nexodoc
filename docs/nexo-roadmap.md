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
- [ ] **Ferramentas headless**: cada módulo vira uma função chamável com schema de I/O claro.
  - Reuso: `/api/capas/generate`, `/api/separatrizes/generate`, `app/api/audit/route.ts`, `app/api/volume/suggest` já existem. Falta padronizar a **criação de LD** como função e unificar o formato de entrada/saída.
- [ ] **Dossiê do Projeto** (`modules/nexo/types.ts`) — feito o primeiro rascunho; evoluir conforme as ferramentas.
- [ ] **Intake + extração**: upload → classificação preenche o dossiê. Reuso: `modules/volume-builder/lib/volume/page-classification.ts`, `lib/audit-classify.ts`.
- [ ] Semente de estado compartilhado já existe: `getProjectContextForUser`, decode LD→Capas do `ld-interop`.

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
