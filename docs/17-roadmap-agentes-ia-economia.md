# Roadmap de agentes de IA e economia de tokens

Este documento analisa o estado atual do NexoDoc para IA e define o caminho para transformar os fluxos atuais em agentes mais inteligentes, rastreaveis e baratos de operar.

## Diagnostico atual

O projeto ja tem uma base boa para evoluir:

- `lib/ai-providers.ts` centraliza modelos, providers e falhas.
- `lib/ai-runner.ts` centraliza chamadas OpenAI com timeout, logging e registro de falhas.
- `AiUsageEvent` registra provider, modelo, fluxo, operacao, tokens, custo estimado, duracao e erro.
- `AiTask` registra a tarefa operacional reprocessavel e se relaciona com eventos de uso por `aiTaskId`.
- Auditoria, chat pos-auditoria, LD, Volume e teste admin ja passam por configuracao central.
- O banco ja tem `Project`, `ProjectDocument`, `ProjectUpload`, `DocumentArtifact`, `ProjectEvent` e `AiUsageEvent`.
- DeepSeek foi criado como placeholder de provider em configuracao, sem ativar execucao real.

Os limites atuais:

- `AiTask` ja existe, mas ainda precisa ser usado por todos os fluxos e aparecer melhor na UI de projeto/admin.
- A auditoria ainda mistura orquestracao, heuristicas, chamada de modelo e consolidacao em uma rota grande.
- O sistema registra uso, mas ainda nao decide automaticamente o melhor modelo por custo, risco e complexidade.
- Nao ha cache semantico/estrutural para evitar reprocessar documentos ou prompts repetidos.
- A memoria ainda e forte em auditoria, mas nao existe uma memoria operacional por projeto usada por todos os agentes.
- O usuario ainda nao ve claramente "o que a IA fez", "quanto custou", "por que escolheu esse modelo" e "o que pode ser reprocessado".

## Principio de arquitetura

Os agentes devem ser uma camada acima dos plugins, nao substitutos dos plugins.

Cada modulo continua independente:

- `/audit`: auditoria documental.
- `/ld`: leitura e montagem de LD.
- `/capas`: geracao de capas.
- `/volumes`: montagem de volumes.
- `/projetos`: cockpit operacional.

Os agentes entram como servicos de decisao, leitura, reconciliacao e sugestao. O usuario continua confirmando saidas importantes.

## Arquitetura alvo

### 1. Provider registry

Objetivo: configurar provedores, modelos, custos, limites e capacidades.

Estado atual:

- OpenAI ativo.
- MiMo como fallback de LD.
- DeepSeek criado como placeholder:
  - `NEXODOC_ENABLE_DEEPSEEK`;
  - `DEEPSEEK_API_KEY`;
  - `DEEPSEEK_MODEL`;
  - `DEEPSEEK_BASE_URL`.

Proximo passo:

- Criar um runner OpenAI-compatible para DeepSeek somente quando o fluxo escolhido estiver explicitamente liberado.
- Definir capacidades por provider: texto, JSON estruturado, visao, baixo custo, alta precisao, contexto longo.
- Definir custo estimado por modelo em tabela configuravel.

### 2. AiTask

Objetivo: transformar uso de IA em tarefa operacional.

Modelo recomendado:

- `id`;
- `projectId`;
- `userId` e `userEmail`;
- `flow`: audit, audit-chat, ld-extraction, volume-analysis, volume-suggestion, project-assistant;
- `agent`: auditor, ld-reader, volume-builder, project-assistant, supervisor;
- `provider`;
- `model`;
- `status`: queued, running, succeeded, failed, canceled, needs-review;
- `priority`;
- `inputHash`;
- `inputSummary`;
- `outputSummary`;
- `relatedType`: audit, ldDraft, documentArtifact, projectUpload, project;
- `relatedId`;
- `attemptCount`;
- `maxAttempts`;
- `lastError`;
- `estimatedCostUsd`;
- `actualCostUsd`;
- `startedAt`, `finishedAt`, `createdAt`, `updatedAt`.

`AiUsageEvent` continua existindo como evento bruto de uso. `AiTask` vira a entidade de negocio.

### 3. Agent runner

Objetivo: executar agentes com contrato fixo.

Cada agente deve ter:

- nome;
- objetivo;
- entradas permitidas;
- saida esperada;
- modelo preferido;
- modelo barato de triagem;
- modelo forte de validacao;
- limite de tokens;
- limite de tentativas;
- criterios de sucesso;
- politica de fallback;
- politica de cache.

## Agentes recomendados

### Agente supervisor

Responsabilidade: decidir qual agente/modelo chamar, quando economizar e quando escalar.

Usa:

- complexidade do documento;
- tamanho em tokens;
- tipo de tarefa;
- historico de falhas;
- custo acumulado;
- confianca da etapa anterior.

