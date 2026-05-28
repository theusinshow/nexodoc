# Changelog

Todas as mudancas relevantes do NexoDoc devem ser documentadas neste arquivo.

O formato segue a ideia de manter secoes por versao, com itens objetivos.

## [Nao lancado]

### Adicionado

- Documentacao inicial do produto.
- Escopo do MVP 0.1.
- Regras do agente auditor documental.
- Direcao inicial de arquitetura tecnica.
- Direcao inicial da interface.
- Roadmap de evolucao.
- Arquivos padrao de organizacao do projeto.
- Scaffold Next.js com TypeScript e Tailwind CSS.
- Componentes iniciais da interface de chat do NexoDoc.
- Upload multiplo de PDFs com validacao inicial no frontend.
- Rota backend `/api/audit` para auditoria documental.
- Prompt fixo do agente auditor.
- Integracao inicial com OpenAI API pelo backend.
- Override de `postcss` para corrigir vulnerabilidade moderada apontada pelo npm audit.
- Modelo padrao ajustado para `gpt-5.4-mini`.
- Registro do primeiro teste real com documento de 218 paginas.
- Modo mock para testar a interface sem consumir tokens da OpenAI API.
- Renderizacao estruturada da resposta do agente.
- Auto-scroll para progresso e resultado final.
- Registro da estrategia de evidencias visuais.
- Modos de auditoria `Memorial` e `Volume` no frontend e backend.
- Achados de incongruencia com documento, pagina provavel, local, evidencia, conflito e acao recomendada.
- Historico em memoria para auditorias da sessao.
- Painel lateral com resumo da auditoria atual.
- Cancelamento de auditoria em andamento.
- Tempo decorrido durante o processamento.
- Visualizacao de relatorio e copias especificas de achados e acoes.
- Documento inicial do design system mantendo o chat como fluxo principal.
- Comparacao cruzada de campos entre documentos e etapa consolidada para `LD x prancha`, `capa x selo` e `memorial x capa`.
- Persistencia do ciclo operacional de auditorias com estados de processamento, conclusao, falha e cancelamento.
- Rota de cancelamento de auditoria persistida.
- Pasta `project-skills/` para armazenar skills e referencias auxiliares do projeto.
- Pasta `.codex/` com instrucoes locais do projeto e area para skills.
- Aplicacao inicial do design system NexoDoc Audit Workspace.
- Painel analitico direito com status, metricas e abas de resumo, achados e relatorio.
- Indicador visual de modo mock em ambiente de desenvolvimento.
- Botao de demonstracao local sem chamada de API.
- Resultado avancado com abas de resumo, achados, evidencias e relatorio.
- Cards de achados com severidade, documento, pagina provavel, evidencia, conflito e acao recomendada.
- Pre-visualizacao esquematica de evidencias para preparar futura marcacao sobre PDF.
- Modelos de solicitacao sugeridos apos anexar PDFs.
- Modo Volume para checar estrutura documental, LD, pranchas, selos e revisoes.
- Prompt especializado de checagem de volume no backend.
- Demo local especifica para checagem de volume.
- Campos opcionais de categoria e referencia comparada nos achados.
- Documento de bateria de testes com cenarios mock, validacoes de API e roteiro de testes reais.
- Modulo autenticado `/ld` para criacao de Listas de Documentos a partir de pranchas PDF.
- Rotas `/api/ld/*` para extracao visual, geracao ODT e pacote final da LD.
- Fallback MiMo `mimo-v2.5` centralizado no backend para extracao dos selos.
- Dashboard autenticado de modulos com acessos a conferencia documental e montagem de LDs.
- Ferramentas de organizacao na revisao da LD: filtros por status, ordenacao, densidade compacta, copia da visao atual e acoes em massa por selecao.
- Preenchimento seguro dos dados da LD a partir do PDF, sem valores mockados de cliente/obra, com leitura do rodape quando disponivel.
- Sugestao automatica de divisao de tomos com alerta para tomos acima de 15 pranchas.
- Historico e autosave de rascunhos de LD por usuario autenticado.
- Checklist obrigatorio antes da geracao dos arquivos finais da LD.
- Modo de triagem rapida na revisao da LD para navegar apenas por pendencias.
- Mapa de tomos no resumo final para conferencia visual dos intervalos antes da geracao.
- Pagina de historico pessoal de LDs com busca, filtros, duplicacao, arquivamento e rastreabilidade de eventos.
- Painel administrativo de LDs com filtros por projeto, status e usuario.
- Hook `use-keyboard-shortcuts` com suporte a Ctrl, Meta, Alt e Shift.
- Modal de atalhos de teclado (`?`) com `Ctrl+G` (dashboard), `Ctrl+A` (auditoria), `Ctrl+L` (LD), `Ctrl+Shift+A` (admin).
- Componente `Tooltip` baseado em Radix UI com `TooltipProvider` global.
- Link skip-to-content no layout raiz para acessibilidade por teclado.
- Skeleton de carregamento (`app/admin/loading.tsx`) para a rota admin.
- Operacoes em lote no painel admin/users: checkboxes de selecao, barra de acoes (tornar admin, ativar, desativar).
- Sidebar mobile no chat-window com toggle (Menu/X), overlay e backdrop com animacao slide.
- Dropdown "Mais" responsivo na Admin Nav com animacao de expandir.
- Animacoes de transicao: sidebar-drawer (220ms slide), modal (200ms scale+fade), dropdown (180ms expand).
- `AdminMetricStrip` com suporte a skeleton durante loading.
- Logo atualizado: teal `#00a693` + detalhe laranja `#DC7858`, fundo transparente.

