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
- Modelo padrao ajustado para `gpt-5-mini`.
- Registro do primeiro teste real com documento de 218 paginas.
- Modo mock para testar a interface sem consumir tokens da OpenAI API.
- Renderizacao estruturada da resposta do agente.
- Auto-scroll para progresso e resultado final.
- Registro da estrategia de evidencias visuais.
- Modos de auditoria rapida e completa no frontend e backend.

### Alterado

- Nenhuma alteracao registrada.

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
