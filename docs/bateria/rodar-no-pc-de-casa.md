# Rodar a bateria de fluxos no PC de casa

Guia para continuar em outra máquina o trabalho da bateria de fluxos esquisitos.

Os três documentos do trabalho:

| Documento | Para quê |
|---|---|
| `docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md` | o desenho: o que é, por que foi feito assim, o catálogo de cenários |
| `docs/superpowers/plans/2026-09-14-bateria-de-fluxos-fundacao.md` | o plano passo a passo: 10 tarefas, com o código de cada uma |
| este arquivo | preparar a máquina e mandar o Claude Code executar o plano |

## 1. Código em dia

```bash
git checkout main
git pull origin main
```

Confira que os documentos chegaram: `ls docs/superpowers/plans/2026-09-14-bateria-de-fluxos-fundacao.md`.

## 2. Node 24

```bash
node -v
```

Precisa ser **v24.x**: os testes rodam TypeScript direto no `node`, sem compilar, e isso só existe a partir do 24. Se vier outra versão, instale o Node 24 LTS em nodejs.org.

## 3. Dependências

```bash
npm ci
npx prisma generate
npx playwright install chromium
```

- `prisma generate`: sem ele, o cliente do banco fica velho e aparecem erros de tipo que não são do código (`auditLearning` não existe, por exemplo).
- `playwright install chromium`: baixa o navegador das jornadas, cerca de 150 MB.

## 4. O `.env.local`

O `.env.local` **não está no git**, e não pode ir para lá: tem a chave da OpenAI, as senhas do banco e o segredo de login.

**Traga o arquivo do PC do trabalho** por um meio seguro, como pendrive ou gerenciador de senhas. Não use e-mail nem chat. Ele fica na raiz do projeto: `nexodoc/.env.local`.

Depois **acrescente uma linha**, a URL do banco da bateria. Ela é igual à `DATABASE_URL`, trocando só o nome do banco de `nexodoc_dev` para `nexodoc_teste`:

```
DATABASE_URL_BATERIA=<a mesma DATABASE_URL, com /nexodoc_dev? trocado por /nexodoc_teste?>
```

Por exemplo, se a sua linha é `DATABASE_URL=postgresql://usuario:senha@host/nexodoc_dev?sslmode=require`, a nova fica `DATABASE_URL_BATERIA=postgresql://usuario:senha@host/nexodoc_teste?sslmode=require`.

A bateria **se recusa a rodar** se essa URL apontar para qualquer banco que não seja `nexodoc_teste`. É de propósito: ela apaga as tabelas a cada rodada.

## 5. Mandar o Claude Code executar

Abra o Claude Code na pasta do projeto e cole:

> Execute o plano `docs/superpowers/plans/2026-09-14-bateria-de-fluxos-fundacao.md` usando a skill superpowers:subagent-driven-development. O desenho está em `docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md`; leia os dois antes de começar. Regras:
> - commit direto na main, um por tarefa, e push ao fim;
> - nunca `git add -A`;
> - defeito claro do produto: conserte e prove;
> - decisão de produto: pare e me pergunte;
> - não gaste token de IA: a bateria usa a IA simulada;
> - antes de dizer que algo funciona, rode o comando e mostre a saída.

**O que esperar:**
- As tarefas 1 a 6 montam a fundação.
- As tarefas 7 a 9 escrevem as primeiras jornadas.
- A tarefa 10 roda tudo e conserta o que ficar vermelho.
- A tarefa 3 cria o banco `nexodoc_teste` com `npm run bateria:criar-banco`, uma vez só.
- Depois de pronto, rodar a bateria inteira é `npm run bateria`.

## 6. Memórias do Claude Code

