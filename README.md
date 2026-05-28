# NexoDoc

Aplicacao web estilo chat para auditoria documental de projetos de engenharia civil.

O NexoDoc permite anexar PDFs de memoriais, pranchas, capas, listas de documentos e documentos tecnicos, enviar uma solicitacao no chat e receber uma analise documental padronizada usando a OpenAI API no backend.

## Status do projeto

MVP funcional em evolucao para uso interno controlado.

A base atual inclui dashboard autenticado de modulos, chat com upload multiplo de PDFs, auditoria de memorial e volume, analise profunda por texto extraido, comparacao entre documentos, Criador de LDs, resultado estruturado, historico persistente opcional e paineis administrativos.

## Escopo da versao 0.1

O foco da versao 0.1 e:

- pagina unica;
- chat;
- upload multiplo de PDFs;
- envio para backend;
- analise pela OpenAI API;
- resposta padronizada na tela.

Ja incorporado alem do escopo inicial:

- login exclusivo com Google OAuth;
- dashboard inicial autenticado para acesso aos modulos;
- atalhos de teclado globais (`Ctrl+G`, `Ctrl+A`, `Ctrl+L`, `Ctrl+Shift+A`, `?`);
- suporte mobile com sidebar deslizante no workspace de auditoria;
- tooltips contextuais e navegacao por setas nas abas administrativas;
- banco de dados PostgreSQL opcional para historico;
- historico individual de LDs por usuario autenticado, com autosave e rastreabilidade;
- painel administrativo de auditorias, LDs, uso, qualidade e configuracao;
- operacoes em lote no painel de usuarios (selecao multipla, promover, ativar/desativar);
- exportacao do relatorio em Markdown.

Ainda fora do escopo atual:

- armazenamento permanente dos arquivos PDF/ODT/ZIP gerados no historico de LDs;
- exportacao PDF;
- exportacao DOCX;
- OCR para PDFs escaneados.

## Stack definida

- Next.js;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- OpenAI API;
- Vercel (frontend);
- Render (API backend + conversao PDF).

## Conversao ODT para PDF

A Vercel nao suporta binarios nativos como LibreOffice. A conversao de ODT para PDF
e delegada ao Render, que roda LibreOffice headless via Docker.

**Arquitetura:**

```text
Vercel                         Render
------                         ------
Usuario clica "Baixar"
       |
       v
POST /api/capas/generate  -->  (se DOCUMENT_CONVERTER_URL configurada)
ou                              |
POST /api/ld/generate-package   v
       |                  POST /convert (multipart: file=document.odt)
       |                        |
       |                  LibreOffice --headless --convert-to pdf
       |                        |
       |                  <--  application/pdf (binary)
       |
       v
Resposta JSON com base64: { odt, pdf?, zip }
```

**Variavel necessaria na Vercel:**

```bash
DOCUMENT_CONVERTER_URL=https://nexodoc-converter.onrender.com/convert
```

**Variavel opcional para desenvolvimento local:**

```bash
LIBREOFFICE_PATH=C:\Program Files\LibreOffice\program\soffice.exe
```

O conversor tenta nesta ordem:
1. `DOCUMENT_CONVERTER_URL` (Render) -- producao
2. `LIBREOFFICE_PATH` (fallback local) -- apenas desenvolvimento
3. Sem nenhum dos dois, o PDF retorna `null` (ODT e ZIP ainda funcionam)

**Deploy do servico Render:**

O servico fica em `render-service/`. Para fazer deploy:

1. Crie um novo Web Service no Render apontando para o repo
2. Root Directory: `render-service`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Plano: Free para teste, pago para producao (Free desliga apos inatividade)

**Nota sobre Render Free:**
O plano gratuito do Render suspende o servico apos 15 minutos de inatividade.
Na primeira requisicao apos suspensao, a inicializacao demora ~30-60s (cold start).
Para producao, use plano pago para manter o servico sempre ativo.

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
10. [Piloto controlado da Montagem de LDs](C:/Dev/trabalho/empresa/nexodoc/docs/12-piloto-controlado-ld.md)

## Skills de referencia do projeto

Skills e referencias auxiliares podem ser armazenadas em [project-skills](C:/Dev/trabalho/empresa/nexodoc/project-skills).

Essa pasta nao instala skills automaticamente no Codex. Ela serve para guardar materiais que podem orientar a evolucao do NexoDoc.

## Variaveis de ambiente

Crie um arquivo `.env.local` a partir de `.env.example`:

```bash
OPENAI_API_KEY=sua_chave_aqui
AUTH_SECRET=gere_um_segredo_forte
AUTH_GOOGLE_ID=client_id_do_google
AUTH_GOOGLE_SECRET=client_secret_do_google
AUTH_TRUST_HOST=true
NEXODOC_ADMIN_EMAILS=admin@empresa.com
OPENAI_MODEL=gpt-5.4-mini
NEXODOC_LD_OPENAI_MODEL=gpt-5.4
MIMO_API_KEY=
MIMO_MODEL=mimo-v2.5
OPENAI_VALIDATION_MODEL=
OPENAI_STANDARD_MODEL=gpt-5.4-mini
OPENAI_STANDARD_VALIDATION_MODEL=gpt-5.4-mini
OPENAI_DEEP_MODEL=gpt-5.4
OPENAI_DEEP_VALIDATION_MODEL=gpt-5.4
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

As chaves devem ficar apenas no backend e nunca devem ser expostas no frontend.

## Login com Google

O acesso ao painel e aos workspaces exige autenticacao e a tela `/login` oferece somente
o provedor Google. Para configurar o OAuth:

1. Gere `AUTH_SECRET` no terminal com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
2. No Google Cloud Console, crie um cliente OAuth do tipo Web application.
3. Cadastre `http://localhost:3000/api/auth/callback/google` para desenvolvimento.
4. Cadastre `https://SEU-DOMINIO/api/auth/callback/google` para producao.
5. Defina `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` e `AUTH_SECRET` no ambiente de deploy.

Para separar perfis, defina `NEXODOC_ADMIN_EMAILS` no frontend com os e-mails
Google que podem abrir os paineis administrativos. Os demais usuarios continuam
autenticados como usuarios comuns:

```bash
NEXODOC_ADMIN_EMAILS=voce@empresa.com,outro.admin@empresa.com
```

Quando frontend e backend forem publicados separadamente usando
`NEXT_PUBLIC_API_URL`, o login protege o workspace do frontend. As APIs remotas no
Render continuam usando a protecao operacional propria do backend; para
autorizacao por usuario nelas sera necessario encaminhar e validar uma credencial
entre os dois servicos.

Os provedores e modelos de IA sao resolvidos somente no backend, em um ponto central. A separacao efetiva e:

| Fluxo | Provedor | Variavel de modelo | Chave necessaria |
| --- | --- | --- | --- |
| Auditoria padrao | OpenAI | `OPENAI_STANDARD_MODEL` | `OPENAI_API_KEY` |
| Auditoria profunda | OpenAI | `OPENAI_DEEP_MODEL` | `OPENAI_API_KEY` |
| Validacao da auditoria | OpenAI | `OPENAI_STANDARD_VALIDATION_MODEL` / `OPENAI_DEEP_VALIDATION_MODEL` | `OPENAI_API_KEY` |
| Chat pos-auditoria | OpenAI | `OPENAI_MODEL` | `OPENAI_API_KEY` |
| Criador de LDs, principal | OpenAI | `NEXODOC_LD_OPENAI_MODEL` | `OPENAI_API_KEY` |
| Criador de LDs, fallback | MiMo | `MIMO_MODEL` | `MIMO_API_KEY` |

O app oferece dois niveis de analise: `Padrao`, para rotina com `gpt-5.4-mini` e leitura limitada, e `Profundo`, para revisao final com `gpt-5.4` e leitura ampliada. Em particular, alterar apenas `OPENAI_MODEL` nao altera o modelo da auditoria padrao: configure `OPENAI_STANDARD_MODEL` para esse fluxo.

## Modulos da plataforma

Depois do login, a rota `/` abre o painel de modulos. Os fluxos ativos sao:

```text
/audit  - Conferencia documental (fluxo principal)
/ld     - Montagem de Listas de Documentos
/ld/historico - Historico pessoal de LDs salvas
```

O painel tambem apresenta como futuros os modulos de montagem de capas e
juncao/organizacao de volumes, sem oferecer acoes ainda indisponiveis.

## Criador de LDs

O modulo autenticado de Listas de Documentos fica em:

```text
/ld
```

Ele importa PDFs de pranchas, extrai os campos do selo, permite revisao manual, divide tomos e gera os arquivos finais da LD. As rotas backend sao:

```text
/api/ld/extract-stamp
/api/ld/generate-odt
/api/ld/generate-package
/api/ld/drafts
/api/ld/drafts/[id]
/api/ld/drafts/[id]/duplicate
```

A extracao visual tenta `NEXODOC_LD_OPENAI_MODEL` primeiro e utiliza `MIMO_MODEL` como fallback quando a chamada principal falha, inclusive quando OpenAI retorna quota/billing. `MIMO_API_KEY` e `MIMO_MODEL` ficam no mesmo ambiente backend das variaveis OpenAI. A tela da LD identifica quando uma pagina foi lida por OpenAI, quando MiMo foi acionado como fallback ou quando os dois provedores falharam; texto incompleto nao e classificado automaticamente como erro de quota.

Com `DATABASE_URL` configurada, a LD faz autosave associado ao usuario logado. A rota `/ld/historico` permite pesquisar, continuar, duplicar e arquivar rascunhos, alem de consultar os eventos de criacao, atualizacao, geracao, reabertura e arquivamento.

O painel `/admin/config` mostra apenas provedor, modelo, presenca da chave requerida e o ultimo incidente classificado (`quota_billing`, `authentication`, `timeout`, `rate_limit`, `invalid_response` ou configuracao) observado na instancia atual. Sua verificacao de saude e intencionalmente local: nao faz chamadas externas e nao consome tokens.

