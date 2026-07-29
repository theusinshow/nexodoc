# NexoDoc - Handoff completo para Claude Code

Gerado em: 2026-07-15  
Workspace local: `C:\Dev\trabalho\empresa\nexodoc`  
Objetivo deste arquivo: permitir continuar o projeto no Claude Code com contexto de produto, arquitetura, subprojetos, plugins/skills, problemas conhecidos e proximas prioridades.

## 1. Resumo executivo

NexoDoc e uma plataforma interna para producao, auditoria e organizacao de documentos tecnicos de engenharia/orcamentos. A ideia central e reduzir retrabalho operacional em documentos como memoriais descritivos, listas de documentos, capas e volumes finais, usando uma mistura de regras deterministicas, extracao de PDF/ODT, IA e uma interface de trabalho controlada.

O produto nao deve ser tratado como um chatbot generico. Ele e um workspace operacional com modulos independentes:

- Auditoria de documentos tecnicos com IA e regras locais.
- Criacao de LDs/listas de documentos.
- Geracao de capas.
- Montagem de volumes em PDF.
- Gestao de projetos e artefatos.
- Administracao de usuarios, uso de IA, qualidade e configuracao.
- Roadmap de agentes de IA e economia de tokens.

O estado atual e funcional, mas ainda em evolucao. O maior risco tecnico esta na complexidade do modulo de auditoria, no custo/confiabilidade das chamadas de IA, na estabilidade da montagem de volumes com PDFs grandes e na necessidade de manter o fluxo integrado como opcional, sem quebrar os modulos standalone.

## 2. Stack e comandos

Stack principal:

- Next.js `16.2.6` com App Router.
- React `19.2.6`.
- TypeScript `5.9.3`.
- Prisma `7.8.0`.
- PostgreSQL via `pg` e `@prisma/adapter-pg`.
- NextAuth v5 beta.
- OpenAI SDK `6.38.0`.
- PDF: `pdf-lib`, `pdfjs-dist`, `react-pdf`, `jszip`.
- UI: CSS/Tailwind 4, componentes locais em `components/ui`, `lucide-react`.
- Drag and drop: `@dnd-kit/*`.

