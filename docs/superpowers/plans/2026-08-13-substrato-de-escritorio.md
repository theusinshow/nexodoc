# Substrato de escritório — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o NexoDoc virar um sistema de escritório — projeto pertence à organização, acesso é obrigatório, e toda auditoria tem endereço — para que a revisão colaborativa de achados tenha onde ser plantada.

**Architecture:** Um portão de acesso único chamado no início de toda rota de API, uma varredura estática que reprova rota sem portão, e a troca do eixo de posse de `ownerEmail` para `organizationId` em três migrations reversíveis, com diagnóstico antes do backfill. A resolução do projeto passa a vir do centro de custo já extraído dos documentos.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL + Prisma, NextAuth, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-13-substrato-de-escritorio-design.md`

> ## Ordem corrigida na execução (13/08/2026)
>
> O plano ordenava Lote 1 (portão) antes dos lotes de migração. **É a ordem
> invertida:** `requireActor` recusa quem não é membro de escritório ativo, e a
> tabela de membros só é preenchida no backfill. Com o portão no lugar e sem a
> PROSUL, toda rota fechada responde 403 — inclusive para quem usava o sistema
> ontem. Foi verificado no banco local: 0 organizações, 0 membros, e
> `/api/projects` recusando todo mundo.
>
> A ordem executada foi **1 → 2 → 3 → (6, 7, 8) → 4 → …**: o escritório e os
> membros primeiro, depois a conversão das rotas restantes, que assim fica
> verificável a cada família em vez de no escuro.
>
> **Restrição de deploy — RESOLVIDA em 14/08.** O plano dizia "dois deploys,
> nesta ordem". Isso era impossível: o `Dockerfile:87` encadeia
> `prisma migrate deploy && npm run start`, e não há momento entre os dois em que
> alguém rode um script. O backfill virou a migration
> `20260814015000_escritorio_passo_2`, e o banco fica consistente ANTES de o
> processo web existir. Não há janela.

## Global Constraints

- **Um escritório:** existe uma organização, a PROSUL. A tabela `Organization` permanece, com uma linha.
- **Papéis já existem, nenhum novo:** `UserRole { ADMIN, USER }` é plataforma; `OrganizationRole { OWNER, ADMIN, MEMBER }` é escritório. Milton e Victor são `MEMBER`.
- **Identidade do projeto:** `code` é o centro de custo (`"099-25"`), `client` é a prefeitura (`"CRICIÚMA"`). `code` não aceita vazio.
- **Núcleo puro** (só `import type`) mora em `lib/` e ganha teste `scripts/test-*.ts` que roda em node cru. Prova de navegador é `scripts/prova-*.mjs` (Playwright) e sai com código 1 quando falha.
- **A rota `app/api/audit/route.ts` não cresce.** Tem 3.849 linhas. Domínio novo nasce em `lib/`.
- **Nenhum passo de migração é irreversível sozinho.** Ensaio em cópia antes de produção; `npm run db:backup` já existe.
- **Autorização precisa do banco; autenticação não.** O portão é função chamada no handler, nunca `middleware.ts`.
- Mensagem de erro ao usuário é em português, sem jargão de banco.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `docker-compose.yml` (criar) | Postgres local que casa com o padrão de `lib/db.ts:17` |
| `lib/access-control.ts` (modificar) | ganha `resolveActor` (puro) e `requireActor` (IO). Já tem `getUserAccess` |
| `lib/actor.ts` (criar) | o tipo `Actor` e `AccessDenied`. Separado para `access-control.ts` não virar dependência de tudo |
| `lib/resolucao-de-projeto.ts` (criar) | puro: dado um código extraído e a lista de projetos, qual projeto é |
| `lib/audit-store.ts` (criar) | a gravação da `Audit` extraída de `app/api/audit/route.ts` |
| `scripts/diagnostico-de-centros-de-custo.ts` (criar) | conta e imprime colisões antes do backfill |
| `scripts/backfill-escritorio.ts` (criar) | aponta projetos para a PROSUL, cria membros |
| `scripts/prova-nenhuma-rota-aberta.mjs` (criar) | varredura estática: toda rota passa pelo portão |
| `scripts/prova-escritorio.mjs` (criar) | dois atores: Victor vê o 063-26; membro leva 404 no escritório fantasma |
| `app/api/organizacao/membros/route.ts` (criar) | convidar e listar quem faz parte da PROSUL |
| `scripts/test-portao-de-acesso.ts` (criar) | o núcleo puro do portão |
| `scripts/test-resolucao-de-projeto.ts` (criar) | o casamento CC→projeto |

---

## Task 1: Postgres local, para o plano ser executável — FEITO

Sem isto nada das tarefas 5 em diante roda, e a migração não é ensaiável.

> **Corrigido na execução (13/08/2026).** O plano previa `docker-compose.yml`.
> Esta máquina não tem Docker, não tem Docker Desktop, não tem serviço Postgres
> e o subsistema WSL não está instalado — qualquer caminho exigia instalar algo
> com privilégio de administrador. O mantenedor escolheu **PostgreSQL nativo**.
> A versão 16 já saiu do winget; foi instalada a 17.

**Files:**
- ~~Create: `docker-compose.yml`~~ — não se aplica
- Create: `.env` (não versionado)
- Modify: `README.md` (seção "Banco local")

**Interfaces:**
- Consumes: nada
- Produces: um banco em `postgresql://nexodoc:nexodoc@localhost:5432/nexodoc`, que é exatamente o padrão já embutido em `lib/db.ts:17`

- [x] **Step 1: Confirmar que `.env` está ignorado**

Run: `git check-ignore -v .env`
Expected: uma linha apontando a regra do `.gitignore`. Se não sair nada, **pare** e adicione `.env` ao `.gitignore` antes de continuar — o próximo passo escreve credenciais nele.
Resultado: `.gitignore:15`.

- [x] **Step 2: Instalar o serviço**

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --exact --source winget --silent `
  --accept-package-agreements --accept-source-agreements
```
Expected: `Instalado com êxito`, e o serviço `postgresql-x64-17` em `Running`.
O superusuário é `postgres`, com senha `postgres`.

- [x] **Step 3: Criar a role e a base**

As credenciais não são escolha — são as que `lib/db.ts:17` já usa por padrão.

```powershell
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$env:PGPASSWORD = "postgres"
& $psql -U postgres -h localhost -c "CREATE ROLE nexodoc LOGIN PASSWORD 'nexodoc' CREATEDB;"
& $psql -U postgres -h localhost -c "CREATE DATABASE nexodoc OWNER nexodoc;"
```

- [x] **Step 4: `.env` e migrations**

`DATABASE_URL="postgresql://nexodoc:nexodoc@localhost:5432/nexodoc"` no `.env`, mais
`NEXODOC_DEV_AUTH=true` (a Task 5 depende), `AUTH_SECRET` gerado, e
`NEXODOC_MOCK_MODE=true` — sem chave da OpenAI aqui, e auditoria de verdade custaria
dinheiro a cada prova.

Run: `npm run db:migrate`
Expected: `All migrations have been successfully applied.`

- [x] **Step 5: Provar que o banco responde**

`node -e` com `import('./lib/db.ts')` **não** serve como prova: falha em
interoperabilidade CJS/ESM ao rodar fora do empacotador do Next, e isso não diz nada
sobre o banco. A prova é o próprio `migrate deploy` ter aplicado, mais:

```powershell
& $psql -U nexodoc -h localhost -d nexodoc -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
& $psql -U nexodoc -h localhost -d nexodoc -tAc "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL;"
```
Expected: 21 tabelas, 11 migrations.

- [x] **Step 6: Documentar no README e commitar**

```bash
git add README.md
git commit -m "dev: postgres local, para as provas de banco terem o que medir"
```

---

## Task 2: O núcleo puro do portão

**Files:**
- Create: `lib/actor.ts`
- Create: `scripts/test-portao-de-acesso.ts`
- Modify: `package.json` (script `test:portao`)