Economia:

- usa regras e heuristicas antes de chamar LLM;
- usa modelo barato para triagem;
- chama modelo forte apenas em casos ambiguos, profundos ou de alto risco;
- evita validacao cara quando achados sao simples e possuem evidencia textual forte.

### Agente auditor

Responsabilidade: auditar memoriais, volumes, pranchas e documentos tecnicos.

Fluxo ideal:

1. Extrair texto e metadados sem LLM.
2. Criar inventario barato de identidade: obra, projeto, endereco, disciplina, volume, tomo.
3. Rodar regras deterministicas.
4. Usar modelo barato por bloco apenas nos trechos relevantes.
5. Usar modelo forte para consolidacao global ou divergencias criticas.
6. Validar achados com amostra de evidencias, nao com o documento inteiro.

Economia:

- limitar contexto por categoria;
- deduplicar evidencias antes da validacao;
- chamar validacao somente para achados de media/alta severidade;
- reutilizar fingerprint de PDF e resultado de extracao.

### Agente leitor de LD/selo

Responsabilidade: extrair selo, reconciliar texto/visao e montar linhas de LD.

Fluxo ideal:

1. OCR/texto local primeiro.
2. Heuristicas para folha, arquivo, disciplina e conteudo.
3. Visao somente se o texto estiver incompleto.
4. Fallback MiMo ou outro provider apenas quando OpenAI falhar ou a confianca for baixa.
5. Checklist de divergencias entre projeto, selo e edicao manual.

Economia:

- chamar visao por recorte, nao pela pagina inteira;
- parar no primeiro recorte confiavel;
- guardar tentativa por pagina e recorte;
- reusar resultado se hash da pagina/recorte nao mudou.

### Agente montador de volumes

Responsabilidade: classificar arquivos, sugerir montagem e validar estrutura.

Fluxo ideal:

1. Classificacao local por nome, paginas e sinais textuais.
2. IA barata apenas para itens ambiguos.
3. Sugestao de montagem com JSON pequeno.
4. Validacao por linha/volume, nao por todos os arquivos inteiros.
5. Explicacao curta por confianca e justificativa.

Economia:

- nao enviar binarios para sugestao quando metadados bastam;
- enviar resumo de assets, nao conteudo completo;
- usar DeepSeek como candidato futuro para sugestoes textuais baratas;
- usar modelo forte apenas para validacao final de alto risco.

### Agente assistente de projeto

Responsabilidade: resumir estado do projeto e sugerir proximas acoes.

Fluxo ideal:

1. Ler `ProjectEvent`, `DocumentArtifact`, `ProjectUpload`, auditorias e LDs.
2. Gerar resumo executivo curto.
3. Sugerir pendencias: falta LD, falta capa, auditoria sem resposta, volume sem pacote final.
4. Nunca reprocessar documentos sem acao explicita do usuario.

Economia:

- usar somente dados do banco;
- limitar resumo a eventos recentes e pendencias;
- cachear resumo por `project.updatedAt`;
- usar modelo barato ou ate template deterministico quando possivel.

### Agente de memoria

Responsabilidade: consolidar aprendizado reutilizavel.

Fluxo ideal:

1. Capturar feedback confirmado.
2. Classificar aprendizado por cliente, projeto, disciplina, modulo e tipo de documento.
3. Gerar memoria curta e auditavel.
4. Injetar apenas memorias relevantes no proximo prompt.

Economia:

- memorias devem ser pequenas;
- usar ranking por relevancia antes de entrar no prompt;
- remover memorias duplicadas ou pouco confiaveis.

## Politica de economia de tokens

### Regra 1: LLM e ultima etapa, nao primeira

Antes de chamar modelo:

- validar input;
- extrair texto;
- calcular hashes;
- usar regex/regras;
- consultar banco;
- consultar cache.

### Regra 2: modelo por dificuldade

Proposta de tiers:

- Tier 0: sem IA, apenas regra/local.
- Tier 1: modelo barato para triagem, classificacao, resumo e sugestao.
- Tier 2: modelo medio para extracao estruturada e analise por bloco.
- Tier 3: modelo forte para consolidacao, auditoria profunda e validacao critica.

DeepSeek entra inicialmente como candidato de Tier 1/Tier 2 textual, nunca como substituto automatico de validacao critica sem piloto.

### Regra 3: contexto minimo

Cada agente recebe:

- objetivo;
- dados relevantes;
- exemplos compactos;
- formato de saida;
- limite de decisao.

Nao recebe:

- documento inteiro quando so precisa de metadados;
- historico completo quando so precisa dos ultimos eventos;
- prompts longos duplicados em todas as chamadas;
- anexos repetidos sem hash/cache.

### Regra 4: cache por hash

