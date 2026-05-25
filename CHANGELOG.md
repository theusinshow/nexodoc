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

### Alterado

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
