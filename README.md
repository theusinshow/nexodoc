# NexoDoc

Aplicacao web estilo chat para auditoria documental de projetos de engenharia civil.

O NexoDoc permite anexar PDFs de memoriais, pranchas, capas, listas de documentos e documentos tecnicos, enviar uma solicitacao no chat e receber uma analise documental padronizada usando a OpenAI API no backend.

## Status do projeto

MVP funcional em evolucao para uso interno controlado.

A base atual inclui chat com upload multiplo de PDFs, auditoria de memorial e volume, analise profunda por texto extraido, comparacao entre documentos, resultado estruturado, historico persistente opcional e paineis administrativos.

## Escopo da versao 0.1

O foco da versao 0.1 e:

- pagina unica;
- chat;
- upload multiplo de PDFs;
- envio para backend;
- analise pela OpenAI API;
- resposta padronizada na tela.

Ja incorporado alem do escopo inicial:

- banco de dados PostgreSQL opcional para historico;
- painel administrativo de auditorias, uso e configuracao;
- exportacao do relatorio em Markdown.

Ainda fora do escopo atual:

- login de usuarios;
- exportacao PDF;
- exportacao DOCX;
- OCR para PDFs escaneados.

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
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VALIDATION_MODEL=
NEXT_PUBLIC_API_URL=
NEXODOC_ALLOWED_ORIGINS=
NEXODOC_ADMIN_TOKEN=
OPENAI_ADMIN_KEY=
DATABASE_URL=
NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=false
NEXODOC_MOCK_MODE=false
NEXODOC_ALLOW_CLIENT_DEMO=false
NEXODOC_MOCK_DELAY_MS=3500
NEXODOC_MAX_CHUNKS_PER_FILE=24
NEXODOC_CHUNK_CONCURRENCY=5
NEXODOC_CHUNK_TIMEOUT_MS=120000
NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS=1800
```

A chave deve ficar apenas no backend e nunca deve ser exposta no frontend.

`OPENAI_MODEL` e opcional. Se nao for definido, o backend usa `gpt-5.4-mini`.
`OPENAI_VALIDATION_MODEL` tambem e opcional; quando vazio, a revisao semantica final usa o mesmo modelo principal.

Para deploy dividido, use:

- Vercel para o frontend;
- Render para o backend, rodando este mesmo projeto como Web Service;
- `NEXT_PUBLIC_API_URL` na Vercel apontando para a URL do Render;
- `NEXODOC_ALLOWED_ORIGINS` no Render contendo os dominios da Vercel autorizados a chamar `/api/audit`.

Exemplo:

```bash
NEXT_PUBLIC_API_URL=https://nexodoc-api.onrender.com
NEXODOC_ALLOWED_ORIGINS=https://nexodoc.vercel.app
```

## Painel administrativo

O painel de uso fica em:

```text
/admin/usage
```

Ele consulta o backend em `/api/admin/usage` e exige um token admin.

Variaveis necessarias no Render:

```bash
NEXODOC_ADMIN_TOKEN=uma_senha_forte_para_o_admin
OPENAI_ADMIN_KEY=chave_admin_da_openai
```

`OPENAI_ADMIN_KEY` deve ser uma chave admin da organizacao OpenAI com acesso aos endpoints de Usage/Costs. Ela nao deve ser exposta no frontend.

Na Vercel, mantenha apenas:

```bash
NEXT_PUBLIC_API_URL=https://nexodoc-api.onrender.com
```

## Banco de dados e historico

O historico usa PostgreSQL via Prisma.

Variavel necessaria no Render:

```bash
DATABASE_URL=postgresql://...
```

Recomendacao: criar um banco Neon Postgres e usar a connection string pooled no Render.

Comandos locais:

```bash
npm run db:generate
npm run db:push
```

Em producao, depois que `DATABASE_URL` estiver configurada, rode uma vez:

```bash
npm run db:push
```

O endpoint `/api/audit` registra o ciclo de auditorias quando `DATABASE_URL` existe, incluindo processamento, conclusao, falha, cancelamento, modelo usado e runtime da analise dentro do relatorio estruturado. Sem banco configurado, a auditoria continua funcionando normalmente, apenas sem historico persistente.

A prontidao do historico pode ser verificada por:

```text
/api/audits/status
```

Ele informa se `DATABASE_URL` esta configurada, se o banco respondeu e se o historico publico da tela principal esta habilitado.

Auditorias persistidas tambem aceitam avaliacao dos achados. A interface permite marcar achados como corretos, falsos positivos ou com gravidade inadequada, alem de registrar erros ausentes; esse feedback fica associado a auditoria para apoiar benchmark e calibracao do motor.

A area principal carrega as ultimas auditorias persistidas por `/api/audits/recent` em desenvolvimento. Em producao, habilite explicitamente:

```bash
NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true
```

Use essa opcao apenas em ambiente interno/controlado, porque ela permite que a tela principal leia auditorias recentes salvas.

O historico admin fica em:

```text
/admin/audits
```

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

O controle de demo enviado pelo navegador fica disponivel automaticamente em desenvolvimento. Em producao, ele somente e aceito quando:

```bash
NEXODOC_ALLOW_CLIENT_DEMO=true
```

## Tipos de auditoria

O NexoDoc possui dois fluxos principais:

- **Memorial**: checagem do memorial descritivo em A4, com foco em texto, identificação e reaproveitamento.
- **Volume de projeto**: checagem de capa, separatriz, LDs e pranchas A1/A0, com foco em LD x pranchas, selos, revisões e estrutura do volume.

O frontend envia o tipo selecionado para `/api/audit` pelo campo `auditMode`.

Limites da auditoria profunda podem ser ajustados por ambiente:

```bash
NEXODOC_MAX_CHUNKS_PER_FILE=24
NEXODOC_CHUNK_CONCURRENCY=5
NEXODOC_CHUNK_TIMEOUT_MS=120000
NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS=1800
```

Cada arquivo e analisado em blocos e, quando ha mais de um PDF, uma etapa adicional confronta informacoes entre os documentos. Se a API retornar erro de quota, reduza a quantidade de blocos ou o teto de saida por bloco.

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

Validar a comparacao entre memorial, capa, LD e pranchas com conjuntos reais contendo divergencias conhecidas.
