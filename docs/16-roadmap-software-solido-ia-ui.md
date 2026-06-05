# Roadmap para deixar o NexoDoc solido

Este estudo considera o estado atual apos a consolidacao do banco de dados e a criacao da camada de projetos. A regra de produto continua sendo: `/capas`, `/ld`, `/audit` e `/volumes` seguem independentes, com fluxo integrado por projeto apenas quando o usuario quiser.

## Diagnostico atual

O sistema ja tem uma boa base:

- Banco consolidado com projetos, documentos, uploads, artefatos, eventos e uso de IA.
- Registro interno de custo/uso por fluxo em `AiUsageEvent`.
- Configuracao central de modelos em `lib/ai-providers.ts`.
- Fallback OpenAI/MiMo para extracao de selo da LD.
- Historico de auditorias, feedback de qualidade, aprendizados locais e painel admin.
- Modulos independentes com integracao opcional por `project`.

Os pontos que ainda impedem o software de ficar realmente solido:

- Chamadas de IA ainda estao espalhadas entre rotas diferentes.
- Nem todo fluxo registra falha, timeout e contexto operacional do mesmo jeito.
- A auditoria principal concentra muita logica em uma rota grande.
- A memoria/aprendizado ainda e mais forte no modulo de auditoria do que no projeto como um todo.
- UI dos modulos tem densidade e padroes diferentes, especialmente LD e Volumes.
- Projeto ja centraliza artefatos, mas ainda precisa virar a "mesa de operacao" do usuario.

## Roadmap de logica por plugin

### 1. Auditoria documental

Objetivo: tornar a auditoria previsivel, rastreavel e facil de revisar.

- Separar a rota grande em servicos: extracao, identidade, chunks, validacao, consolidacao, persistencia e resposta.
- Padronizar erros de IA, status de execucao, cancelamento e retry.
- Registrar eventos de auditoria no projeto com status intermediario.
- Melhorar follow-up para usar memoria do projeto, nao apenas o relatorio atual.
- Transformar feedback em sinal operacional: falso positivo, severidade errada, achado faltante e regra aprendida.

### 2. Criador de LDs

Objetivo: reduzir retrabalho manual e aumentar confianca da leitura.

- Padronizar leitura textual/visual pelo executor comum de IA.
- Registrar tentativas por pagina, provider, confianca e motivo de fallback.
- Melhorar reconciliacao entre dados do projeto, dados extraidos e edicao manual.
- Criar uma revisao final mais objetiva: campos faltantes, divergencias de codigo, disciplina, folha e tomo.
- Fazer o historico da LD aparecer como artefato operacional dentro do projeto.

### 3. Gerador de Capas

Objetivo: fazer da capa uma saida confiavel e auditavel.

- Validar campos obrigatorios antes da geracao.
- Registrar template usado, tomos gerados, checksums e erros de conversao.
- Reaproveitar dados do projeto/LD de forma mais clara.
- Melhorar estados de erro e pre-visualizacao.

### 4. Organizacao de Volumes

Objetivo: transformar a montagem em fluxo guiado com revisao tecnica.

- Usar executor comum para analise e sugestao de montagem.
- Registrar falhas e sugestoes por projeto.
- Criar uma trilha de validacao: importacao, classificacao, montagem, revisao e exportacao.
- Melhorar explicacao das sugestoes de IA com confianca e justificativa.
- Persistir mais contexto da montagem para reabrir trabalhos.

## Roadmap de UI/UX

### Fase 1: Padrao operacional

- Unificar headers, barras de contexto de projeto, estados vazios, loading, erro e sucesso.
- Criar linguagem comum para status: pendente, processando, revisao, concluido, falhou.
- Garantir que todo modulo mostre claramente se esta vinculado a projeto.

### Fase 2: Projeto como cockpit

- Transformar `/projetos/[id]` em centro de trabalho.
- Mostrar pendencias, ultimos eventos, artefatos, uploads e proximas acoes.
- Criar atalhos contextuais: gerar capa, montar LD, auditar, montar volume.

### Fase 3: Fluxos guiados sem travar os modulos

- Criar um fluxo opcional por projeto.
- Sugerir proxima acao com base no que ja existe no banco.
- Manter entrada direta nos modulos independentes.

## Roadmap de IA e agentes

### Fase 1: Executor comum de IA

- Centralizar chamadas OpenAI.
- Aplicar timeout padrao.
- Registrar sucesso e falha em `AiUsageEvent`.
- Classificar falhas por quota, auth, rate limit, timeout, configuracao e modelo indisponivel.
- Migrar primeiro Volume e chat pos-auditoria; depois LD; por ultimo auditoria principal.

### Fase 2: Tarefas IA por projeto

- Evoluir `AiUsageEvent` ou criar uma tabela `AiTask`.
- Registrar input resumido, output resumido, status, provider, modelo, custo, duracao e objeto relacionado.
- Permitir reprocessar tarefas falhas.

### Fase 3: Memoria do projeto

- Consolidar aprendizados por projeto, cliente, disciplina e tipo de documento.
- Usar feedback de auditoria como aprendizado reutilizavel.
- Fazer LD, Capas e Volumes consultarem contexto do projeto quando fizer sentido.

### Fase 4: Agentes especializados

- Agente auditor: inconsistencias tecnicas e documentais.
- Agente leitor de selo: extracao visual/textual e reconciliacao.
- Agente montador de volume: classificacao, sugestao e validacao.
- Agente assistente de projeto: proximas acoes, pendencias e resumo executivo.
- Agente supervisor: custo, qualidade, fallback e retry.

### Fase 5: Inteligencia operacional

- O software passa a sugerir proximas acoes.
- O projeto mostra pendencias automaticamente.
- O sistema reaproveita dados ja confirmados.
- O painel admin mede qualidade, custo e falhas por fluxo.

## Primeira rodada de implementacao

Implementar agora:

- `lib/ai-runner.ts` como executor comum OpenAI.
- Migrar Volume analise/sugestao para o executor comum.
- Migrar chat pos-auditoria para o executor comum.
- Adicionar timeout geral `NEXODOC_AI_REQUEST_TIMEOUT_MS`.
- Validar com TypeScript, lint, `db:check-env` e build.

Proximas rodadas:

- Migrar extracao da LD para o executor comum.
- Quebrar auditoria principal em servicos menores.
- Refinar UI do cockpit de projeto.
- Criar persistencia de tarefas IA por projeto.