Scripts:

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:backup
npm run db:restore
npm run db:check-env
```

No Windows deste ambiente, prefira comandos ancorados no repo, porque o perfil do PowerShell gera ruido e ja desviou execucoes para `C:\Dev`:

```powershell
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run build"
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run lint"
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && git status --short"
```

Evite `rg` com `|` sem `-e`, porque o PowerShell pode interpretar o pipe antes do comando. Prefira:

```powershell
rg -n -e "padrao1" -e "padrao2" arquivo.ts
```

## 3. Documentos fonte de verdade

Leia estes arquivos antes de mudancas grandes:

- `README.md`: panorama operacional, variaveis, modulos, como rodar, verificacoes.
- `docs/00-indice.md`: indice da documentacao.
- `docs/01-visao-geral.md`: objetivo, problema, fluxo principal e stack inicial.
- `docs/04-arquitetura-tecnica.md`: arquitetura, seguranca, contratos de auditoria e persistencia.
- `docs/17-roadmap-agentes-ia-economia.md`: arquitetura alvo de agentes, AiTask, provider registry, economia de tokens e DeepSeek placeholder.
- `DESIGN.md`: design system escuro do NexoDoc Audit Workspace.
- `PRODUCT.md`: personalidade do produto e principios.
- `docs/database-operations.md`: operacoes de banco.

Ha tambem um arquivo existente `docs/NexoDoc_contexto_principal.md`, mas este handoff foi criado como documento operacional para transferencia de agente.

## 4. Estrutura importante do repo

Rotas principais:

- `app/page.tsx`: entrada/dashboard.
- `app/audit/page.tsx`: APOSENTADA (2026-07-29) — so redireciona para `/nexo`. A auditoria vive no Nexo.
- `app/ld/page.tsx`: criador de LDs.
- `app/ld/historico/page.tsx`: historico de LDs.
- `app/capas/page.tsx`: gerador de capas.
- `app/volumes/page.tsx`: montador de volumes.
- `app/projetos/page.tsx` e `app/projetos/[id]/page.tsx`: projetos e detalhe.
- `app/admin/*`: paineis administrativos.
- `app/login/page.tsx`: login.

APIs importantes:

- `app/api/audit/route.ts`: orquestracao principal da auditoria.
- `app/api/audit/chat/route.ts`: perguntas de follow-up sobre auditoria ja concluida.
- `app/api/audit/[id]/cancel/route.ts`: cancelamento.
- `app/api/audits/*`: status, historico, qualidade, feedback.
- `app/api/ld/*`: geracao, ODT, pacotes, drafts, extracao de selo.
- `app/api/capas/*`: templates e geracao.
- `app/api/volume/*`: analise, sugestao, extracao, relatorio e build.
- `app/api/projects/*`: projetos, documentos e artefatos.
- `app/api/learnings/*`: aprendizados locais.
- `app/api/admin/*`: admin, usuarios, uso, qualidade e config.

Bibliotecas centrais:

- `lib/ai-providers.ts`: registry de providers/modelos, OpenAI e placeholder DeepSeek.
- `lib/ai-runner.ts`: camada de execucao/registro de chamadas de IA.
- `lib/ai/tasks.ts`: AiTask como entidade operacional reprocessavel.
- `lib/audit-ai.ts`: funcoes auxiliares de auditoria com IA.
- `lib/auditor-prompt.ts`: prompt base do auditor.
- `lib/audit-rules.ts`: regras deterministicas de auditoria.
- `lib/cross-document-audit.ts`: analise cruzada entre documentos.
- `lib/audit-learnings.ts`: aprendizados locais persistidos.
- `lib/audit-report.ts` e `lib/audit-persistence.ts`: estrutura e persistencia de resultados.
- `lib/ld/*`: regras e geracao de LD.
- `lib/project-*`: contexto, arquivos e storage de projetos.
- `lib/volume-artifacts.ts`: artefatos do montador de volumes.

Componentes importantes:

- (REMOVIDO em 2026-07-29) `components/chat-window.tsx` era o workspace da `/audit`. A auditoria vive no Nexo: `modules/nexo/components/NexoWorkspace.tsx` e `PalcoDoNexo.tsx`.
- `components/audit-result.tsx`: exibicao de resultado, evidencias e follow-up.
- `components/audit-progress.tsx`: progresso de auditoria.
- `components/ld/*`: workspace de LD.
- `components/projects/*`: console e acoes de projetos.
- `components/layout/*`: shell, headers e secoes.
- `modules/volume-builder/components/*`: montagem de volumes.
- `modules/cover-generator/components/*`: fluxo de capas.

## 5. Subprojetos e modulos funcionais

### 5.1 Auditoria

Entrada: `/nexo` (a `/audit` redireciona) e `app/api/audit/route.ts`.

Responsabilidade:

- Receber documentos, extrair texto e metadados.
- Dividir documentos em chunks.
- Chamar modelos de IA para achados locais e globais.
- Rodar validacao/normalizacao.
- Fazer checks deterministicas quando possivel.
- Persistir resultados.
- Permitir follow-up sem reler os PDFs.

Modos e conceitos:

- Auditoria padrao.
- Revisao completa: deve mapear para `auditMode = volume` e `analysisLevel = deep`.
- Analise por volume.
- Analise profunda.
- Aprendizados locais por escopo (`global`, `memorial`, `volume`), injetados como contexto, nao como evidencia.

Problema recorrente:

- Uma resposta malformada do modelo pode derrubar uma auditoria completa se uma etapa parcial for tratada como fatal.
- A correcao anterior foi usar structured outputs e fallback apenas para `invalid_response` em estagios auxiliares. Erros de auth, quota e config devem continuar fatais.
- Para qualidade de resultado, nao basta prompt: inconsistencias obvias de memorial devem ser capturadas por regras deterministicas antes da validacao do modelo.

Arquivos para mexer primeiro:

- `app/api/audit/route.ts`
- `lib/ai-providers.ts`
- `lib/audit-ai.ts`
- `lib/audit-rules.ts`
- `lib/cross-document-audit.ts`
- `modules/nexo/components/PalcoDoNexo.tsx`
- `components/audit-result.tsx`

### 5.2 LD / Lista de documentos

Entrada: `/ld`, `/ld/historico` e `app/api/ld/*`.

Responsabilidade:

- Criar e armazenar drafts de LD.
- Gerar ODT/PDF/pacotes.
- Extrair selo/carimbo de documentos.
- Integrar com projetos e capas quando fizer sentido.

Arquivos relevantes:

- `components/ld/ld-workspace.tsx`
- `components/ld/ld-history-workspace.tsx`
- `lib/ld/ld-rules.ts`
- `lib/ld/ld-generation.ts`
- `lib/ld/ld-draft-store.ts`
- `app/api/ld/generate-odt/route.ts`
- `app/api/ld/generate-package/route.ts`
- `app/api/ld/extract-stamp/route.ts`

### 5.3 Capas

Entrada: `/capas` e `app/api/capas/*`.

Responsabilidade:

- Gerar capas a partir de templates e dados gerais.
- Trabalhar com grupos de capas e disciplinas.
- Usar quick-picks de disciplina para reduzir digitação.

Arquivos relevantes:

- `modules/cover-generator/components/CoverGeneratorFlow.tsx`
- `modules/cover-generator/components/DisciplineQuickPick.tsx`
- `modules/cover-generator/hooks/useCoverGenerator.ts`
- `modules/cover-generator/constants.ts`
- `templates/capas/*`
- `app/api/capas/generate/route.ts`
- `app/api/capas/templates/route.ts`

Decisao de produto:

- Qualquer integracao com fluxo de projeto deve preservar acesso standalone a `/capas`.

### 5.4 Montador de volumes

Entrada: `/volumes` e `app/api/volume/*`.

Responsabilidade:

- Importar PDFs.
- Classificar paginas e documentos.
- Sugerir montagem.
- Permitir drag/drop, preview, separadores, validacao e exportacao.

Arquivos relevantes:

- `modules/volume-builder/components/volume-builder-page.tsx`
- `modules/volume-builder/components/page-asset-tray-internal.tsx`
- `modules/volume-builder/components/assembly-workspace.tsx`
- `modules/volume-builder/components/assembly-table.tsx`
- `modules/volume-builder/lib/volume/*`
- `modules/volume-builder/lib/pdf/*`
- `modules/volume-builder/lib/ai/*`
- `app/api/volume/analyze/route.ts`
- `app/api/volume/suggest/route.ts`
- `app/api/volume/extract/route.ts`
- `app/api/volume/report/route.ts`
- `app/api/volume/build/route.ts`

Problemas historicos:

- Interface pesada com miniaturas/thumbnail grid ficou instavel e confusa.
- Refatoracao anterior preferiu indice leve de paginas e preview sob demanda.
- Se miniaturas voltarem a ficar ocultas ou lentas, considerar simplificacao estrutural em vez de mais um patch local.
- `app/api/volume/build/route.ts` ja apareceu como arquivo ignorado pelo Git em memoria anterior; se mexer nele, verificar `git status --ignored` e talvez usar `git add -f`.

### 5.5 Projetos e fluxo integrado

Entrada: `/projetos` e `/projetos/[id]`.

Responsabilidade:

- Agregar documentos, artefatos, contexto e acoes por projeto.
- Servir como opcao de workflow integrado.

Decisao importante:

- O fluxo integrado deve ser opcional. Nunca remover ou degradar os acessos standalone:
  - `/capas`
  - `/ld`
  - `/audit`
  - `/volumes`

Ideias como `ProjectDossier`, `mode: "standalone" | "project-flow"` e `/projetos/<id>/fluxo` foram discutidas como direcao, mas nao devem ser assumidas como totalmente implementadas sem verificar o repo.

### 5.6 Admin

Entrada: `/admin`.

Areas:

- Overview.
- Usuarios.
- Uso de IA.
- Auditorias.
- LDs.
- Qualidade.
- Configuracao.

Arquivos:

- `app/admin/*`
- `components/admin/*`
- `app/api/admin/*`
- `lib/access-control.ts`
- `lib/ai-usage.ts`
- `lib/ai-model-config.ts`

## 6. Banco de dados e modelos

Schema: `prisma/schema.prisma`.

Conceitos importantes:

- Usuarios/autenticacao via NextAuth.
- Projetos, documentos e artefatos.
- Auditorias e achados.
- LD drafts.
- Uso de IA (`AiUsageEvent`).
- Trabalho operacional de IA (`AiTask`).
- Configuracoes/admin.

Decisao importante:

- `AiUsageEvent` e log de uso/custo.
- `AiTask` e entidade operacional reprocessavel, com status, retries, sumarios e relacao com objetos de dominio.
- Nao reaproveitar semanticamente `AiUsageEvent.taskId` como FK real. Foi preservado como campo legado; relacao real usa campo separado como `aiTaskId`.

Antes de mexer em Prisma:

```powershell
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run db:generate"
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run build"
```

## 7. IA, providers e economia de tokens

Arquitetura atual:

- Provider principal: OpenAI.
- DeepSeek existe como placeholder/documentacao/config, mas nao deve receber trafego de producao sem implementacao dedicada.
- Configuracao passa por `.env.local` / `.env.example` e admin.
- Roadmap canonico: `docs/17-roadmap-agentes-ia-economia.md`.

Variaveis importantes em `.env.example`:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_STANDARD_MODEL`
- `OPENAI_DEEP_MODEL`
- `OPENAI_VALIDATION_MODEL`
- `NEXODOC_LD_OPENAI_MODEL`
- `NEXODOC_VOLUME_ANALYSIS_MODEL`
- `NEXODOC_VOLUME_SUGGESTION_MODEL`
- `NEXODOC_AI_PROVIDER`
- `NEXODOC_AI_REQUEST_TIMEOUT_MS`
- `NEXODOC_CHUNK_CONCURRENCY`
- `NEXODOC_CHUNK_TIMEOUT_MS`
- `NEXODOC_MAX_CHUNKS_PER_FILE`
- `NEXODOC_ENABLE_DEEPSEEK`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_*_MODEL`
- `NEXODOC_ENABLE_RULE_BASED_AUDIT`
- `NEXODOC_MOCK_MODE`

Principios de IA definidos:

- LLM deve ser ultima etapa quando regras locais resolvem o problema.
- Usar modelo por dificuldade, nao sempre o mais caro.
- Contexto minimo e relevante.
- Cache/fingerprints por hash no roadmap.
- Validacao seletiva para reduzir custo.
- Falhas estreitas de IA devem degradar graciosamente quando nao comprometem a auditoria inteira.

## 8. Plugins, skills e ferramentas locais

### 8.1 Skills do Codex neste repo

Pasta: `.codex/skills`.

Presentes:

- `.codex/skills/frontend-design`
- `.codex/skills/ui-ux-pro-max`

Tambem existe `.codex/instructions.md` e logs em `.codex/logs`.

### 8.2 Skills de projeto

Pasta: `project-skills`.

Estrutura atual:

- `project-skills/audit-agent`
- `project-skills/pdf`
- `project-skills/product`
- `project-skills/ui-ux`
- `project-skills/README.md`

Essas pastas estao praticamente como placeholders (`.gitkeep`) e podem virar skills reais do Claude Code no futuro.

### 8.3 Skills Claude locais fora do repo

O ambiente tambem contem `C:\Dev\Claude-Skills`, com skills como:

- `docx`
- `xlsx`
- `ui-styling`
- `vercel-cli-with-tokens`
- `slack-gif-creator`

Use com cuidado: sao recursos locais do ambiente, nao necessariamente parte versionada do NexoDoc.

### 8.4 Plugins/conectores externos

Neste handoff nao ha dependencia obrigatoria de plugins externos como Google Drive, Gmail, Slack, Teams, Figma etc. Se o Claude Code precisar acessar documentos reais de clientes, Drive/SharePoint/Box podem ser uteis, mas o repo atual opera localmente com upload/arquivos e banco.

## 9. Design e UX

O NexoDoc tem design system escuro e tecnico em `DESIGN.md`.

Direcao visual:

- Fundo escuro, paineis contidos, bordas discretas.
- Teal para acoes primarias e estados OK.
- Salmon/rust para atencao.
- Evitar hero/landing page; o produto e ferramenta operacional.
- Priorizar densidade, leitura rapida, evidencias e clareza para operador.

Principios de UX importantes:

- Auditoria deve mostrar evidencias verificaveis, nao apenas texto conclusivo.
- Quando possivel, oferecer destaque/trecho/pagina/snapshot para o operador validar.
- Estados de loading de auditoria e follow-up devem ser separados.
- Controles de auditoria devem ser por intencao do operador, nao por labels tecnicos confusos.
- Fluxos integrados precisam ser opcionais.

## 10. Problemas conhecidos e armadilhas

### Ambiente Windows/PowerShell

- O perfil do PowerShell imprime ruido, falha em CIM/oh-my-posh e pode afetar contexto.
- Use `cmd /c "cd /d ... && ..."` para validacao confiavel.
- `rg --files` executado no lugar errado pode varrer `C:\Dev` inteiro e bater em `node_modules` ou pastas sem permissao.

### Build e Next.js

- Se aparecer erro de lock/EPERM/EBUSY em `.next`, rerodar antes de concluir que e bug de codigo.
- Warnings de `pdfjs-dist` / tracing/NFT ja apareceram como nao-bloqueadores; confirmar caso voltem.

### Auditoria

- `app/api/audit/route.ts` e grande e sensivel a encoding; preferir patches localizados.
- Nao resolver problemas de qualidade so com prompt se uma regra deterministica simples captura a inconsistencia.
- `invalid_response` de etapa auxiliar pode usar fallback; erro de chave, quota, auth ou config nao deve ser escondido.
- Se a demanda for qualidade de achados, rodar uma auditoria representativa antes de afirmar que melhorou.

### Volumes

- O modulo tem alto risco de regressao visual/interativa por PDFs, thumbnails e drag/drop.
- Se alterar fluxo de paginas, validar `/volumes` e, se possivel, importacao/preview/sugestao/exportacao.

### Git

- O `git status --short` estava limpo na hora deste handoff, mas sempre verificar antes de editar.
- Nao reverter mudancas locais do usuario.
- Verificar arquivos ignorados se mexer em rotas de volume, especialmente `app/api/volume/build/route.ts`.

## 11. Validacao recomendada por tipo de mudanca

Mudanca pequena de UI:

```powershell
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run lint"
```

Mudanca de API, Prisma, IA, auditoria ou volumes:

```powershell
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run build"
```

Mudanca de banco:

```powershell
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run db:generate"
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run build"
```

Mudanca em auditoria de resultado:

- Build.
- Teste manual com documento representativo.
- Conferir se achados obvios aparecem antes dos achados editoriais.
- Conferir se follow-up nao relê PDFs desnecessariamente.

Mudanca em volumes:

- Build.
- Abrir `/volumes`.
- Validar upload/importacao, preview, selecao, sugestao, separadores e exportacao quando possivel.

## 12. Prioridades provaveis para continuar

1. Endurecer auditoria contra falhas parciais de IA sem esconder falhas reais de infraestrutura.
2. Aumentar checks deterministicas para memoriais e conflitos obvios.
3. Melhorar evidencias visuais de auditoria: highlight, pagina, snapshot e link direto.
4. Consolidar AiTask como trilha operacional para execucao/retry/observabilidade.
5. Evoluir provider registry e roteamento de modelos com economia de tokens.
6. Manter o modulo de volumes simples e confiavel antes de adicionar mais automacao.
7. Transformar `project-skills/*` em skills reais para Claude Code se o fluxo migrar definitivamente.
8. Documentar claramente o que e fluxo integrado implementado vs. apenas direcao de produto.

## 13. Prompt inicial sugerido para Claude Code

Use este prompt ao abrir o projeto no Claude Code:

```text
Estou continuando o projeto NexoDoc em C:\Dev\trabalho\empresa\nexodoc.
Antes de alterar codigo, leia docs/CLAUDE_CODE_HANDOFF.md, README.md, docs/00-indice.md, docs/04-arquitetura-tecnica.md e docs/17-roadmap-agentes-ia-economia.md.

Contexto principal: NexoDoc e uma plataforma operacional para auditoria, LDs, capas, volumes e projetos de engenharia/orcamentos. Preserve os modulos standalone (/audit, /ld, /capas, /volumes) mesmo ao evoluir fluxo integrado por projetos.

Ambiente Windows: use comandos ancorados como:
cmd /c "cd /d C:\Dev\trabalho\empresa\nexodoc && npm run build"

Se mexer em auditoria, comece por app/api/audit/route.ts, lib/ai-providers.ts, lib/audit-ai.ts, lib/audit-rules.ts, lib/cross-document-audit.ts e modules/nexo/components/PalcoDoNexo.tsx.
Se mexer em volumes, valide /volumes e cuidado com app/api/volume/build/route.ts possivelmente ignorado pelo Git.
Nao esconda erros reais de auth/quota/config da IA; fallback so para falhas estreitas como invalid_response em etapas auxiliares.
```

## 14. Checklist antes de entregar qualquer proxima mudanca

- Confirmar `git status --short`.
- Ler o arquivo ou modulo antes de editar.
- Fazer patches pequenos em arquivos grandes, especialmente `app/api/audit/route.ts`.
- Rodar pelo menos `npm run lint` ou `npm run build` conforme risco.
- Separar problema real de ruido do ambiente PowerShell/Next lock.
- Relatar claramente o que foi validado e o que nao foi.