### Alterado

- Imagens de perfil autenticado do Google passam a ser aceitas pelo componente de imagem do Next.js.
- Tema visual ajustado para dark tecnico com tons de preto, cinza e azul escuro.
- Componentes principais ajustados para geometria reta com `border-radius` zero.
- Fonte externa removida do build local para evitar dependencia de rede.
- Conteudo mock centralizado para reutilizacao no backend e no modo demonstracao do frontend.
- Modelos de solicitacao de Volume e Selo/LD passam a selecionar automaticamente o modo Volume.
- Prompt reforcado para evitar falso negativo em divergencias de municipio, endereco, bairro e codigo.
- Esforco de raciocinio ajustado por modo para equilibrar custo e qualidade da auditoria real.
- Modo demo iniciado pelo navegador passa a exigir permissao explicita em producao.
- Configuracao e documentacao alinhadas aos modos `Memorial` e `Volume` e aos limites da auditoria profunda.
- Cliente Prisma inicializado sob demanda nas rotas do backend.
- Painel de configuracao passa a indicar a chave e o modelo MiMo utilizados pelo Criador de LDs.
- Criador de LDs usa modelo OpenAI proprio configuravel e timeout visual ampliado para suportar o fallback MiMo.
- Configuracao backend de OpenAI e MiMo centralizada por fluxo, com validacao segura no painel admin.
- Extracao de LD informa uso de fallback MiMo e separa falhas de quota, autenticacao, timeout e resposta invalida.
- Erros de texto incompleto na LD deixam de ser tratados implicitamente como falta de quota.
- Conferencia documental movida para `/audit`, preservando o workspace de chat e liberando `/` para o painel inicial.
- Leitura de PDFs da LD passa a processar lotes menores e liberar a interface entre etapas para reduzir travamentos percebidos.
- Avanco da LD passa a ficar bloqueado enquanto a analise completa das pranchas estiver em andamento ou os dados obrigatorios estiverem incompletos.
- Admin Nav refatorada com WAI-ARIA (`role=tab`, `aria-selected`, navegacao por setas).
- SignOutButton compacto com tooltip "Sair da conta".
- Letter-spacing corrigido em botoes com fonte mono (`font-mono`).
- Metricas do admin dashboard mostram `"--"` durante carregamento em vez de `0`.

### Alterado

- Imagens de perfil autenticado do Google passam a ser aceitas pelo componente de imagem do Next.js.
- Tema visual ajustado para dark tecnico com tons de preto, cinza e azul escuro.
- Componentes principais ajustados para geometria reta com `border-radius` zero.
- Fonte externa removida do build local para evitar dependencia de rede.
- Conteudo mock centralizado para reutilizacao no backend e no modo demonstracao do frontend.
- Modelos de solicitacao de Volume e Selo/LD passam a selecionar automaticamente o modo Volume.
- Prompt reforcado para evitar falso negativo em divergencias de municipio, endereco, bairro e codigo.
- Esforco de raciocinio ajustado por modo para equilibrar custo e qualidade da auditoria real.
- Modo demo iniciado pelo navegador passa a exigir permissao explicita em producao.
- Configuracao e documentacao alinhadas aos modos `Memorial` e `Volume` e aos limites da auditoria profunda.
- Cliente Prisma inicializado sob demanda nas rotas do backend.
- Painel de configuracao passa a indicar a chave e o modelo MiMo utilizados pelo Criador de LDs.
- Criador de LDs usa modelo OpenAI proprio configuravel e timeout visual ampliado para suportar o fallback MiMo.
- Configuracao backend de OpenAI e MiMo centralizada por fluxo, com validacao segura no painel admin.
- Extracao de LD informa uso de fallback MiMo e separa falhas de quota, autenticacao, timeout e resposta invalida.
- Erros de texto incompleto na LD deixam de ser tratados implicitamente como falta de quota.
- Conferencia documental movida para `/audit`, preservando o workspace de chat e liberando `/` para o painel inicial.
- Leitura de PDFs da LD passa a processar lotes menores e liberar a interface entre etapas para reduzir travamentos percebidos.
- Avanco da LD passa a ficar bloqueado enquanto a analise completa das pranchas estiver em andamento ou os dados obrigatorios estiverem incompletos.

### Removido

- Nenhuma remocao registrada.

## [0.1.0] - Planejado

### Objetivo

- Criar o primeiro MVP funcional do NexoDoc.

### Escopo planejado

- Pagina unica.
- Chat.
- Upload multiplo de PDFs.
- Envio para backend.
- Integracao com OpenAI API.
- Resposta padronizada do agente auditor.
- Botao para copiar resposta.