Criar cache por:

- hash de arquivo;
- hash de pagina/recorte;
- hash de prompt normalizado;
- modelo;
- versao do agente;
- tipo de operacao.

Se o mesmo input voltar, reutilizar resposta ou pedir confirmacao antes de gastar tokens.

### Regra 5: validacao seletiva

Validar com modelo forte somente:

- achados de alto impacto;
- divergencias entre documentos;
- baixa confianca;
- erro que pode gerar retrabalho caro;
- fluxo marcado como "auditoria profunda".

## DeepSeek placeholder

Status atual: criado como placeholder configuravel.

Variaveis:

- `NEXODOC_ENABLE_DEEPSEEK=false`;
- `DEEPSEEK_API_KEY=`;
- `DEEPSEEK_MODEL=deepseek-chat`;
- `DEEPSEEK_BASE_URL=https://api.deepseek.com`.

Onde aparece:

- `lib/ai-providers.ts`;
- `lib/ai-usage.ts`;
- `/api/admin/config`;
- `.env.example`.

O que ainda falta para ativar:

- criar runner DeepSeek/OpenAI-compatible;
- decidir fluxos permitidos;
- criar teste admin que nao consuma alto volume;
- cadastrar custo estimado por modelo;
- comparar qualidade contra OpenAI em 20 a 50 casos reais;
- liberar por feature flag.

Fluxos candidatos para piloto:

1. resumo de projeto;
2. sugestao de montagem de volume;
3. classificacao textual simples;
4. primeira leitura de achados candidatos;
5. nunca comecar por validacao final de auditoria profunda.

## Roadmap de implementacao

### Bloco A: base operacional de agentes

Status: primeira camada implementada.

- Criada tabela `AiTask`.
- Criado `lib/ai/tasks.ts` para criar, iniciar, concluir, falhar e cancelar tarefa.
- Criado campo `AiUsageEvent.aiTaskId` para relacionar uso real com tarefa operacional sem quebrar o `taskId` legado usado por auditorias.
- `lib/ai-runner.ts` consegue criar/iniciar/concluir/falhar `AiTask` quando recebe contexto de agente.
- `/api/admin/usage` retorna tarefas recentes em `internalUsage.aiTasks`.

Pendencias:

- Exibir tarefas recentes na tela admin.
- Exibir tarefas relacionadas no cockpit do projeto.
- Implementar retry/reprocessamento controlado.
- Passar `agent`, `projectId`, `relatedType` e `relatedId` nos fluxos principais.

### Bloco B: roteador de modelo

- Criar `lib/ai/model-router.ts`.
- Decidir provider/modelo por fluxo, risco, custo e complexidade.
- Aplicar feature flags por provider.
- Impedir DeepSeek em fluxos nao autorizados.

### Bloco C: cache e fingerprints

- Criar `AiCacheEntry`.
- Cachear extracao de PDF, pagina, recorte e resposta estruturada.
- Invalidar por versao do agente e hash do input.
- Mostrar quando resposta veio de cache.

### Bloco D: agentes especializados

- Extrair agente auditor.
- Extrair agente leitor de LD.
- Extrair agente montador de volumes.
- Criar agente assistente de projeto.
- Criar agente de memoria.

### Bloco E: economia e observabilidade

- Definir budget por projeto, usuario e fluxo.
- Criar alertas de custo.
- Mostrar custo estimado antes de auditoria profunda.
- Criar painel de qualidade por agente/modelo/provider.
- Medir taxa de retry, falha, falso positivo e custo medio por saida util.

### Bloco F: piloto DeepSeek

- Implementar runner em modo feature flag.
- Liberar apenas em tarefas textuais baratas.
- Rodar A/B offline com casos reais.
- Comparar custo, latencia, erro de JSON, qualidade e necessidade de reprocessamento.
- Expandir somente se houver economia real sem perda operacional.

## Metricas de sucesso

- Custo medio por auditoria padrao.
- Custo medio por auditoria profunda.
- Tokens por documento/pagina.
- Percentual de respostas vindas de cache.
- Taxa de falha por provider.
- Taxa de retry.
- Tempo medio por fluxo.
- Falso positivo confirmado.
- Achado faltante confirmado.
- Percentual de tarefas que precisaram de modelo forte.
- Economia estimada por roteamento barato.

## Ordem recomendada

1. Criar `AiTask`.
2. Criar roteador de modelos.
3. Criar cache por hash.
4. Extrair agente auditor da rota atual.
5. Criar assistente de projeto.
6. Melhorar agente leitor de LD com divergencias.
7. Melhorar agente de volumes com justificativa e estado reabrivel.
8. Implementar runner DeepSeek em feature flag.
9. Rodar piloto comparativo.
10. Expor painel de custo/qualidade por agente.
