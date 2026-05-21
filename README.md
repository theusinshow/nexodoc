# NexoDoc

Aplicacao web estilo chat para auditoria documental de projetos de engenharia civil.

O NexoDoc permite anexar PDFs de memoriais, pranchas, capas, listas de documentos e documentos tecnicos, enviar uma solicitacao no chat e receber uma analise documental padronizada usando a OpenAI API no backend.

## Status do projeto

MVP 0.1 em implementacao inicial.

A base atual inclui a pagina unica de chat, upload multiplo de PDFs, rota backend `/api/audit`, prompt fixo do agente auditor e integracao com a OpenAI API pelo servidor.

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
7. [Testes reais](C:/Dev/trabalho/empresa/nexodoc/docs/07-testes-reais.md)

## Variaveis de ambiente

Crie um arquivo `.env.local` a partir de `.env.example`:

```bash
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5-mini
NEXODOC_MOCK_MODE=false
NEXODOC_MOCK_DELAY_MS=3500
```

A chave deve ficar apenas no backend e nunca deve ser exposta no frontend.

`OPENAI_MODEL` e opcional. Se nao for definido, o backend usa `gpt-5-mini`.

Para testar a interface sem consumir tokens, use:

```bash
NEXODOC_MOCK_MODE=true
```

Nesse modo, a rota `/api/audit` valida a mensagem e os PDFs, aguarda alguns segundos e retorna uma resposta simulada no formato padrao do agente.

## Como rodar localmente

Instale as dependencias:

```bash
npm install
```

Rode o servidor de desenvolvimento:

```bash
npm run dev
```

Acesse:

```text
http://localhost:3000
```

## Verificacoes

Comandos usados para validar a base:

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
```

## Proximo passo

Testar a rota `/api/audit` com PDFs reais e uma chave OpenAI configurada em `.env.local`.
