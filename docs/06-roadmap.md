# NexoDoc - Roadmap

## Estado implementado - maio de 2026

Entregue:

- fluxo principal de chat, upload e auditoria;
- modos `Memorial` e `Volume de projeto`;
- extracao textual por pagina e analise profunda em blocos;
- comparacao cruzada entre documentos;
- resultado estruturado com evidencias textuais e download Markdown;
- historico persistente opcional e paineis administrativos;
- modo demo controlado por configuracao do backend;
- dashboard autenticado de modulos com login Google OAuth;
- workspace de montagem de LDs com extracao visual, revisao assistida e geracao ODT/PDF;
- painel administrativo completo com metricas, usuarios, LDs, auditorias, consumo, qualidade e config;
- atalhos de teclado globais (`Ctrl+G/A/L`, `Ctrl+Shift+A`, `?`);
- suporte mobile com sidebar deslizante no workspace de auditoria;
- animacoes de transicao (sidebar, modal, dropdown) com `prefers-reduced-motion`;
- operacoes em lote no painel de usuarios;
- tooltips contextuais e navegacao WAI-ARIA nas abas administrativas;
- skip-to-content para acessibilidade por teclado;
- skeleton de carregamento nas rotas administrativas.

Pendente:

- validar a comparacao cruzada com conjuntos reais conhecidos;
- OCR e visualizacao de paginas para PDFs escaneados;
- exportacoes PDF e DOCX;
- armazenamento permanente dos PDFs/ODT/ZIP gerados.

## 1. Versao 0.1 - MVP local

Objetivo: validar o fluxo essencial de auditoria documental com PDFs e OpenAI API.

Escopo:

- pagina unica;
- interface estilo chat;
- upload multiplo de PDFs;
- lista de arquivos anexados;
- remocao de arquivos antes do envio;
- campo de mensagem;
- botao "Auditar documentos";
- estado de carregamento;
- resposta padronizada do agente;
- botao para copiar resposta;
- API route `/api/audit`;
- prompt fixo do agente auditor;
- integracao com OpenAI API no backend.

Fora do escopo originalmente planejado:

- login;
- banco de dados;
- historico persistente;
- exportacao PDF;
- exportacao DOCX;
- dashboard;
- painel administrativo.

Observacao: banco, historico e painel administrativo foram antecipados durante a evolucao do MVP.

## 2. Versao 0.2 - Refinamento de uso (entregue em grande parte)

Objetivo: melhorar a experiencia de uso sem alterar o escopo central.

Possiveis melhorias:

- mensagens de erro mais claras;
- melhor estado de carregamento;
- validacao visual de arquivos;
- limite de tamanho exibido na interface;
- orientacao curta no estado vazio;
- melhor responsividade;
- refinamento visual dos cards de arquivos;
- ajuste fino da exibicao da resposta.

## 3. Versao 0.3 - Deploy e testes controlados

Objetivo: publicar o NexoDoc e testar com poucos usuarios ou colegas.

Possiveis entregas:

- deploy na Vercel;
- configuracao de variaveis de ambiente;
- teste com PDFs reais;
- ajustes de limite de upload;
- monitoramento inicial de erros;
- revisao de custos da OpenAI API;
- coleta de feedback qualitativo.

## 4. Versao 0.4 - Robustez operacional (em andamento)

Objetivo: tornar o MVP mais estavel para uso recorrente, ainda sem transformar em sistema completo.

Possiveis entregas:

- melhor tratamento de PDFs grandes;
- retorno mais resiliente em caso de falha da API;
- padronizacao adicional da resposta;
- logs tecnicos sem dados sensiveis;
- orientacoes mais claras para conjuntos com baixa qualidade visual;
- ajustes no prompt do agente auditor com base em testes reais.
- validar comparacao `memorial x capa`, `LD x prancha` e `capa x selo`;
- acompanhar auditorias processando, concluidas, falhas e canceladas.

## 5. Versao 1.0 - Uso interno

Objetivo: evoluir o NexoDoc para uso interno mais organizado.

Possiveis entregas:

- usuarios do escritorio;
- historico simples;
- projetos salvos;
- listagem de auditorias anteriores;
- controle basico de uso;
- melhorias de seguranca e privacidade.

## 6. Versao 2.0 - Produto interno avancado

Objetivo: ampliar o NexoDoc para fluxos documentais mais completos.

Possiveis entregas:

- exportacao DOCX;
- exportacao PDF;
- comparacao entre versoes;
- cache de documentos;
- controle de custo por usuario;
- painel administrativo;
- classificacao consolidada por projeto;
- consolidado de multiplas auditorias;
- busca por projeto;
- integracao com armazenamento externo.

## 7. Sequencia recomendada

A sequencia recomendada e:

```text
documentacao inicial
MVP local
testes com PDFs reais
refinamento de prompt e interface
deploy controlado
uso interno
funcionalidades avancadas
```

O proximo passo e testar a comparacao entre documentos com conjuntos reais e registrar falsos positivos, falsos negativos, tempo e custo.
