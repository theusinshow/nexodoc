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
8. [Saida estruturada e evidencias](C:/Dev/trabalho/empresa/nexodoc/docs/08-saida-estruturada.md)
9. [Design system](C:/Dev/trabalho/empresa/nexodoc/docs/09-design-system.md)

## Skills de referencia do projeto

Skills e referencias auxiliares podem ser armazenadas em [project-skills](C:/Dev/trabalho/empresa/nexodoc/project-skills).

Essa pasta nao instala skills automaticamente no Codex. Ela serve para guardar materiais que podem orientar a evolucao do NexoDoc.

## Variaveis de ambiente

Crie um arquivo `.env.local` a partir de `.env.example`:

```bash
OPENAI_API_KEY=sua_chave_aqui
OPENAI_MODEL=gpt-5-mini
NEXODOC_MOCK_MODE=false
NEXODOC_MOCK_DELAY_MS=3500
NEXODOC_MEMORIAL_MAX_OUTPUT_TOKENS=768
NEXODOC_VOLUME_MAX_OUTPUT_TOKENS=768
```

A chave deve ficar apenas no backend e nunca deve ser exposta no frontend.

`OPENAI_MODEL` e opcional. Se nao for definido, o backend usa `gpt-5-mini`.

Para usar sempre a mesma chave, gere uma chave de projeto uma unica vez na plataforma da OpenAI, cole em `.env.local` e mantenha esse arquivo local. Ele ja esta no `.gitignore`, entao nao entra no repositorio.

Depois de alterar `.env.local`, reinicie o servidor de desenvolvimento para o Next.js recarregar as variaveis:

```bash
npm run dev
```

Trocar a chave nao corrige erro de quota se a nova chave pertence ao mesmo projeto/conta sem billing ativo. Nesse caso, mantenha a mesma chave e ajuste billing/quota na plataforma da OpenAI.

Para testar a interface sem consumir tokens, use:

```bash
NEXODOC_MOCK_MODE=true
```

Nesse modo, a rota `/api/audit` valida a mensagem e os PDFs, aguarda alguns segundos e retorna uma resposta simulada no formato padrao do agente.

## Tipos de auditoria

O NexoDoc possui dois fluxos principais:

- **Memorial**: checagem do memorial descritivo em A4, com foco em texto, identificação e reaproveitamento.
- **Volume de projeto**: checagem de capa, separatriz, LDs e pranchas A1/A0, com foco em LD x pranchas, selos, revisões e estrutura do volume.

O frontend envia o tipo selecionado para `/api/audit` pelo campo `auditMode`.

Limites de resposta podem ser ajustados por ambiente:

```bash
NEXODOC_MEMORIAL_MAX_OUTPUT_TOKENS=768
NEXODOC_VOLUME_MAX_OUTPUT_TOKENS=768
```

Se a API retornar erro de quota mesmo com billing ativo, reduza esses limites primeiro. Chamadas com PDF podem validar quota considerando o teto de saída solicitado. A rota tenta fallback automatico para respostas menores quando detecta `insufficient_quota`.

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