**Interfaces:**
- Consumes: `OrganizationRole` de `@prisma/client` (só como tipo)
- Produces:
  - `type Actor = { userId: string | null; email: string; name: string | null; organizationId: string; orgRole: OrganizationRole; isPlatformAdmin: boolean }`
  - `class AccessDenied extends Error { readonly status: 401 | 403 }`
  - `function resolveActor(input: ResolveActorInput): Actor` — lança `AccessDenied`
  - `type ResolveActorInput = { access: { email: string; isActive: boolean; isAdmin: boolean } | null; member: { userId: string | null; name: string | null; organizationId: string; role: OrganizationRole; status: "ACTIVE" | "INVITED" | "DISABLED" } | null }`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// scripts/test-portao-de-acesso.ts
//
//   node scripts/test-portao-de-acesso.ts   (== npm run test:portao)
//
// O nucleo do portao e puro de proposito: decidir quem entra nao pode depender
// de ter um Postgres de pe, senao a regra so e exercitada em integracao — que e
// justamente onde ninguem escreve o caso chato.
import assert from "node:assert/strict";

import { resolveActor, AccessDenied } from "../lib/actor.ts";

const membroAtivo = {
  userId: "u1",
  name: "Victor",
  organizationId: "org-prosul",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};
const acessoOk = { email: "victor@prosul.com", isActive: true, isAdmin: false };

function recusa(entrada: Parameters<typeof resolveActor>[0], status: 401 | 403) {
  assert.throws(
    () => resolveActor(entrada),
    (err: unknown) => err instanceof AccessDenied && err.status === status,
  );
}

// Sem sessao nao e "proibido", e "nao identificado": 401 manda a UI logar,
// 403 mandaria pedir permissao a alguem. A diferenca importa para o usuario.
recusa({ access: null, member: null }, 401);

// Sessao valida sem vinculo com escritorio nenhum: identificado, sem lugar.
recusa({ access: acessoOk, member: null }, 403);

// Convidado que nunca entrou nao entra por link. Ele so vira ACTIVE no login.
recusa({ access: acessoOk, member: { ...membroAtivo, status: "INVITED" } }, 403);

recusa({ access: acessoOk, member: { ...membroAtivo, status: "DISABLED" } }, 403);

// Conta desativada na plataforma nao entra, mesmo com membro ativo no escritorio:
// as duas checagens sao independentes e a mais restritiva vence.
recusa({ access: { ...acessoOk, isActive: false }, member: membroAtivo }, 403);

const ator = resolveActor({ access: acessoOk, member: membroAtivo });
assert.equal(ator.email, "victor@prosul.com");
assert.equal(ator.organizationId, "org-prosul");
assert.equal(ator.orgRole, "MEMBER");
assert.equal(ator.isPlatformAdmin, false);
assert.equal(ator.userId, "u1");

// Admin de plataforma sem membro em escritorio nenhum continua sem escritorio.
// Ser admin da plataforma nao inventa vinculo — /admin e outra porta.
recusa({ access: { ...acessoOk, isAdmin: true }, member: null }, 403);

console.log("OK  portao de acesso");
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-portao-de-acesso.ts`
Expected: FALHA — `Cannot find module '../lib/actor.ts'`.

- [ ] **Step 3: Implementar o mínimo**

```ts
// lib/actor.ts
/**
 * QUEM ESTA CHAMANDO, e de qual escritorio.
 *
 * Puro de proposito (so `import type`): a regra de quem entra e a coisa que
 * mais precisa de teste e a que menos pode depender de um banco de pe. O IO
 * mora em `access-control.ts`, que monta as duas entradas e chama daqui.
 *
 * As duas entradas sao independentes e as duas podem recusar: a conta pode
 * estar desativada na PLATAFORMA (`access.isActive`) e o vinculo pode estar
 * inativo no ESCRITORIO (`member.status`). A mais restritiva vence.
 */
import type { OrganizationRole } from "@prisma/client";

export type Actor = {
  userId: string | null;
  email: string;
  name: string | null;
  organizationId: string;
  orgRole: OrganizationRole;
  isPlatformAdmin: boolean;
};

export class AccessDenied extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AccessDenied";
  }
}

export type ResolveActorInput = {
  access: { email: string; isActive: boolean; isAdmin: boolean } | null;
  member: {
    userId: string | null;
    name: string | null;
    organizationId: string;
    role: OrganizationRole;
    status: "ACTIVE" | "INVITED" | "DISABLED";
  } | null;
};