Em desenvolvimento, variaveis de provedor presentes em `.env.local` sao autoritativas, inclusive quando vazias. Isso impede que uma chave antiga herdada pelo terminal ative silenciosamente OpenAI ou MiMo durante testes locais.

Se uma chave `MIMO_API_KEY` foi compartilhada em conversa, ticket ou qualquer canal fora do backend, considere-a exposta: revogue-a no provedor, gere uma nova chave e substitua-a em `.env.local` e nos ambientes de deploy antes de testar a LD.

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

## Paineis administrativos

Os paineis protegidos ficam em:

```text
/admin
/admin/users
/admin/usage
/admin/audits
/admin/quality
/admin/config
/admin/lds
```

O primeiro acesso administrativo vem das contas Google listadas em
`NEXODOC_ADMIN_EMAILS`. Depois, admins podem promover ou desativar usuarios em
`/admin/users`; o acesso passa a considerar tambem o papel salvo no banco
(`ADMIN` ou `USER`) e o status ativo do usuario. Os paineis consultam o backend
em `/api/admin/*` e exigem tambem o token admin operacional. O painel
`/admin/quality` compara o desempenho de `Padrao` e `Profundo`, alem dos modelos
usados, a partir dos achados classificados manualmente na auditoria.
O painel `/admin/lds` acompanha os rascunhos e geracoes de LD por usuario,
projeto e status, incluindo contagem de pranchas, tomos e eventos registrados.
O painel `/admin` centraliza a visao operacional com metricas em tempo real, e `/admin/users` permite
adicionar usuarios, promover admins, desativar acessos sem apagar historico e
realizar operacoes em lote com selecao multipla.

Variaveis necessarias no Render:

```bash
NEXODOC_ADMIN_TOKEN=uma_senha_forte_para_o_admin
OPENAI_ADMIN_KEY=chave_admin_da_openai
```

`OPENAI_ADMIN_KEY` deve ser uma chave admin da organizacao OpenAI com acesso aos endpoints de Usage/Costs. Ela nao deve ser exposta no frontend.

Na Vercel, mantenha apenas:

```bash
NEXT_PUBLIC_API_URL=https://nexodoc-api.onrender.com
NEXODOC_ADMIN_EMAILS=voce@empresa.com
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

Durante o MVP/piloto interno, `db:push` ainda pode ser usado em ambiente controlado. Antes de producao, substitua esse fluxo por migrations versionadas e use `npm run db:migrate` no deploy.

Em piloto interno, depois que `DATABASE_URL` estiver configurada, rode uma vez:

```bash
npm run db:push
```

O endpoint `/api/audit` registra o ciclo de auditorias quando `DATABASE_URL` existe, incluindo processamento, conclusao, falha, cancelamento, modelo usado e runtime da analise dentro do relatorio estruturado. Sem banco configurado, a auditoria continua funcionando normalmente, apenas sem historico persistente.

No Criador de LDs, o banco guarda rascunhos por e-mail autenticado, dados
revisados, divisao de tomos, contagem de PDFs processados, nomes dos arquivos
finais gerados e eventos de rastreabilidade. Por privacidade, os nomes e
binarios dos PDFs anexados nao sao persistidos.
Os arquivos finais para download ainda nao sao armazenados permanentemente; se
essa etapa for adotada, deve usar armazenamento protegido apenas para ODT/PDF/MD/ZIP
gerados, nunca para PDFs anexados.

O checklist completo do piloto, a matriz de ambientes e o roadmap de storage protegido ficam em [docs/12-piloto-controlado-ld.md](C:/Dev/trabalho/empresa/nexodoc/docs/12-piloto-controlado-ld.md).

A prontidao do historico pode ser verificada por:

```text
/api/audits/status
```

Ele informa se `DATABASE_URL` esta configurada, se o banco respondeu e se o historico publico da tela principal esta habilitado.

Auditorias persistidas tambem aceitam avaliacao dos achados. A interface permite marcar achados como corretos, falsos positivos ou com gravidade inadequada, alem de registrar erros ausentes; esse feedback fica associado a auditoria para apoiar benchmark e calibracao do motor.

No painel `/admin/quality`, os indicadores de confirmacao, falsos positivos e
erros perdidos so passam a representar uma comparacao confiavel depois que uma
amostra suficiente de auditorias for revisada. Como ponto de partida, rotule ao
menos 10 auditorias em cada nivel de analise antes de alterar o padrao do produto.

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

Para testar cada provedor isoladamente na extracao de LD sem confundir o fallback:

1. OpenAI: configure `OPENAI_API_KEY` e `NEXODOC_LD_OPENAI_MODEL`, deixe `MIMO_API_KEY` vazio temporariamente, reinicie o servidor e leia uma prancha pequena em `/ld`.
2. MiMo: configure a chave MiMo nova e `MIMO_MODEL`; para forcar o fallback localmente, use uma credencial OpenAI deliberadamente ausente apenas durante esse teste e restaure-a logo depois. A origem da pagina deve indicar `MiMo`.
3. Abra `/admin/config` com o token admin para conferir modelo/chave configurada e a categoria do ultimo erro. Essa tela nao prova conectividade; o teste real de uma prancha consome tokens do provedor chamado.

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
