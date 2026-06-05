# Roadmap para deixar o NexoDoc solido

Este estudo considera o estado atual apos a consolidacao do banco de dados e a criacao da camada de projetos. A regra de produto continua sendo: `/capas`, `/ld`, `/audit` e `/volumes` seguem independentes, com fluxo integrado por projeto apenas quando o usuario quiser.

## Diagnostico atual apos a rodada de consolidacao

O sistema ja tem uma boa base:

- Banco consolidado com projetos, documentos, uploads, artefatos, eventos e uso de IA.
- Registro interno de custo/uso por fluxo em `AiUsageEvent`.
- Configuracao central de modelos em `lib/ai-providers.ts`.
- Fallback OpenAI/MiMo para extracao de selo da LD.
- Historico de auditorias, feedback de qualidade, aprendizados locais e painel admin.
- Modulos independentes com integracao opcional por `project`.
- Executor comum de IA em `lib/ai-runner.ts`.
- Rota principal de auditoria com executor compartilhado e parse isolado em `lib/audit-ai.ts`.
- Persistencia de uploads e artefatos centralizada em `lib/project-files.ts`.
- Login preservando destino dos modulos protegidos por `callbackUrl`.

Os pontos que ainda impedem o software de ficar realmente solido:

- A auditoria principal ja teve a persistencia retirada da rota, mas ainda concentra extracao, heuristicas e consolidacao.
- `AiUsageEvent` registra uso, mas ainda nao representa uma tarefa de IA reprocessavel.
- A memoria/aprendizado ainda e mais forte no modulo de auditoria do que no projeto como um todo.
- UI dos modulos tem densidade e padroes diferentes, especialmente LD e Volumes.
- Projeto ja centraliza artefatos e primeiras proximas acoes, mas ainda precisa virar a mesa de operacao completa do usuario.
- Ainda falta uma camada explicita de agentes com responsabilidades, contratos e metricas.

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

- Status: implementado para OpenAI.
- Centraliza chamadas OpenAI.
- Aplica timeout padrao.
- Registra sucesso e falha em `AiUsageEvent`.
- Classifica falhas por quota, auth, rate limit, timeout, configuracao e modelo indisponivel.
- Cobre Volume, chat pos-auditoria, LD, auditoria principal e teste admin de conectividade.

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

## Blocos executados nesta rodada

### Bloco 1: IA comum

Status: concluido.

- Executor comum OpenAI consolidado.
- Auditoria principal, LD, Volume, chat pos-auditoria e teste admin usando a mesma camada.
- Timeout e logging de uso padronizados.

### Bloco 2: Persistencia operacional

Status: concluido.

- Helper central para criar artefatos e uploads de projeto.
- Rotas de auditoria, capas e relatorio de volumes usando o helper comum.
- Menos duplicacao de `describeStoredFile`, `createDocumentArtifact` e `createProjectUpload`.

### Bloco 3: Fluxos protegidos

Status: concluido.

- Helper de autenticacao com `callbackUrl`.
- Login normaliza callback para evitar redirect externo ou loop em `/login`.
- Modulos protegidos preservam rota e query apos autenticacao.

### Bloco 4: UI operacional dos modulos

Status: concluido na primeira camada.

Objetivo: fazer os quatro plugins parecerem partes do mesmo produto.

- Criar uma barra comum de contexto de projeto. Implementado em Capas e Volumes.
- Exibir claramente modo independente em Capas, Volumes, Auditoria e LD.
- Padronizar estados vazios, carregamento, erro, sucesso e processamento. Parcial, segue como melhoria continua dentro de cada plugin.
- Unificar linguagem visual de status.
- Melhorar LD e Volumes para leitura operacional mais densa e menos dispersa.
- Revisar responsividade dos fluxos principais no browser.

### Bloco 5: Cockpit de projeto

Status: primeira camada concluida.

Objetivo: fazer `/projetos/[id]` virar a tela de trabalho.

- Destacar proximas acoes por modulo. Implementado.
- Mostrar pendencias, ultimos eventos, artefatos recentes e tarefas falhas.
- Criar CTA contextual para auditoria, LD, capas e volumes. Implementado.
- Exibir linha do tempo resumida do projeto.

### Bloco 6: Logica de dominio por plugin

Status: primeira camada concluida.

Objetivo: reduzir acoplamento das rotas e garantir que os plugins registrem suas saidas no banco unificado.