As memórias que o Claude Code guardou sobre este projeto ficam **só no PC do trabalho**, em `C:\Users\matheus.mendes\.claude\projects\C--Dev-trabalho-empresa-nexodoc\memory\`. Em casa ele começa sem elas.

O plano e o desenho foram escritos para funcionar sem memória. Se quiser levá-las mesmo assim:
1. Copie a pasta `memory` inteira.
2. Abra o Claude Code uma vez na pasta do projeto em casa, para ele criar a pasta dele em `~/.claude/projects/`. O nome da pasta muda com o caminho do projeto na máquina.
3. Cole o conteúdo dentro de `memory/` dessa pasta.

## Problemas conhecidos

| Sintoma | Causa e saída |
|---|---|
| `DATABASE_URL_BATERIA ausente ou não é uma URL` | falta a linha do passo 4 |
| `a bateria só roda no banco nexodoc_teste` | a URL do passo 4 aponta para outro banco; troque o nome do banco |
| `P1002 … advisory lock` na migração | outra migração pendurada no Neon: `npm run db:destravar` |
| `o servidor da bateria não respondeu /api/saude` | abra `scratchpad/bateria/<data-hora>/servidor.log`; costuma ser `.env.local` incompleto |
| `a porta 3100 continua ocupada pelo PID X` | a bateria tentou derrubar quem escuta na 3100 e não conseguiu (processo aberto como administrador, por exemplo); feche-o (`taskkill /PID X /T /F` num terminal de administrador) e rode de novo. Ela recusa subir de propósito: senão testaria o servidor velho |
| `o servidor da bateria saiu antes de responder /api/saude` | o `next dev` morreu na subida; o erro traz o fim do `servidor.log` |
| `Another next dev server is already running` | seu `npm run dev` está disputando a pasta de build; desligue-o e rode a bateria de novo (a tarefa 4 tenta resolver isso com `.next-bateria`) |
| Depois da bateria, o editor ou o `tsc` acusam tipos de rota vindos de `.next-bateria` | o `next dev` da bateria reescreve `next-env.d.ts` (ignorado pelo git) para apontar para `.next-bateria/dev/types`; rodar `npm run dev` (ou `next build`) devolve o arquivo ao `.next`. Não apague `.next-bateria` enquanto ele aponta para lá |
| Jornada vermelha com `X is not a function` no navegador | chunk velho: apague `.next-bateria` e rode de novo |
| Erros de tipo estranhos logo depois do `git pull` | `npx prisma generate` |
| Um teste puro aparece como **apodrecido** | ele nem carrega (import quebrado); a tarefa 10 manda investigar e consertar |

## CI

A bateria inteira (169 testes puros e 18 jornadas) roda no GitHub Actions a cada push na `main` e em todo pull request: `.github/workflows/bateria.yml`. Ficou verde no `ubuntu-latest` na primeira corrida, em 15/09/2026, em cerca de 7 minutos.

### O que o workflow faz

1. `actions/checkout`, `actions/setup-node` com Node 24 e cache do npm (o `package.json` exige `"engines": { "node": ">=24" }`).
2. `npm ci`, `npx prisma generate` e `npx playwright install --with-deps chromium`.
3. Sorteia um `AUTH_SECRET` descartável (mascarado no log).
4. `npm run bateria`, com `DATABASE_URL_BATERIA=postgresql://postgres:postgres@localhost:5432/nexodoc_teste`.
5. Confere que nada ficou escutando na 3100 e que nenhum `next dev` sobreviveu. Esse passo roda sempre, mesmo com a bateria vermelha.
6. Se algo falhou, sobe `scratchpad/bateria/**` como artefato.

Não há segredo nenhum no repositório, e não pode haver: ele é público.

- **O banco** é um container `postgres:17` declarado em `services:`. Ele nasce chamado `nexodoc_teste`, e a guarda só confere o nome. `criar-banco.mjs` não roda no CI.
- **As migrações** vão direto para ele: `prisma.config.ts` só reescreve host do Neon.
- **O seed** é o mesmo de sempre: `prepararBanco()` recria a `org-prosul` e o usuário da bateria sem precisar de `.env.local`.

Push novo na mesma ref cancela a corrida anterior (`concurrency`). O job tem teto de 45 minutos.

### Ler uma corrida vermelha

```bash
gh run list --workflow bateria.yml --limit 5
gh run view <id> --log-failed          # o relatório da bateria está no fim do passo "Bateria"
gh run download <id> -D scratchpad/ci  # o artefato bateria-<id>-<tentativa>
```

Dentro do artefato fica `<data-hora>/`, com duas coisas:
- `servidor.log`: tudo o que o `next dev` escreveu;
- `<id-da-jornada>.png`: a tela no momento da falha, uma por jornada vermelha.

É o mesmo conteúdo da pasta `scratchpad/bateria/` local. Não há segredo ali: o único do job é o `AUTH_SECRET` sorteado, e o servidor não o escreve no log.

Se o passo "Nenhum servidor da bateria ficou de pé" ficar vermelho com a bateria verde, a derrubada do servidor regrediu. Veja a próxima tabela.

### O que muda entre o CI e o PC

| | PC (Windows) | CI (Linux) |
|---|---|---|
| Banco | `nexodoc_teste` no Neon, pela URL do `.env.local` | Postgres 17 local do container, sem SSL, zerado a cada corrida |
| Ambiente | `.env.local` mais o que `ambiente.mjs` força | só o `env:` do workflow mais o que `ambiente.mjs` força. Não há chave da OpenAI, Google nem Resend, e a bateria não precisa delas |
| Derrubar o servidor | `taskkill /PID <shell> /T /F` e depois a porta (`netstat`) | o `next dev` sobe num grupo de processos próprio (`detached: true`). Cai com `SIGTERM` no grupo, 5 s de folga, `SIGKILL` em quem sobrou, e depois a porta (`lsof`; sem ele, `ss` ou `fuser`) |
| Ctrl+C / cancelamento | o console já mata a árvore inteira | o grupo próprio não recebe o sinal do terminal: `rodar.mjs` chama `derrubarServidoresVivos()`, e um `process.on("exit")` manda `SIGKILL` no grupo como última rede |
| Fuso | o da máquina | `TZ=America/Sao_Paulo`, fixado no workflow |
| Idioma do Chromium | o do Windows | o padrão do runner (`en-US`). Nenhuma jornada depende disso hoje |

Nada de tempo foi afrouxado para o CI: as 18 jornadas passaram no runner com as mesmas esperas do PC.