export function resolveActor(input: ResolveActorInput): Actor {
  const { access, member } = input;

  /*
   * 401 e 403 dizem coisas diferentes para a interface: o primeiro manda logar,
   * o segundo manda pedir acesso a alguem. Trocar os dois faz a tela oferecer a
   * acao errada, e o usuario roda em circulo.
   */
  if (!access?.email) {
    throw new AccessDenied(401, "Entre para continuar.");
  }

  if (!access.isActive) {
    throw new AccessDenied(403, "Sua conta está desativada.");
  }

  if (!member || member.status !== "ACTIVE") {
    throw new AccessDenied(403, "Você não faz parte de nenhum escritório.");
  }

  return {
    userId: member.userId,
    email: access.email,
    name: member.name,
    organizationId: member.organizationId,
    orgRole: member.role,
    isPlatformAdmin: access.isAdmin,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-portao-de-acesso.ts`
Expected: `OK  portao de acesso`

- [ ] **Step 5: Registrar o script**

Em `package.json`, junto dos outros `test:*`:

```json
"test:portao": "node scripts/test-portao-de-acesso.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/actor.ts scripts/test-portao-de-acesso.ts package.json
git commit -m "portao: quem entra, decidido em nucleo puro"
```

---

## Task 3: O portão com IO, e as três rotas abertas

**Files:**
- Modify: `lib/access-control.ts` (acrescentar ao fim)
- Modify: `app/api/audits/[id]/route.ts`
- Modify: `app/api/projects/route.ts:61-92`
- Modify: `app/api/audit/route.ts` (só o bloco de sessão, ~3205-3330)

**Interfaces:**
- Consumes: `resolveActor`, `AccessDenied`, `Actor` de `lib/actor.ts` (Task 2); `getUserAccess` de `lib/access-control.ts`
- Produces:
  - `async function requireActor(): Promise<Actor>`
  - `function accessDeniedResponse(err: unknown): NextResponse | null` — devolve `null` quando o erro não é `AccessDenied`, para o chamador re-lançar

- [ ] **Step 1: Implementar o portão**

Acrescentar ao fim de `lib/access-control.ts`:

```ts
/**
 * O PORTAO. Toda rota sob `app/api/` comeca por aqui.
 *
 * Nao e `middleware.ts` de proposito: middleware roda em runtime de borda e nao
 * alcanca o Prisma de forma confiavel. O `authorized` de `auth.ts` continua
 * fazendo o que sabe fazer — distinguir logado de deslogado. Quem esta logado
 * pode nao ter escritorio, e essa pergunta so o banco responde.
 */
export async function requireActor(): Promise<Actor> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const access = email ? await getUserAccess(email, session?.user?.name) : null;

  if (!access?.email || !isDatabaseConfigured()) {
    return resolveActor({ access: access ?? null, member: null });
  }

  const member = await getPrisma().organizationMember.findFirst({
    where: { email: access.email },
    select: {
      userId: true,
      name: true,
      organizationId: true,
      role: true,
      status: true,
    },
  });

  return resolveActor({ access, member });
}

/**
 * Traduz a recusa em resposta. Devolve `null` quando o erro NAO e de acesso —
 * engolir excecao de banco aqui faria falha de infraestrutura parecer falta de
 * permissao, e o usuario passaria a tarde pedindo acesso que ja tem.
 */
export function accessDeniedResponse(err: unknown) {
  if (err instanceof AccessDenied) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  return null;
}
```

Acrescentar os imports no topo do arquivo: `NextResponse` de `next/server`, `auth` de `@/auth`, e `resolveActor`, `AccessDenied`, `type Actor` de `@/lib/actor`.

- [ ] **Step 2: Fechar `GET /api/audits/[id]`**

O parecer é do escritório. Em `app/api/audits/[id]/route.ts`, dentro do `try`, antes do `findUnique`:

```ts
  let actor: Actor;
  try {
    actor = await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
```

E o `findUnique` vira `findFirst` com escopo, para que id de outro escritório responda 404 e não 200:

```ts
    const audit = await getPrisma().audit.findFirst({
      where: {
        id,
        OR: [
          { project: { organizationId: actor.organizationId } },
          /*
           * O LEGADO. Auditoria do Nexo anterior a este plano nao tem projeto
           * (`projectId` null), e a Parte D.3 do spec manda mante-la legivel.
           * Escopar so por organizacao a tornaria invisivel para quem a rodou —
           * seria apagar historico pela porta dos fundos.
           *
           * A condicao e estreita de proposito: SEM projeto E de quem pediu.
           * Auditoria orfa de outra pessoa continua fora.
           */
          { projectId: null, userId: actor.userId },
        ],
      },
      select: { status: true, report: true, result: true, error: true },
    });
```

Nota: `Audit.userId` é `onDelete: SetNull`. Auditoria órfã cujo autor foi apagado deixa de ser legível por qualquer um — é aceito, e é o mesmo destino que ela já teria em qualquer escopo que não fosse "todo mundo vê tudo".

- [ ] **Step 3: Fechar `GET /api/projects` — e é aqui que o Victor passa a enxergar**

Em `app/api/projects/route.ts`, `getProjectFilters` troca a assinatura: recebe `organizationId` em vez de `ownerEmail`, e o `where` passa a ser

```ts
  const where: Prisma.ProjectWhereInput = {
    organizationId,
  };
```

Nada mais na função muda. O `GET` chama `requireActor()` e passa `actor.organizationId`.

- [ ] **Step 4: Fechar `POST /api/audit`**

Em `app/api/audit/route.ts`, o bloco de sessão (~3210) troca `const session = await auth()` por `requireActor()`, e o `if (projectId)` de 3311 deixa de guardar a autenticação — ele continua existindo só até a Task 13, que remove o caminho sem projeto.

Substituir o comentário de 3205-3209, que passa a estar errado, por:

```ts
    // Portao antes de tudo: esta rota gastava minutos de modelo sem exigir
    // sessao quando nao vinha `projectId`, e era o caminho que o Nexo usava.
    const actor = await requireActor();
```

- [ ] **Step 5: Provar que as três fecharam**

Run: `npm run build`
Expected: compila. Erro de tipo aqui é o esperado se alguma chamada ficou com a assinatura velha — corrija e rode de novo.

- [ ] **Step 6: Commit**

```bash
git add lib/access-control.ts app/api/audits/ app/api/projects/route.ts app/api/audit/route.ts
git commit -m "portao: as tres rotas que nao perguntavam quem estava chamando"
```

---

## Task 4: A varredura que reprova a quarta rota aberta

**Files:**
- Create: `scripts/prova-nenhuma-rota-aberta.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: o marcador textual `requireActor(` nos arquivos de rota (Task 3)
- Produces: `npm run prova:rotas`

- [ ] **Step 1: Escrever a prova**

```js
// scripts/prova-nenhuma-rota-aberta.mjs
//
//   node scripts/prova-nenhuma-rota-aberta.mjs   (== npm run prova:rotas)
//
// POR QUE UMA VARREDURA, E NAO UM TESTE POR ROTA
//
// Fechar as tres rotas abertas de hoje e o minimo. O que importa e a QUARTA:
// no dia em que alguem criar /api/findings/[id]/assign e esquecer o portao,
// nenhum teste existente falha — porque ninguem escreveu teste para uma rota
// que ainda nao existe. Esta prova falha sozinha, sem ninguem lembrar dela.
//
// Nao sobe navegador e nao toca banco: le os arquivos.
import fs from "node:fs";
import path from "node:path";

const RAIZ = "app/api";

// Rota deliberadamente publica. Cada uma com o motivo escrito — entrada nesta
// lista e decisao, e decisao sem motivo escrito volta a ser esquecimento.
const PUBLICAS = new Map([
  ["app/api/auth/[...nextauth]/route.ts", "o proprio NextAuth: e a porta de entrada"],
  ["app/api/saude/route.ts", "sonda de disponibilidade do Render, chamada sem sessao"],
]);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

function rotas(dir) {
  const achadas = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name).split(path.sep).join("/");
    if (entrada.isDirectory()) achadas.push(...rotas(caminho));
    else if (entrada.name === "route.ts") achadas.push(caminho);
  }
  return achadas;
}

const encontradas = rotas(RAIZ);
check("ha rotas para varrer", encontradas.length > 0, `${encontradas.length} encontradas`);

for (const rota of encontradas) {
  if (PUBLICAS.has(rota)) {
    console.log(`  PULA    ${rota} :: ${PUBLICAS.get(rota)}`);
    continue;
  }

  const fonte = fs.readFileSync(rota, "utf8");
  check(rota, fonte.includes("requireActor("), "nao passa pelo portao");
}

// Excecao que sobrou na lista depois de a rota ter sumido vira permissao
// esquecida: se o arquivo voltar um dia com outro conteudo, entra liberado.
for (const publica of PUBLICAS.keys()) {
  check(`excecao ainda existe: ${publica}`, fs.existsSync(publica), "remova da lista");
}

console.log(falhas === 0 ? "\nOK  nenhuma rota aberta" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Step 2: Rodar e ver o retrato de hoje**

Run: `node scripts/prova-nenhuma-rota-aberta.mjs`
Expected: falha, listando toda rota sob `app/api/` que ainda não chama `requireActor(` — as três da Task 3 já passam, o resto não.

- [ ] **Step 3: Aplicar o portão às rotas restantes**

Percorrer a lista impressa. Para cada rota, o mesmo bloco da Task 3, Step 2. Rota que precise seguir pública entra em `PUBLICAS` **com o motivo escrito**.

Atenção: rota que hoje escopa por `ownerEmail` ou por `session.user.email` passa a escopar por `actor.organizationId`. Se alguma resistir, pare e reporte em vez de forçar.

- [ ] **Step 4: Rodar até passar**

Run: `node scripts/prova-nenhuma-rota-aberta.mjs`
Expected: `OK  nenhuma rota aberta`, saída 0.

- [ ] **Step 5: Registrar e commitar**

```json
"prova:rotas": "node scripts/prova-nenhuma-rota-aberta.mjs",
```

```bash
git add scripts/prova-nenhuma-rota-aberta.mjs package.json app/api/
git commit -m "portao: a varredura que reprova a rota aberta de amanha"
```

---

## Task 5: dev-auth com dois atores

Sem isto, nenhuma prova das seguintes é escrevível.

**Files:**
- Modify: `lib/dev-auth.ts`
- Modify: `auth.ts:20-30`
- Create: `scripts/lib/atores-de-teste.mjs`

**Interfaces:**
- Consumes: nada
- Produces:
  - `getDevAuthUser(email?: string)` — o parâmetro vence a variável de ambiente
  - `entrarComo(page, email)` de `scripts/lib/atores-de-teste.mjs`

- [ ] **Step 1: Aceitar o e-mail como credencial**

```ts
// lib/dev-auth.ts — substituir getDevAuthUser
/**
 * O e-mail passado vence a variavel de ambiente.
 *
 * Era so a variavel, e por isso as 94 provas testavam UM ator: encenar duas
 * pessoas exigiria reiniciar o servidor no meio do teste. Nao era desleixo da
 * suite — nao havia como testar dois.
 *
 * O portao continua sendo `isDevAuthEnabled()`, que exige NODE_ENV diferente de
 * production E a variavel ligada. Em producao o primeiro ja basta.
 */
export function getDevAuthUser(email?: string) {
  const escolhido = email?.trim().toLowerCase();
  const doAmbiente = process.env.NEXODOC_DEV_AUTH_EMAIL?.trim().toLowerCase();
  const alvo = escolhido || doAmbiente;

  if (!isDevAuthEnabled() || !alvo) {
    return null;
  }

  return {
    id: alvo,
    email: alvo,
    name: escolhido
      ? alvo
      : process.env.NEXODOC_DEV_AUTH_NAME?.trim() || "Usuário Dev",
  };
}
```

- [ ] **Step 2: Passar a credencial adiante em `auth.ts`**

```ts
          Credentials({
            id: DEV_AUTH_PROVIDER_ID,
            name: "Acesso dev",
            credentials: { email: { label: "E-mail", type: "text" } },
            authorize(credentials) {
              return getDevAuthUser(
                typeof credentials?.email === "string" ? credentials.email : undefined,
              );
            },
          }),
```

- [ ] **Step 3: O ajudante das provas**

```js
// scripts/lib/atores-de-teste.mjs
// Entrar como uma pessoa especifica. Exige NEXODOC_DEV_AUTH=true no servidor.
export async function entrarComo(page, email) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: /acesso dev/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
```

Nota: se a tela de login não expuser o provider de credenciais com esse rótulo, ajuste os seletores olhando `app/login/` — e prefira `getByRole` a classe de CSS, como as provas existentes fazem.

- [ ] **Step 4: Provar que dois contextos entram como duas pessoas**

Com o servidor de pé (`NEXODOC_DEV_AUTH=true npm run dev`):

```bash
node -e "
import('playwright').then(async ({ chromium }) => {
  const b = await chromium.launch();
  const { entrarComo } = await import('./scripts/lib/atores-de-teste.mjs');
  const a = await b.newContext(); const c = await b.newContext();
  const pa = await a.newPage(); const pc = await c.newPage();
  pa.setDefaultTimeout(15000); pc.setDefaultTimeout(15000);
  await entrarComo(pa, 'milton@prosul.com');
  await entrarComo(pc, 'victor@prosul.com');
  console.log('dois atores entraram');
  await b.close();
});
"
```
Expected: `dois atores entraram`.

- [ ] **Step 5: Commit**

```bash
git add lib/dev-auth.ts auth.ts scripts/lib/atores-de-teste.mjs
git commit -m "provas: dois atores, que era o que faltava para testar colaboracao"
```

---

## Task 6: Migração passo 1 — a PROSUL existe

**Files:**
- Create: `prisma/migrations/<timestamp>_escritorio_passo_1/migration.sql`
- Modify: `prisma/schema.prisma` (model `Project`)

**Interfaces:**
- Consumes: nada
- Produces: uma linha em `Organization` com `slug = "prosul"`; `Project.createdById` (nova coluna, nullable)

- [ ] **Step 1: Acrescentar `createdById` ao schema, sem tirar nada**

Em `model Project`, ao lado de `ownerId`:

```prisma
  createdById    String?
```

`organizationId` **continua** `String?`. `ownerEmail`, `ownerId` e o `@@unique([ownerEmail, code])` continuam intactos. Este passo é aditivo: nenhum comportamento muda.

- [ ] **Step 2: Gerar a migration**

Run: `npm run db:migrate:dev -- --name escritorio_passo_1`
Expected: cria a pasta de migration e aplica no banco local.

- [ ] **Step 3: Semear a PROSUL na própria migration**

Acrescentar ao fim do `migration.sql` gerado:

```sql
-- A PROSUL. Uma organizacao, semeada aqui e nao por tela, porque o passo 2
-- precisa dela existindo e o cadastro por tela e ato de admin (spec B.2).
INSERT INTO "Organization" ("id", "name", "slug", "ownerEmail", "createdAt", "updatedAt")
VALUES ('org-prosul', 'PROSUL', 'prosul', 'contato@prosul.com', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
```

Trocar `contato@prosul.com` pelo e-mail real antes de rodar em produção.

- [ ] **Step 4: Aplicar e conferir**

```bash
npm run db:migrate
node -e "import('./lib/db.ts').then(async m => console.log(await m.getPrisma().organization.findMany({ select: { slug: true, name: true } })))"
```
Expected: `[ { slug: 'prosul', name: 'PROSUL' } ]`

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "escritorio passo 1: a PROSUL existe, e nada mais muda"
```

---

## Task 7: O diagnóstico, antes de mover qualquer coisa

**Files:**
- Create: `scripts/diagnostico-de-centros-de-custo.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getPrisma` de `@/lib/db`
- Produces: `npm run diag:cc`, saída 1 quando há colisão

- [ ] **Step 1: Escrever o diagnóstico**

```ts
// scripts/diagnostico-de-centros-de-custo.ts
//
//   node scripts/diagnostico-de-centros-de-custo.ts   (== npm run diag:cc)
//
// POR QUE ISTO VEM ANTES DO BACKFILL
//
// O schema hoje declara `code String @default("")` com @@unique([ownerEmail, code]).
// Isso permite UM projeto sem codigo POR DONO. Juntando todos os donos numa
// organizacao, o unique novo (@@unique([organizationId, code])) admite um
// projeto sem codigo NA PROSUL INTEIRA — e todos os outros quebram a migration.
// O mesmo vale para dois donos que cadastraram "099-25" cada um.
//
// Nao e hipotese: e a consequencia aritmetica de juntar donos. Quantos sao, so
// o banco diz. Este script diz ANTES, com os nomes na tela — e nao pelo erro do
// Postgres as tres da manha.
import { getPrisma } from "../lib/db.ts";

const prisma = getPrisma();
const projetos = await prisma.project.findMany({
  where: { deletedAt: null },
  select: { id: true, code: true, name: true, ownerEmail: true },
  orderBy: { code: "asc" },
});

const semCodigo = projetos.filter((p) => !p.code.trim());

const porCodigo = new Map<string, typeof projetos>();
for (const p of projetos) {
  const chave = p.code.trim().toLocaleUpperCase("pt-BR");
  if (!chave) continue;
  porCodigo.set(chave, [...(porCodigo.get(chave) ?? []), p]);
}
const repetidos = [...porCodigo.entries()].filter(([, lista]) => lista.length > 1);

console.log(`projetos vivos: ${projetos.length}`);
console.log(`sem centro de custo: ${semCodigo.length}`);
for (const p of semCodigo) console.log(`  · ${p.name} — ${p.ownerEmail} (${p.id})`);

console.log(`centros de custo repetidos entre donos: ${repetidos.length}`);
for (const [codigo, lista] of repetidos) {
  console.log(`  · ${codigo}`);
  for (const p of lista) console.log(`      ${p.name} — ${p.ownerEmail} (${p.id})`);
}

const bloqueia = semCodigo.length > 1 || repetidos.length > 0;
console.log(
  bloqueia
    ? "\nBLOQUEIA: resolva antes do passo 2. Nada foi alterado."
    : "\nLIVRE: o backfill pode rodar.",
);
process.exit(bloqueia ? 1 : 0);
```

- [ ] **Step 2: Rodar contra o banco local**

Run: `node scripts/diagnostico-de-centros-de-custo.ts`
Expected: `projetos vivos: 0` … `LIVRE`. Banco local vazio passa — o valor do script aparece contra a cópia de produção.

- [ ] **Step 3: Rodar contra a cópia de produção — o passo que importa**

> **Corrigido na execução:** o plano previa `npm run db:backup` + restore num banco
> descartável. Produção é **Neon** (`render.yaml:26`), que faz *branch* do banco: a
> cópia sai instantânea, com o dado real ficando onde já está. Dump para esta máquina
> só seria necessário se produção fosse um Postgres administrado por nós — e não é.

1. No painel do Neon, criar um branch da base de produção (ex.: `ensaio-escritorio`).
2. Apontar `DATABASE_URL` para a URL desse branch.
3. `npm run diag:cc`

Expected: a lista real. **Se sair `BLOQUEIA`, pare o plano aqui e leve os nomes ao mantenedor.** A decisão de que código dar a cada projeto é dele, projeto por projeto — não invente.

O branch é descartável: errou, apaga e cria outro. Produção não é tocada em momento
nenhum deste ensaio.

- [ ] **Step 4: Registrar e commitar**

```json
"diag:cc": "node scripts/diagnostico-de-centros-de-custo.ts",
```

```bash
git add scripts/diagnostico-de-centros-de-custo.ts package.json
git commit -m "escritorio: contar as colisoes antes de causar uma"
```

---

## Task 8: Migração passo 2 — o backfill

**Files:**
- Create: `scripts/backfill-escritorio.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `getPrisma`; a organização `org-prosul` (Task 6); o veredito do diagnóstico (Task 7)
- Produces: todo `Project` com `organizationId`; um `OrganizationMember` por dono distinto

- [ ] **Step 1: Escrever o backfill**

```ts
// scripts/backfill-escritorio.ts
//
//   node scripts/backfill-escritorio.ts            (ensaio, nao grava)
//   node scripts/backfill-escritorio.ts --gravar   (grava)
//
// Ensaio por padrao: um backfill que grava sem pedir e um que roda por engano.
import { getPrisma } from "../lib/db.ts";

const GRAVAR = process.argv.includes("--gravar");
const prisma = getPrisma();
const ORG = "org-prosul";

const org = await prisma.organization.findUnique({ where: { id: ORG } });
if (!org) throw new Error(`Organizacao ${ORG} nao existe. Rode o passo 1 antes.`);

const orfaos = await prisma.project.findMany({
  where: { organizationId: null },
  select: { id: true, ownerEmail: true, ownerName: true, ownerId: true },
});

const donos = new Map<string, { name: string | null; userId: string | null }>();
for (const p of orfaos) {
  if (!donos.has(p.ownerEmail)) {
    donos.set(p.ownerEmail, { name: p.ownerName, userId: p.ownerId });
  }
}

console.log(`projetos sem organizacao: ${orfaos.length}`);
console.log(`donos distintos, que viram membros: ${donos.size}`);
for (const [email] of donos) console.log(`  · ${email}`);

if (!GRAVAR) {
  console.log("\nENSAIO. Nada foi gravado. Rode com --gravar para valer.");
  process.exit(0);
}

/*
 * O PRIMEIRO dono vira OWNER do escritorio, o resto vira MEMBER. E um chute
 * razoavel e reversivel por tela; inventar OWNER para todo mundo nao seria.
 */
let primeiro = true;
for (const [email, dados] of donos) {
  await prisma.organizationMember.upsert({
    where: { organizationId_email: { organizationId: ORG, email } },
    create: {
      organizationId: ORG,
      email,
      name: dados.name,
      userId: dados.userId,
      role: primeiro ? "OWNER" : "MEMBER",
      status: "ACTIVE",
    },
    update: {},
  });
  primeiro = false;
}

const movidos = await prisma.project.updateMany({
  where: { organizationId: null },
  data: { organizationId: ORG },
});

const restantes = await prisma.project.count({ where: { organizationId: null } });

console.log(`\nmembros criados/confirmados: ${donos.size}`);
console.log(`projetos movidos: ${movidos.count}`);
console.log(`projetos ainda sem organizacao: ${restantes}`);
if (restantes !== 0) {
  console.error("FALHOU: sobrou projeto sem organizacao. Nao rode o passo 3.");
  process.exit(1);
}
console.log("OK  backfill fechou as contas.");
```

- [ ] **Step 2: Ensaiar (não grava)**

Run: `node scripts/backfill-escritorio.ts`
Expected: imprime as contagens e `ENSAIO. Nada foi gravado.`

- [ ] **Step 3: Ensaiar na cópia de produção, gravando**

Com `DATABASE_URL` apontando para o branch do Neon criado na Task 7, Step 3:

Run: `node scripts/backfill-escritorio.ts --gravar`
Expected: `OK  backfill fechou as contas.` e `projetos ainda sem organizacao: 0`.

Se sair diferente, **pare** — o passo 3 da migração não pode rodar.

- [ ] **Step 4: Registrar e commitar**

```json
"backfill:escritorio": "node scripts/backfill-escritorio.ts",
```

```bash
git add scripts/backfill-escritorio.ts package.json
git commit -m "escritorio passo 2: os projetos passam a ser da PROSUL"
```

---

## Task 9: Migração passo 3 — o aperto

**Files:**
- Modify: `prisma/schema.prisma` (model `Project`)
- Create: `prisma/migrations/<timestamp>_escritorio_passo_3/migration.sql`

**Interfaces:**
- Consumes: o backfill fechado (Task 8)
- Produces: `Project.organizationId` `NOT NULL`; `@@unique([organizationId, code])`

- [ ] **Step 1: Apertar o schema**

```prisma
model Project {
  organizationId String        // era String?
  createdById    String?
  code           String        // o @default("") sai: code e o centro de custo
  // ...
  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  @@unique([organizationId, code])
  // @@unique([ownerEmail, code]) — removido
  @@index([organizationId, updatedAt])
  // @@index([ownerEmail, updatedAt]) — removido
}
```

`onDelete` vira `Restrict`: com a organização sendo dona, `SetNull` deixaria projeto órfão, que é justamente o estado que este plano acabou de eliminar.

- [ ] **Step 2: Gerar, ler o SQL antes de aplicar**

Run: `npm run db:migrate:dev -- --name escritorio_passo_3 --create-only`
Expected: cria o `migration.sql` **sem** aplicar. Leia-o: confirme que há `SET NOT NULL`, `DROP INDEX` do unique velho e `CREATE UNIQUE INDEX` do novo, e que não há `DROP COLUMN` de `ownerEmail` — as colunas ficam.

- [ ] **Step 3: Aplicar**

Run: `npm run db:migrate`
Expected: aplica sem erro. Erro de unique aqui significa que a Task 7 não foi respeitada — reverta e volte ao diagnóstico.

- [ ] **Step 4: Provar que o dono é o escritório**

```bash
node -e "import('./lib/db.ts').then(async m => {
  const p = m.getPrisma();
  console.log('sem org:', await p.project.count({ where: { organizationId: null } }));
})"
```
Expected: erro de tipo do Prisma ao comparar coluna não-nula com `null`, ou `0`. Os dois provam o aperto.

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "escritorio passo 3: o projeto e do escritorio, e o banco garante"
```

---

## Task 10: A prova de vida — Victor vê o 063-26

**Files:**
- Create: `scripts/prova-escritorio.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `entrarComo` (Task 5); a lista escopada por organização (Task 3, Step 3); o schema apertado (Task 9)
- Produces: `npm run prova:escritorio`

- [ ] **Step 1: Escrever a prova**

```js
// scripts/prova-escritorio.mjs
//
//   node scripts/prova-escritorio.mjs   (== npm run prova:escritorio)
//
// A PROVA DE VIDA do substrato: o Victor entra e ve o projeto do escritorio.
// Hoje ele nao ve — a listagem filtra por ownerEmail — e por isso todo o fluxo
// Milton→Victor do documento de revisao colaborativa nao teria onde acontecer.
//
// E o ESCRITORIO FANTASMA: com uma organizacao so, vazamento entre organizacoes
// nao tem como aparecer. Semear uma segunda e exigir 404 e o que separa "vender
// para o segundo escritorio" de "auditar tudo de novo antes de vender".
//
// Exige banco de pe e NEXODOC_DEV_AUTH=true.
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";
import { getPrisma } from "../lib/db.ts";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

// Semeia: PROSUL com Milton (ADMIN) e Victor (MEMBER), e o 063-26.
await prisma.organizationMember.upsert({
  where: { organizationId_email: { organizationId: "org-prosul", email: "victor@prosul.com" } },
  create: { organizationId: "org-prosul", email: "victor@prosul.com", name: "Victor", role: "MEMBER", status: "ACTIVE" },
  update: { status: "ACTIVE", role: "MEMBER" },
});
await prisma.project.upsert({
  where: { organizationId_code: { organizationId: "org-prosul", code: "063-26" } },
  create: { organizationId: "org-prosul", code: "063-26", name: "Memorial 063-26", client: "CRICIÚMA", ownerEmail: "milton@prosul.com" },
  update: {},
});

// O escritorio fantasma, que existe so para provar que nao vaza.
await prisma.organization.upsert({
  where: { slug: "fantasma" },
  create: { id: "org-fantasma", name: "Escritório Fantasma", slug: "fantasma", ownerEmail: "ninguem@fantasma.com" },
  update: {},
});
const alheio = await prisma.project.upsert({
  where: { organizationId_code: { organizationId: "org-fantasma", code: "999-99" } },
  create: { organizationId: "org-fantasma", code: "999-99", name: "Projeto alheio", client: "OUTRA", ownerEmail: "ninguem@fantasma.com" },
  update: {},
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
page.setDefaultTimeout(20000);

await entrarComo(page, "victor@prosul.com");

// 1. A prova de vida.
await page.goto("/projetos");
const viu = await page.getByText("063-26").first().isVisible().catch(() => false);
check("Victor (MEMBER) ve o 063-26 da PROSUL na lista", viu);

// 2. O isolamento.
const resposta = await page.request.get(`/api/projects/${alheio.id}`);
check("projeto de outro escritorio responde 404", resposta.status() === 404, `status ${resposta.status()}`);

// 3. Sem sessao nao passa.
const anonimo = await browser.newContext({ baseURL: BASE });
const semSessao = await anonimo.request.get("/api/projects");
check("sem sessao a listagem nao responde 200", semSessao.status() !== 200, `status ${semSessao.status()}`);

await browser.close();
console.log(falhas === 0 ? "\nOK  escritorio" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Step 2: Rodar com o servidor de pé**

```bash
NEXODOC_DEV_AUTH=true npm run dev   # noutro terminal
node scripts/prova-escritorio.mjs
```
Expected: `OK  escritorio`, saída 0.

- [ ] **Step 3: Registrar e commitar**

```json
"prova:escritorio": "node scripts/prova-escritorio.mjs",
```

```bash
git add scripts/prova-escritorio.mjs package.json
git commit -m "prova de vida: o Victor ve o projeto do escritorio"
```

---

## Task 11: A alçada de cadastrar projeto

**Files:**
- Modify: `app/api/projects/route.ts` (o `POST`)
- Create: `scripts/prova-alcada.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `requireActor` (Task 3); `Actor.orgRole`
- Produces: `npm run prova:alcada`

- [ ] **Step 1: Exigir alçada no `POST`, e recusar código vazio**

No `POST` de `app/api/projects/route.ts`, depois de `requireActor()`:

```ts
  /*
   * Cadastrar projeto e ato de coordenacao, nao de projetista: e o cadastro que
   * define o centro de custo, e centro de custo errado contamina a fila de
   * achados de outro projeto. MEMBER audita; ADMIN cadastra.
   */
  if (actor.orgRole === "MEMBER" && !actor.isPlatformAdmin) {
    return NextResponse.json(
      { error: "Só a coordenação do escritório cadastra projeto." },
      { status: 403 },
    );
  }

  if (!normalizeProjectCode(payload?.code ?? "")) {
    return NextResponse.json(
      { error: "Informe o centro de custo do projeto." },
      { status: 400 },
    );
  }
```

E o `create` passa `organizationId: actor.organizationId` e `createdById: actor.userId`.

`normalizeProjectCode` vem de `@/lib/project-store` — acrescente ao import se ainda não
estiver lá.

- [ ] **Step 2: Escrever a prova**

```js
// scripts/prova-alcada.mjs
//
//   node scripts/prova-alcada.mjs   (== npm run prova:alcada)
//
// Quem cadastra projeto. O cadastro define o centro de custo, e centro de custo
// errado manda achado para a fila de outro projeto — por isso e alcada, e por
// isso a regra vive no servidor e nao no botao.
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();

const ctxVictor = await browser.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
await entrarComo(pVictor, "victor@prosul.com");
const comoMembro = await pVictor.request.post("/api/projects", {
  data: { code: "111-26", name: "Tentativa do projetista", client: "CRICIÚMA" },
});
check("MEMBER nao cadastra projeto", comoMembro.status() === 403, `status ${comoMembro.status()}`);

const ctxMilton = await browser.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
await entrarComo(pMilton, "milton@prosul.com");
const comoAdmin = await pMilton.request.post("/api/projects", {
  data: { code: "111-26", name: "Cadastro da coordenacao", client: "CRICIÚMA" },
});
check("ADMIN da org cadastra", comoAdmin.ok(), `status ${comoAdmin.status()}`);

const semCodigo = await pMilton.request.post("/api/projects", {
  data: { code: "  ", name: "Sem centro de custo", client: "CRICIÚMA" },
});
check("codigo vazio e recusado", semCodigo.status() === 400, `status ${semCodigo.status()}`);

await browser.close();
console.log(falhas === 0 ? "\nOK  alcada" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

Nota: a prova assume `milton@prosul.com` como `ADMIN` da PROSUL. Semeie-o como a Task 10 semeia o Victor, com `role: "ADMIN"`.

- [ ] **Step 3: Rodar até passar**

Run: `node scripts/prova-alcada.mjs`
Expected: `OK  alcada`

- [ ] **Step 4: Commit**

```bash
git add app/api/projects/route.ts scripts/prova-alcada.mjs package.json
git commit -m "alcada: projetista audita, coordenacao cadastra"
```

---

## Task 11B: Como o Victor entra no escritório

Sem esta tarefa, `OrganizationMember` continua sendo preenchido só por script de
migração e por prova. Não haveria como a PROSUL adicionar alguém — e o Victor do
fluxo Milton→Victor nunca existiria fora dos testes.

**Files:**
- Create: `app/api/organizacao/membros/route.ts`
- Modify: `lib/access-control.ts` (dentro de `getUserAccess`)
- Create: `scripts/prova-convite.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `requireActor`, `Actor.orgRole` (Task 3)
- Produces: `GET`/`POST /api/organizacao/membros`; o efeito colateral de `INVITED → ACTIVE` no primeiro login

- [ ] **Step 1: A rota de membros**

```ts
// app/api/organizacao/membros/route.ts
/**
 * Quem faz parte do escritorio.
 *
 * O convite nasce `INVITED` e sem `userId`, porque o convidado pode nunca ter
 * entrado. E de proposito: da para ATRIBUIR um achado a alguem antes de essa
 * pessoa ter conta — que e exatamente o caso do Victor no primeiro dia. Modelar
 * o responsavel como `User` tornaria isso impossivel.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();
    const membros = await getPrisma().organizationMember.findMany({
      where: { organizationId: actor.organizationId },
      select: { id: true, email: true, name: true, role: true, status: true },
      orderBy: { email: "asc" },
    });

    return NextResponse.json({ membros });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor();

    if (actor.orgRole === "MEMBER" && !actor.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Só a coordenação do escritório convida." },
        { status: 403 },
      );
    }

    const corpo = (await request.json().catch(() => null)) as {
      email?: string;
      name?: string;
      role?: "ADMIN" | "MEMBER";
    } | null;
    const email = corpo?.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    const membro = await getPrisma().organizationMember.upsert({
      where: { organizationId_email: { organizationId: actor.organizationId, email } },
      create: {
        organizationId: actor.organizationId,
        email,
        name: corpo?.name?.trim() || null,
        role: corpo?.role === "ADMIN" ? "ADMIN" : "MEMBER",
        status: "INVITED",
      },
      // Reconvite nao rebaixa quem ja esta ativo: seria como desligar alguem por
      // engano ao tentar corrigir o nome.
      update: { name: corpo?.name?.trim() || undefined },
      select: { id: true, email: true, role: true, status: true },
    });

    return NextResponse.json({ membro }, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
```

- [ ] **Step 2: O convite vira acesso no primeiro login**

Ao fim de `getUserAccess`, em `lib/access-control.ts`, antes de cada `return` que
devolve `source: "database"`, ligar o convite à conta que acabou de existir:

```ts
/**
 * O convite espera a pessoa. Quando ela entra pela primeira vez, o vinculo
 * ganha `userId` e vira ACTIVE — nao ha tela de "aceitar convite", porque para
 * um escritorio o aceite ja aconteceu fora do sistema, quando contrataram.
 */
async function ativarConvitePendente(userId: string, email: string) {
  await getPrisma().organizationMember.updateMany({
    where: { email, status: "INVITED" },
    data: { userId, status: "ACTIVE" },
  });
}
```

Chamar `await ativarConvitePendente(user.id, normalizedEmail)` nos dois caminhos
que resolvem um `User` do banco (o `created` e o `existing`).

- [ ] **Step 3: Escrever a prova**

```js
// scripts/prova-convite.mjs
//
//   node scripts/prova-convite.mjs   (== npm run prova:convite)
//
// Convidar alguem que nunca entrou, e ver o convite virar acesso no login.
// E o caminho pelo qual o Victor passa a existir para o escritorio — e o que
// permite, depois, atribuir um achado a ele antes do primeiro login dele.
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";
import { getPrisma } from "../lib/db.ts";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const NOVO = "ana@prosul.com";
let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else { falhas++; console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`); }
}

const prisma = getPrisma();
await prisma.organizationMember.deleteMany({ where: { email: NOVO } });
await prisma.user.deleteMany({ where: { email: NOVO } });

const browser = await chromium.launch();

const ctxMilton = await browser.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
await entrarComo(pMilton, "milton@prosul.com");
const convite = await pMilton.request.post("/api/organizacao/membros", {
  data: { email: NOVO, name: "Ana", role: "MEMBER" },
});
check("coordenacao convida", convite.status() === 201, `status ${convite.status()}`);

const convidada = await prisma.organizationMember.findFirst({ where: { email: NOVO } });
check("convite nasce INVITED e sem userId", convidada?.status === "INVITED" && convidada?.userId === null);

const ctxVictor = await browser.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
await entrarComo(pVictor, "victor@prosul.com");
const tentativa = await pVictor.request.post("/api/organizacao/membros", {
  data: { email: "outro@prosul.com" },
});
check("MEMBER nao convida", tentativa.status() === 403, `status ${tentativa.status()}`);

const ctxAna = await browser.newContext({ baseURL: BASE });
const pAna = await ctxAna.newPage();
await entrarComo(pAna, NOVO);
const ativada = await prisma.organizationMember.findFirst({ where: { email: NOVO } });
check("primeiro login ativa o convite", ativada?.status === "ACTIVE", `status ${ativada?.status}`);
check("primeiro login liga o userId", Boolean(ativada?.userId));

const lista = await pAna.request.get("/api/projects");
check("a convidada ja ve os projetos da PROSUL", lista.ok(), `status ${lista.status()}`);

await browser.close();
console.log(falhas === 0 ? "\nOK  convite" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Step 4: Rodar até passar**

Run: `node scripts/prova-convite.mjs`
Expected: `OK  convite`

- [ ] **Step 5: Registrar e commitar**

```json
"prova:convite": "node scripts/prova-convite.mjs",
```

```bash
git add app/api/organizacao/ lib/access-control.ts scripts/prova-convite.mjs package.json
git commit -m "convite: o Victor passa a existir para o escritorio antes de existir como conta"
```

---

## Task 12: A resolução do projeto pelo centro de custo

**Files:**
- Create: `lib/resolucao-de-projeto.ts`
- Create: `scripts/test-resolucao-de-projeto.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada (puro)
- Produces:
  - `function normalizarCentroDeCusto(valor: string): string`
  - `function resolverProjeto(args: { codigoExtraido?: string; projetos: ProjetoConhecido[] }): ResolucaoDeProjeto`
  - `type ProjetoConhecido = { id: string; code: string; client: string }`
  - `type ResolucaoDeProjeto = { tipo: "achado"; projeto: ProjetoConhecido } | { tipo: "desconhecido"; codigo: string } | { tipo: "sem-codigo" }`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// scripts/test-resolucao-de-projeto.ts
//
//   node scripts/test-resolucao-de-projeto.ts   (== npm run test:resolucao)
import assert from "node:assert/strict";

import { normalizarCentroDeCusto, resolverProjeto } from "../lib/resolucao-de-projeto.ts";

const projetos = [
  { id: "p1", code: "099-25", client: "CRICIÚMA" },
  { id: "p2", code: "063-26", client: "IÇARA" },
];

assert.equal(normalizarCentroDeCusto(" 099-25 "), "099-25");
assert.equal(normalizarCentroDeCusto("099/25"), "099-25");
assert.equal(normalizarCentroDeCusto("099.25"), "099-25");
assert.equal(normalizarCentroDeCusto("cc 099-25"), "099-25");

const achado = resolverProjeto({ codigoExtraido: "099/25", projetos });
assert.equal(achado.tipo, "achado");
assert.equal(achado.tipo === "achado" && achado.projeto.id, "p1");

// Codigo que ninguem cadastrou PARA, e diz qual foi. Escolher o "mais parecido"
// mandaria a auditoria para a fila do projeto errado, e ninguem perceberia ate
// alguem receber um achado que nao e dele.
const desconhecido = resolverProjeto({ codigoExtraido: "500-99", projetos });
assert.equal(desconhecido.tipo, "desconhecido");
assert.equal(desconhecido.tipo === "desconhecido" && desconhecido.codigo, "500-99");

assert.equal(resolverProjeto({ projetos }).tipo, "sem-codigo");
assert.equal(resolverProjeto({ codigoExtraido: "   ", projetos }).tipo, "sem-codigo");

console.log("OK  resolucao de projeto");
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-resolucao-de-projeto.ts`
Expected: FALHA — módulo não encontrado.

- [ ] **Step 3: Implementar**

```ts
// lib/resolucao-de-projeto.ts
/**
 * A QUE PROJETO esta auditoria pertence.
 *
 * O centro de custo ja e extraido dos documentos (`lib/cross-document-audit.ts:134`
 * le o codigo, `:87` le a prefeitura) — so nunca foi usado para decidir endereco.
 *
 * Tres desfechos, e o do meio e o que importa: codigo desconhecido PARA. Nao
 * escolhe o mais parecido, nao cria projeto. Anexar ao centro de custo errado
 * contamina a fila de achados de outro projeto, e o erro so aparece quando
 * alguem recebe uma pendencia que nao e dele.
 *
 * Puro: nenhum IO. Quem busca os projetos e quem chama.
 */
export type ProjetoConhecido = { id: string; code: string; client: string };

export type ResolucaoDeProjeto =
  | { tipo: "achado"; projeto: ProjetoConhecido }
  | { tipo: "desconhecido"; codigo: string }
  | { tipo: "sem-codigo" };

/**
 * "099/25", "099.25" e "CC 099-25" sao o mesmo centro de custo escrito por tres
 * pessoas diferentes. O separador varia entre carimbo, capa e memorial; o par
 * numero-ano, nao.
 */
export function normalizarCentroDeCusto(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/\bCC\b[\s:.-]*/g, "")
    .replace(/[./]/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

export function resolverProjeto(args: {
  codigoExtraido?: string;
  projetos: ProjetoConhecido[];
}): ResolucaoDeProjeto {
  const codigo = normalizarCentroDeCusto(args.codigoExtraido ?? "");

  if (!codigo) {
    return { tipo: "sem-codigo" };
  }

  const projeto = args.projetos.find(
    (p) => normalizarCentroDeCusto(p.code) === codigo,
  );

  return projeto ? { tipo: "achado", projeto } : { tipo: "desconhecido", codigo };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-resolucao-de-projeto.ts`
Expected: `OK  resolucao de projeto`

- [ ] **Step 5: Registrar e commitar**

```json
"test:resolucao": "node scripts/test-resolucao-de-projeto.ts",
```

```bash
git add lib/resolucao-de-projeto.ts scripts/test-resolucao-de-projeto.ts package.json
git commit -m "resolucao: o centro de custo diz a que projeto a auditoria pertence"
```

---

## Task 13: A rota de auditoria exige projeto

**Files:**
- Modify: `app/api/audit/route.ts` (só o bloco ~3228-3330)
- Modify: `modules/nexo/lib/audit.ts:80-110`

**Interfaces:**
- Consumes: `requireActor` (Task 3); `resolverProjeto` (Task 12)
- Produces: `POST /api/audit` responde 400 sem `projectId`

- [ ] **Step 1: Exigir `projectId`**

Em `app/api/audit/route.ts`, logo após a leitura de `projectId` (linha ~3228):

```ts
    /*
     * SEM PROJETO NAO AUDITA. O caminho anonimo existia porque o Nexo nao
     * mandava `projectId`, e era ele que produzia parecer sem dono, sem
     * escritorio e sem endereco — o chao onde nenhum achado atribuivel podia
     * nascer. Ver o spec do substrato de escritorio, Parte C.3.
     */
    if (!projectId) {
      return jsonError("Informe o projeto desta auditoria.");
    }

    await assertProjectAccess(projectId, {
      id: actor.userId,
      email: actor.email,
      name: actor.name,
    });
```

O `if (projectId)` da linha ~3311 deixa de ser condicional: seu conteúdo passa a rodar sempre. Remover o `if`, mantendo o corpo.

- [ ] **Step 2: O Nexo passa a mandar o projeto**

Em `modules/nexo/lib/audit.ts`, junto dos outros `form.append`:

```ts
  /*
   * O ENDERECO da auditoria. O dossie ja carrega `projectId` (modules/nexo/types.ts:36)
   * e o codigo extraido do documento; o que faltava era mandar. Sem isto a rota
   * recusa, e e de proposito: parecer sem projeto nao tem fila, nem gate.
   */
  if (!opcoes.projectId) throw new AuditoriaSemProjeto();
  form.append("projectId", opcoes.projectId);
```

Definir `AuditoriaSemProjeto` ao lado de `AuditoriaDesconectada`, no mesmo arquivo, e tratá-la em quem chama — mostrando o seletor de projeto do Step 3, e nunca um erro cru.

- [ ] **Step 3: Ligar a resolução na interface**

Primeiro ache o chamador — não presuma o arquivo:

Run: `grep -rn "auditar(" modules/ app/ --include=*.ts --include=*.tsx`

No chamador, antes de disparar:

```ts
const { projetos } = await fetch("/api/projects").then((r) => r.json());
const resolucao = resolverProjeto({
  codigoExtraido: dossie.codigo?.value,
  projetos,
});

switch (resolucao.tipo) {
  case "achado":
    // Reversivel, nao modal: certo custa zero, errado custa um clique.
    // Ver o spec, C.3 — "match errado e pior que match nenhum".
    mostrarNaBarra(`${resolucao.projeto.code} · ${resolucao.projeto.client}`, {
      acao: "não é esse?",
      aoTrocar: () => abrirSeletorDeProjeto(projetos),
    });
    return auditar({ ...opcoes, projectId: resolucao.projeto.id });

  case "desconhecido":
    return pedirCadastro({
      mensagem: `Centro de custo ${resolucao.codigo} não está cadastrado na PROSUL.`,
      // MEMBER nao cadastra (Task 11). Oferecer o botao a quem vai levar 403
      // seria prometer o que a alcada nega.
      podeCadastrar: actor.orgRole !== "MEMBER" || actor.isPlatformAdmin,
    });

  case "sem-codigo":
    return abrirSeletorDeProjeto(projetos);
}
```

`mostrarNaBarra`, `pedirCadastro` e `abrirSeletorDeProjeto` são os nomes deste plano;
use os equivalentes que já existirem no módulo do Nexo em vez de criar paralelos.
A barra de contexto já existe (`components/projects/project-context-strip.tsx`) e é o
lugar natural do primeiro caso.

- [ ] **Step 4: Escrever a prova**

```js
// scripts/prova-auditoria-com-endereco.mjs
//
//   node scripts/prova-auditoria-com-endereco.mjs
//
// Auditoria sem projeto deixou de existir. Era o caminho do Nexo, e era ele que
// produzia parecer sem dono e sem escritorio.
import { chromium } from "playwright";

import { entrarComo } from "./lib/atores-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else { falhas++; console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE });
const page = await ctx.newPage();
await entrarComo(page, "milton@prosul.com");

const form = new FormData();
form.append("message", "Auditoria sem endereço.");
form.append("auditMode", "memorial");
const sem = await page.request.post("/api/audit", { multipart: form });
check("auditoria sem projectId e recusada", sem.status() === 400, `status ${sem.status()}`);

const anonimo = await browser.newContext({ baseURL: BASE });
const semSessao = await anonimo.request.post("/api/audit", { multipart: form });
check("auditoria sem sessao e recusada", [401, 403].includes(semSessao.status()), `status ${semSessao.status()}`);

await browser.close();
console.log(falhas === 0 ? "\nOK  auditoria com endereco" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Step 5: Rodar até passar, e commitar**

Run: `node scripts/prova-auditoria-com-endereco.mjs`
Expected: `OK  auditoria com endereco`

```bash
git add app/api/audit/route.ts modules/nexo/ scripts/prova-auditoria-com-endereco.mjs package.json
git commit -m "auditoria: sem projeto nao audita, e o Nexo diz qual e"
```

---

## Task 14: ~~`lib/audit-store.ts`~~ — DESNECESSÁRIA, já existia

> **Corrigido na execução (13/08/2026).** `lib/audit-persistence.ts` já existe,
> com 198 linhas, e já faz exatamente o que esta tarefa mandava criar:
> `createPendingAudit`, `persistCompletedAudit`, `persistFailedAudit`. A rota
> **não** grava a auditoria inline — eu é que presumi isso ao escrever o plano,
> sem ter procurado.
>
> Criar `lib/audit-store.ts` seria um segundo módulo com a mesma
> responsabilidade, e dois lugares para gravar auditoria é pior do que a rota
> gigante que a tarefa queria evitar.
>
> **O que foi feito no lugar, e é a única parte que valia:** o cabeçalho de
> `lib/audit-persistence.ts` agora diz que `persistCompletedAudit` é o gancho da
> materialização de `FindingOccurrence`. A tentação de plantar isso dentro da
> rota é real, e quem chegar depois merece achar o endereço certo antes de
> escolher o errado.

## Task 14 (original): `lib/audit-store.ts`, para o achado não nascer numa rota de 3.849 linhas

**Files:**
- Create: `lib/audit-store.ts`
- Modify: `app/api/audit/route.ts` (só o bloco de gravação, ~3357 e ~3699)

**Interfaces:**
- Consumes: `getPrisma`; `Actor`
- Produces:
  - `async function abrirAuditoria(args: { auditId?: string; actor: Actor; projectId: string; title: string; projectName: string; auditMode: string; analysisLevel: string }): Promise<{ id: string }>`
  - `async function fecharAuditoria(args: { auditId: string; report: unknown; result: string; elapsedMs: number; totalFindings: number }): Promise<void>`

- [ ] **Step 1: Extrair, sem mudar comportamento**

Mover os dois blocos de `prisma.audit.create` / `prisma.audit.update` de `app/api/audit/route.ts` para `lib/audit-store.ts`, atrás das duas funções acima. A rota passa a chamá-las.

Cabeçalho do arquivo novo:

```ts
/**
 * A GRAVACAO da auditoria, fora da rota.
 *
 * Nao e arrumacao: e onde a materializacao dos achados vai se pendurar. O
 * `FindingOccurrence` nasce do relatorio no momento em que a auditoria fecha, e
 * `app/api/audit/route.ts` tem 3.849 linhas — plantar dominio novo la dentro
 * seria escolher o pior lugar do repositorio de proposito.
 *
 * Irmao de `lib/project-store.ts`, e segue o mesmo formato.
 */
```

Nenhuma lógica muda nesta tarefa. Só o endereço.

- [ ] **Step 2: Provar que nada quebrou**

```bash
npm run build
npm run prova:auditoria
npm run prova:reauditoria
npm run prova:achados-nao-somem
```
Expected: build compila e as três provas existentes passam como antes.

- [ ] **Step 3: Commit**

```bash
git add lib/audit-store.ts app/api/audit/route.ts
git commit -m "audit-store: o lugar onde o achado vai nascer, fora da rota gigante"
```

---

## Fechamento

- [ ] **Rodar tudo**

```bash
npm run test:portao && npm run test:resolucao && npm run prova:rotas
npm run prova:escritorio && npm run prova:alcada && npm run prova:convite
npm run test:admin && npm run prova:admin
```
Expected: tudo verde. Qualquer prova antiga que quebre é sinal de que uma rota mudou de escopo sem que a prova soubesse — corrija a prova **só** depois de entender por que ela quebrou.

- [ ] **Atualizar o spec da revisão colaborativa**

Levar a Parte G do spec do substrato para `docs/arquitetura-revisao-colaborativa.md`: as cinco correções (`impacto` opcional, `MISSING_FINDING` no `qualityVerdict`, `targetKey` que não casa entre versões, `SetNull` no autor da auditoria, `assigneeId` que deve mirar o membro).

- [ ] **Commit final**

```bash
git commit -m "substrato de escritorio: fechado, e a Fase 0 tem onde nascer"
```