- Auditoria: persistencia de status, arquivos, uploads e relatorio extraida para `lib/audit-persistence.ts`.
- LD: listagem, salvamento, historico, arquivamento, reabertura, duplicacao, eventos e artefatos extraidos para `lib/ld/ld-draft-store.ts`.
- Capas: registro de ODT, PDF e ZIP extraido para `lib/cover-artifacts.ts`.
- Volumes: registro de relatorio, PDFs e ZIP extraido para `lib/volume-artifacts.ts`.
- Volumes: endpoint de build agora persiste PDF unico, pacote ZIP e relatorio quando estiver vinculado a projeto.

## Proximos blocos de implementacao

### Bloco 6.1: Refinamento fino da logica por plugin

Objetivo: reduzir retrabalho e aumentar previsibilidade dentro da experiencia do usuario.

- Auditoria: separar extracao, chunking, validacao e consolidacao da rota principal.
- LD: reconciliar projeto, selo extraido e edicao manual com checklist de divergencias.
- Capas: validar obrigatorios, registrar template e checksums.
- Volumes: persistir estado de montagem para reabrir trabalhos e explicar sugestoes por confianca/justificativa.

### Bloco 7: Tarefa de IA reprocessavel

Objetivo: transformar uso de IA em operacao rastreavel.

- Criar `AiTask` ou evoluir `AiUsageEvent`.
- Registrar status, objeto relacionado, resumo de entrada/saida, erro normalizado e tentativas.
- Permitir retry controlado a partir do admin ou do projeto.
- Relacionar tarefas aos eventos do projeto.

### Bloco 8: Memoria e agentes

Objetivo: fazer o software aprender sem perder controle humano.

- Criar memoria por projeto, cliente, disciplina e modulo.
- Transformar feedback de auditoria em aprendizado reutilizavel.
- Definir contratos dos agentes: entrada, saida, ferramentas permitidas, custo maximo e criterio de sucesso.
- Criar supervisor de qualidade/custo para escolher modelo, fallback e retry.

## Arquitetura recomendada de agentes

### Agente auditor

Responsabilidade: encontrar inconsistencias, lacunas e conflitos entre documentos.

Entradas:

- documentos do projeto;
- tipo de auditoria;
- aprendizados do projeto/cliente;
- regras tecnicas confirmadas.

Saidas:

- achados estruturados;
- evidencias;
- severidade;
- confianca;
- sugestao de acao.

### Agente leitor de LD/selo

Responsabilidade: extrair e reconciliar dados de selos, folhas, tomos e disciplinas.

Entradas:

- PDF ou imagem;
- contexto do projeto;
- dados manuais ja confirmados.

Saidas:

- campos extraidos;
- divergencias;
- confianca por campo;
- motivo de fallback quando existir.

### Agente montador de volumes

Responsabilidade: classificar arquivos, sugerir ordem e validar montagem.

Entradas:

- assets enviados;
- regras de volume;
- historico de montagens do projeto.

Saidas:

- classificacao;
- sugestao de estrutura;
- pendencias;
- justificativa da ordem.

### Agente assistente de projeto

Responsabilidade: orientar proximas acoes e resumir estado do projeto.

Entradas:

- eventos;
- uploads;
- artefatos;
- tarefas de IA;
- pendencias dos modulos.

Saidas:

- resumo executivo;
- proximas acoes;
- alertas;
- atalhos contextuais.

### Agente supervisor

Responsabilidade: governanca de custo, qualidade e retries.

Entradas:

- tarefa solicitada;
- historico de falhas;
- custo acumulado;
- modelo configurado.

Saidas:

- provider/modelo escolhido;
- limite de custo;
- politica de retry;
- decisao de fallback;
- evento administrativo.

## Criterios para fase final e venda controlada

Antes de vender ou pilotar com cliente externo, o NexoDoc precisa cumprir:

- Login e autorizacao funcionando em todos os modulos.
- Banco com backup/restore documentado e testado.
- Projeto centralizando uploads, artefatos, eventos e uso de IA.
- Build, lint, TypeScript e checagem de env passando.
- Browser audit dos fluxos principais sem erros de console.
- Pelo menos 3 conjuntos reais testados por modulo critico.
- Relatorio de falsos positivos/falsos negativos da auditoria.
- Estimativa de custo por fluxo.
- Termos claros sobre limite de responsabilidade e revisao humana.
- Checklist de onboarding de novo cliente/usuario.

## Ordem recomendada daqui para frente

1. UI operacional dos quatro modulos.
2. Cockpit de projeto.
3. Separacao da logica de dominio dos plugins.
4. `AiTask` reprocessavel.
5. Memoria por projeto.
6. Agentes especializados.
7. Piloto controlado com dados reais.
8. Pacote comercial inicial.
