# NexoDoc

Aplicacao web estilo chat para auditoria documental de projetos de engenharia civil.

O NexoDoc permite anexar PDFs de memoriais, pranchas, capas, listas de documentos e documentos tecnicos, enviar uma solicitacao no chat e receber uma analise documental padronizada usando a OpenAI API no backend.

## Status do projeto

Projeto em fase inicial de organizacao.

Nesta etapa, a base esta documentada antes da implementacao do MVP.

## Escopo da versao 0.1

O foco da versao 0.1 e:

- pagina unica;
- chat;
- upload multiplo de PDFs;
- envio para backend;
- analise pela OpenAI API;
- resposta padronizada na tela.

Fora do escopo da versao 0.1:

- login;
- banco de dados;
- historico persistente;
- exportacao PDF;
- exportacao DOCX.

## Stack definida

- Next.js;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- OpenAI API;
- Vercel.

## Documentacao

A documentacao inicial esta em [docs](C:/Dev/trabalho/empresa/nexodoc/docs).

Ordem sugerida de leitura:

1. [Visao geral](C:/Dev/trabalho/empresa/nexodoc/docs/01-visao-geral.md)
2. [Escopo do MVP](C:/Dev/trabalho/empresa/nexodoc/docs/02-escopo-mvp.md)
3. [Agente auditor](C:/Dev/trabalho/empresa/nexodoc/docs/03-agente-auditor.md)
4. [Arquitetura tecnica](C:/Dev/trabalho/empresa/nexodoc/docs/04-arquitetura-tecnica.md)
5. [Interface UI](C:/Dev/trabalho/empresa/nexodoc/docs/05-interface-ui.md)
6. [Roadmap](C:/Dev/trabalho/empresa/nexodoc/docs/06-roadmap.md)

## Variaveis de ambiente

Quando a implementacao com OpenAI API for criada, o projeto devera usar:

```bash
OPENAI_API_KEY=sua_chave_aqui
```

A chave deve ficar apenas no backend e nunca deve ser exposta no frontend.

## Proximo passo

Implementar o MVP 0.1 com base na documentacao, mantendo o escopo simples e sem funcionalidades fora da versao inicial.

