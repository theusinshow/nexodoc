# Fila de achados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um achado pode ser enviado a alguém do escritório, aparece na home dessa pessoa agrupado por projeto, e fecha com um desfecho registrado.

**Architecture:** Sem tabela nova — a atribuição faz `upsert` na linha de `AuditFeedback` que já é única por `(auditId, targetKey)`. O servidor calcula o `fingerprint` a partir do relatório gravado, para que o cliente não possa mandar um errado. "Minhas pendências" é uma consulta, não um estado sincronizado.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, PostgreSQL + Prisma, NextAuth, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-14-fila-de-achados-design.md`

## Global Constraints

- **Uma linha por achado.** A atribuição usa o MESMO `targetKey` da interface (`finding:<findingId>`), por `upsert`. Nunca `create`.
- **Três desfechos:** `FIXED_IN_DOC`, `FALSE_POSITIVE` (marca também o `verdict`), `ACCEPTED_RISK` (exige `note` não vazia).
- **Qualquer um dos dois resolve** — quem recebeu e quem enviou. Sem hierarquia.
- **Só se atribui achado de auditoria que tem `projectId`.** A home agrupa por projeto.
- **A home não vira menu.** Ver `app/page.tsx` — a razão do redirect atual continua valendo; a home só se justifica por mostrar trabalho.
- Núcleo puro (só `import type`) mora em `lib/` e ganha `scripts/test-*.ts` em node cru. Prova de navegador é `scripts/prova-*.mjs` e sai com código 1 quando falha.
- Toda rota sob `app/api/` passa por `requireActor()` ou `checkAdminRequest()`. `npm run prova:rotas` reprova quem esquecer.
- `app/api/audit/route.ts` **não cresce**.
- Provas rodam com `BASE` **e** `SHOT_BASE` na porta certa (a 3000 costuma ser de outro worktree).
- `.env.local` nunca recebe `DATABASE_URL` de produção.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `prisma/schema.prisma` (modificar) | enum `FindingResolutionKind` + colunas em `AuditFeedback` |
| `lib/desfecho-do-achado.ts` (criar) | puro: valida o desfecho e diz o que gravar nos dois eixos |
| `lib/fila-de-achados.ts` (criar) | consultas e escrita da fila: atribuir, e "o que está comigo" |
| `app/api/audits/[id]/atribuir/route.ts` (criar) | `POST` — envia N achados a alguém |
| `app/api/audits/[id]/feedback/route.ts` (modificar) | passa a aceitar `resolutionKind` + `note` |
| `app/api/trabalho/meu/route.ts` (criar) | `GET` — pendências agrupadas por projeto |
| `app/page.tsx` (modificar) | a home deixa de redirecionar |
| `components/home/fila-do-usuario.tsx` (criar) | a lista "com você" |
| `components/audit-result.tsx` (modificar) | seleção em lote, tarja de atribuído, desfecho "Decisão técnica" |
| `modules/nexo/components/ConfirmationCard.tsx` (modificar) | `desconhecido` passa a criar o projeto |
| `scripts/test-desfecho-do-achado.ts` (criar) | o núcleo puro |
| `scripts/prova-fila-de-achados.mjs` (criar) | dois atores, ponta a ponta — inclui a home com e sem pendência |
| `scripts/prova-alcada.mjs` (modificar) | ganha o outro lado: pelo Nexo, `MEMBER` cria projeto |

> O spec listava `prova-home.mjs` e `prova-projeto-nasce-da-auditoria.mjs` como
> arquivos próprios. Viraram asserções dentro das duas provas acima: as três
> precisam do mesmo cenário semeado (escritório, projeto, auditoria), e três
> arquivos montando o mesmo cenário divergem no dia em que um deles muda.

---

## Task 1: As colunas da fila

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_fila_de_achados/migration.sql`

**Interfaces:**
- Consumes: nada
- Produces: `enum FindingResolutionKind { FIXED_IN_DOC, FALSE_POSITIVE, ACCEPTED_RISK }`; em `AuditFeedback`: `fingerprint`, `assigneeEmail`, `assignedById`, `assignedAt`, `resolutionKind`, `resolvedById`

- [ ] **Step 1: Acrescentar o enum e as colunas**

Ao lado dos outros enums em `prisma/schema.prisma`:

```prisma
/// COMO o achado foi encerrado. É eixo diferente do `verdict`, que julga a IA:
/// um achado pode ser PROCEDENTE (verdict) e ter sido resolvido como decisão
/// técnica assumida (resolutionKind). Fundir os dois obrigaria escolher entre
/// registrar o julgamento e registrar o desfecho.
enum FindingResolutionKind {
  FIXED_IN_DOC
  FALSE_POSITIVE
  ACCEPTED_RISK
}
```

Em `model AuditFeedback`, depois de `resolvedAt`:

```prisma
  /// A identidade do achado ENTRE VERSÕES (`chaveEntreVersoes`), gravada no
  /// instante do envio. O `targetKey` guarda `finding:INC-014`, e o `INC-014` é
  /// POSICIONAL: na reauditoria o mesmo achado vira `INC-009`. Sem isto, a
  /// linhagem entre pareceres não teria como reencontrar esta pendência.
  fingerprint    String?
  /// A QUEM foi enviado. E-mail, e não id de usuário: dá para mandar trabalho a
  /// quem ainda não entrou no sistema, e é no primeiro dia que a coordenação
  /// mais distribui.
  assigneeEmail  String?
  assignedById   String?
  assignedAt     DateTime?
  resolutionKind FindingResolutionKind?
  resolvedById   String?
```

E o índice que serve à consulta da home, junto dos outros `@@index`:

```prisma
  @@index([assigneeEmail, resolvedAt])
```

- [ ] **Step 2: Gerar a migration sem aplicar**

Run: `npm run db:migrate:dev -- --name fila_de_achados --create-only`
Expected: cria a pasta e o `migration.sql`. Se o Prisma recusar por não estar em terminal interativo, escreva o SQL à mão:

```sql
CREATE TYPE "FindingResolutionKind" AS ENUM ('FIXED_IN_DOC', 'FALSE_POSITIVE', 'ACCEPTED_RISK');
ALTER TABLE "AuditFeedback" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "AuditFeedback" ADD COLUMN "assigneeEmail" TEXT;
ALTER TABLE "AuditFeedback" ADD COLUMN "assignedById" TEXT;
ALTER TABLE "AuditFeedback" ADD COLUMN "assignedAt" TIMESTAMP(3);
ALTER TABLE "AuditFeedback" ADD COLUMN "resolutionKind" "FindingResolutionKind";
ALTER TABLE "AuditFeedback" ADD COLUMN "resolvedById" TEXT;
CREATE INDEX "AuditFeedback_assigneeEmail_resolvedAt_idx" ON "AuditFeedback"("assigneeEmail", "resolvedAt");
```

Tudo nulável: é aditivo, e nenhuma linha existente muda de significado.

- [ ] **Step 3: Aplicar e conferir**

```bash
npm run db:migrate
npm run db:generate
```

Confirme as colunas:

```powershell
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"; $env:PGPASSWORD = "nexodoc"
& $psql -U nexodoc -h localhost -d nexodoc -tAc "SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM information_schema.columns WHERE table_name='AuditFeedback' AND column_name IN ('fingerprint','assigneeEmail','assignedById','assignedAt','resolutionKind','resolvedById');"
```
Expected: as seis colunas.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "fila: as colunas do envio e do desfecho, todas nulaveis"
```

---

## Task 2: O núcleo puro do desfecho

**Files:**
- Create: `lib/desfecho-do-achado.ts`
- Create: `scripts/test-desfecho-do-achado.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada (puro)
- Produces:
  - `type Desfecho = "FIXED_IN_DOC" | "FALSE_POSITIVE" | "ACCEPTED_RISK"`
  - `type GravacaoDoDesfecho = { resolutionKind: Desfecho; resolvedAt: Date; verdict?: "FALSE_POSITIVE"; note: string }`
  - `class DesfechoInvalido extends Error { readonly motivo: string }`
  - `function gravacaoDoDesfecho(args: { desfecho: string; note?: string; agora: Date }): GravacaoDoDesfecho`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// scripts/test-desfecho-do-achado.ts
//
//   node scripts/test-desfecho-do-achado.ts   (== npm run test:desfecho)
//
// O desfecho toca DOIS eixos que o schema separa de propósito: o trabalho
// (`resolvedAt`) e o julgamento da IA (`verdict`). Só um dos três desfechos
// mexe no segundo, e acertar qual é a coisa que este teste protege.
import assert from "node:assert/strict";

import { DesfechoInvalido, gravacaoDoDesfecho } from "../lib/desfecho-do-achado.ts";

const agora = new Date("2026-08-14T12:00:00.000Z");

// Corrigi no memorial: fecha o trabalho, e não diz nada sobre a IA ter acertado.
const corrigido = gravacaoDoDesfecho({ desfecho: "FIXED_IN_DOC", agora });
assert.equal(corrigido.resolutionKind, "FIXED_IN_DOC");
assert.equal(corrigido.resolvedAt.toISOString(), agora.toISOString());
assert.equal(corrigido.verdict, undefined);
assert.equal(corrigido.note, "");

// Falso positivo: fecha o trabalho E julga a IA. É o único que mexe nos dois,
// e é o que alimenta o benchmark do motor.
const falso = gravacaoDoDesfecho({ desfecho: "FALSE_POSITIVE", agora });
assert.equal(falso.verdict, "FALSE_POSITIVE");
assert.equal(falso.resolvedAt.toISOString(), agora.toISOString());

// Decisão técnica: exige nota. Sem justificativa escrita, ninguém defende a
// decisão seis meses depois, na frente da prefeitura.
assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "ACCEPTED_RISK", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);
assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "ACCEPTED_RISK", note: "   ", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);

const risco = gravacaoDoDesfecho({
  desfecho: "ACCEPTED_RISK",
  note: "Aprovado pelo corpo de bombeiros em 12/08.",
  agora,
});
assert.equal(risco.resolutionKind, "ACCEPTED_RISK");
assert.equal(risco.note, "Aprovado pelo corpo de bombeiros em 12/08.");
assert.equal(risco.verdict, undefined);

// A nota é aparada, e vale para todos: espaço em volta não é justificativa.
const comEspaco = gravacaoDoDesfecho({
  desfecho: "FIXED_IN_DOC",
  note: "  corrigido no capítulo 4  ",
  agora,
});
assert.equal(comEspaco.note, "corrigido no capítulo 4");

assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "RESOLVIDO", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);

console.log("OK  desfecho do achado");
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-desfecho-do-achado.ts`
Expected: FALHA — `Cannot find module '../lib/desfecho-do-achado.ts'`.

- [ ] **Step 3: Implementar**

```ts
// lib/desfecho-do-achado.ts
/**
 * COMO um achado é encerrado, e o que isso grava.
 *
 * O schema separa duas perguntas de propósito (ver o comentário de
 * `AuditFeedback` em [[../prisma/schema.prisma]]): `verdict` julga a AUDITORIA
 * ("procede?") e alimenta o benchmark; `resolvedAt` conta o TRABALHO ("já
 * corrigi?"). Este módulo é quem sabe qual desfecho toca qual eixo — e só um
 * dos três toca os dois.
 *
 * Puro: nenhum IO, nenhuma data implícita. `agora` entra por parâmetro para o
 * teste não depender do relógio.
 */
export type Desfecho = "FIXED_IN_DOC" | "FALSE_POSITIVE" | "ACCEPTED_RISK";

const DESFECHOS: readonly string[] = ["FIXED_IN_DOC", "FALSE_POSITIVE", "ACCEPTED_RISK"];

export type GravacaoDoDesfecho = {
  resolutionKind: Desfecho;
  resolvedAt: Date;
  /** Só o falso positivo julga a IA. Os outros dois não dizem nada sobre ela. */
  verdict?: "FALSE_POSITIVE";
  note: string;
};

export class DesfechoInvalido extends Error {
  readonly motivo: string;

  constructor(motivo: string) {
    super(motivo);
    this.name = "DesfechoInvalido";
    this.motivo = motivo;
  }
}

export function gravacaoDoDesfecho(args: {
  desfecho: string;
  note?: string;
  agora: Date;
}): GravacaoDoDesfecho {
  if (!DESFECHOS.includes(args.desfecho)) {
    throw new DesfechoInvalido("Desfecho desconhecido.");
  }

  const desfecho = args.desfecho as Desfecho;
  const note = (args.note ?? "").trim();

  /*
   * A NOTA É OBRIGATÓRIA NA DECISÃO TÉCNICA, e só nela. "Corrigi" e "não era
   * erro" se explicam sozinhos; assumir um risco, não — e é essa a decisão que
   * alguém vai ter que defender depois de o documento estar emitido.
   */
  if (desfecho === "ACCEPTED_RISK" && !note) {
    throw new DesfechoInvalido("Decisão técnica exige uma justificativa escrita.");
  }

  return {
    resolutionKind: desfecho,
    resolvedAt: args.agora,
    ...(desfecho === "FALSE_POSITIVE" ? { verdict: "FALSE_POSITIVE" as const } : {}),
    note,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-desfecho-do-achado.ts`
Expected: `OK  desfecho do achado`

- [ ] **Step 5: Registrar e commitar**

Em `package.json`, junto dos outros `test:*`:

```json
"test:desfecho": "node scripts/test-desfecho-do-achado.ts",
```

```bash
git add lib/desfecho-do-achado.ts scripts/test-desfecho-do-achado.ts package.json
git commit -m "desfecho: qual dos tres toca o eixo do julgamento da IA"
```

---

## Task 3: Atribuir — o servidor calcula a impressão digital

**Files:**
- Create: `lib/fila-de-achados.ts`
- Create: `app/api/audits/[id]/atribuir/route.ts`

**Interfaces:**
- Consumes: `requireActor`, `accessDeniedResponse` de `@/lib/access-control`; `chaveEntreVersoes` de `@/lib/diff-de-pareceres`; `getPrisma` de `@/lib/db`
- Produces:
  - `async function atribuirAchados(args: { auditId: string; findingIds: string[]; assigneeEmail: string; atribuidoPor: { id: string | null; email: string } }): Promise<{ atribuidos: number }>`
  - `POST /api/audits/:id/atribuir` com corpo `{ findingIds: string[]; assigneeEmail: string }`

- [ ] **Step 1: A escrita da fila**

```ts
// lib/fila-de-achados.ts
/**
 * QUEM está com qual achado.
 *
 * Não há tabela de tarefa: a atribuição faz `upsert` na linha de
 * `AuditFeedback` que já é única por `(auditId, targetKey)`. Chave própria faria
 * o mesmo achado ter duas linhas — uma com o veredito dado na tela, outra com a
 * pendência —, e as duas discordariam na primeira vez que alguém marcasse
 * corrigido.
 *
 * O FINGERPRINT É CALCULADO AQUI, do relatório gravado, e nunca aceito do
 * cliente. É a identidade do achado entre versões, e um valor errado só
 * apareceria muitos meses depois, quando a reauditoria não reencontrasse a
 * pendência — tarde demais para descobrir de onde veio.
 */
import type { AuditReport } from "@/lib/audit-report";
import { chaveEntreVersoes } from "@/lib/diff-de-pareceres";
import { getPrisma } from "@/lib/db";

export class FilaRecusada extends Error {
  readonly status: 400 | 404;

  constructor(status: 400 | 404, message: string) {
    super(message);
    this.name = "FilaRecusada";
    this.status = status;
  }
}

export async function atribuirAchados(args: {
  auditId: string;
  findingIds: string[];
  assigneeEmail: string;
  atribuidoPor: { id: string | null; email: string };
  organizationId: string;
}): Promise<{ atribuidos: number }> {
  const prisma = getPrisma();

  const audit = await prisma.audit.findFirst({
    where: { id: args.auditId, project: { organizationId: args.organizationId } },
    select: { id: true, report: true, projectId: true },
  });

  if (!audit) {
    throw new FilaRecusada(404, "Auditoria não encontrada.");
  }

  /*
   * SEM PROJETO NÃO HÁ FILA. A home agrupa por projeto, e auditoria legada do
   * Nexo não tem um. Deixar atribuir criaria pendência que não aparece em lugar
   * nenhum — pior do que recusar.
   */
  if (!audit.projectId) {
    throw new FilaRecusada(400, "Esta auditoria não pertence a um projeto.");
  }

  const report = audit.report as AuditReport | null;
  const achados = report?.incongruencias ?? [];

  const membro = await prisma.organizationMember.findFirst({
    where: { organizationId: args.organizationId, email: args.assigneeEmail },
    select: { email: true },
  });

  if (!membro) {
    throw new FilaRecusada(400, "Essa pessoa não faz parte do escritório.");
  }

  const agora = new Date();
  let atribuidos = 0;

  for (const findingId of args.findingIds) {
    const achado = achados.find((item) => item.id === findingId);

    // Achado que não está no relatório não vira pendência: seria uma linha
    // apontando para nada, e ela apareceria na home de alguém.
    if (!achado) continue;

    const targetKey = `finding:${findingId}`;
    const dados = {
      fingerprint: chaveEntreVersoes(achado),
      assigneeEmail: membro.email,
      assignedById: args.atribuidoPor.id,
      assignedAt: agora,
    };

    await prisma.auditFeedback.upsert({
      where: { auditId_targetKey: { auditId: audit.id, targetKey } },
      create: {
        auditId: audit.id,
        targetKey,
        findingId,
        findingLabel: achado.tipo.slice(0, 160),
        page: achado.pagina?.slice(0, 80) ?? null,
        ...dados,
      },
      /*
       * Reatribuir NÃO limpa o que já foi decidido: o veredito e a nota de quem
       * olhou antes continuam valendo. Só muda de mãos.
       */
      update: dados,
    });

    atribuidos += 1;
  }

  return { atribuidos };
}
```

- [ ] **Step 2: A rota**

```ts
// app/api/audits/[id]/atribuir/route.ts
/**
 * ENVIAR achados a alguém do escritório.
 *
 * Recebe uma LISTA porque é assim que o trabalho acontece: quem revê o memorial
 * marca os cinco erros de PPCI e manda todos de uma vez. Uma rota por achado
 * faria cinco requisições e cinco chances de metade chegar.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { atribuirAchados, FilaRecusada } from "@/lib/fila-de-achados";
import { isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }

    const corpo = (await request.json().catch(() => null)) as {
      findingIds?: unknown;
      assigneeEmail?: unknown;
    } | null;

    const findingIds = Array.isArray(corpo?.findingIds)
      ? corpo.findingIds.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const assigneeEmail =
      typeof corpo?.assigneeEmail === "string" ? corpo.assigneeEmail.trim().toLowerCase() : "";

    if (findingIds.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um achado." }, { status: 400 });
    }

    if (!assigneeEmail) {
      return NextResponse.json({ error: "Informe para quem enviar." }, { status: 400 });
    }

    const resultado = await atribuirAchados({
      auditId: id,
      findingIds,
      assigneeEmail,
      atribuidoPor: { id: actor.userId, email: actor.email },
      organizationId: actor.organizationId,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    if (err instanceof FilaRecusada) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
```

- [ ] **Step 3: Compilar e conferir o portão**

```bash
npx tsc --noEmit
npm run prova:rotas
```
Expected: typecheck limpo, e `OK  nenhuma rota aberta` (a rota nova passa pelo portão).

- [ ] **Step 4: Commit**

```bash
git add lib/fila-de-achados.ts app/api/audits/
git commit -m "atribuir: a impressao digital sai do relatorio, nunca do cliente"
```

---

## Task 4: O feedback aceita o desfecho

**Files:**
- Modify: `app/api/audits/[id]/feedback/route.ts`

**Interfaces:**
- Consumes: `gravacaoDoDesfecho`, `DesfechoInvalido` de `@/lib/desfecho-do-achado` (Task 2)
- Produces: `POST /api/audits/:id/feedback` passa a aceitar `{ resolutionKind, note }`

- [ ] **Step 1: Aceitar o desfecho no corpo**

Depois de `const verdict = parseVerdict(body.verdict);`, acrescentar:

```ts
  /*
   * O DESFECHO é a terceira coisa que esta rota grava, e ela continua sendo uma
   * rota só porque tudo mora na MESMA LINHA. Uma rota separada para resolver
   * faria duas escritas concorrentes no mesmo registro.
   */
  let desfecho: ReturnType<typeof gravacaoDoDesfecho> | null = null;

  if (body.resolutionKind !== undefined) {
    try {
      desfecho = gravacaoDoDesfecho({
        desfecho: String(body.resolutionKind),
        note: typeof body.note === "string" ? body.note : undefined,
        agora: new Date(),
      });
    } catch (err) {
      if (err instanceof DesfechoInvalido) return jsonError(err.motivo);
      throw err;
    }
  }
```

O tipo de `body` ganha `resolutionKind?: string;`.

A guarda `if (!verdict && !temResolvido)` passa a aceitar o desfecho como pedido válido:

```ts
  if (!verdict && !temResolvido && !desfecho) {
    return jsonError("Informe a avaliação do achado, o desfecho, ou se ele foi corrigido.");
  }
```

E o objeto `data` incorpora o desfecho, sem apagar o que não veio:

```ts
  const data = {
    auditId: id,
    targetKey,
    findingId: findingId || null,
    findingLabel: String(body.findingLabel ?? "").trim().slice(0, 160) || null,
    page: String(body.page ?? "").trim().slice(0, 80) || null,
    verdict: desfecho?.verdict ?? verdict,
    resolvedAt: desfecho ? desfecho.resolvedAt : (resolvedAt ?? null),
    note: desfecho ? desfecho.note : note,
    ...(desfecho ? { resolutionKind: desfecho.resolutionKind, resolvedById: actor.userId } : {}),
  };
```

No `update` do `upsert`, acrescentar ao final:

```ts
            ...(desfecho
              ? {
                  resolutionKind: desfecho.resolutionKind,
                  resolvedAt: desfecho.resolvedAt,
                  resolvedById: actor.userId,
                  ...(desfecho.verdict ? { verdict: desfecho.verdict } : {}),
                  ...(desfecho.note ? { note: desfecho.note } : {}),
                }
              : {}),
```

Acrescentar os imports: `gravacaoDoDesfecho`, `DesfechoInvalido` de `@/lib/desfecho-do-achado`.

Nota para quem implementa: esta rota já chama `requireActor()` desde o substrato. Use o `actor` que já está no escopo para `resolvedById`; se não estiver, resolva-o com o mesmo bloco de portão das outras rotas.

- [ ] **Step 2: Compilar**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 3: Provar pela API, com o servidor de pé**

```bash
BASE=http://localhost:3001 SHOT_BASE=http://localhost:3001 npm run prova:validacao-do-achado
```
Expected: passa como antes — a rota não mudou para quem só manda `verdict`/`resolved`.

- [ ] **Step 4: Commit**

```bash
git add app/api/audits/
git commit -m "feedback: o desfecho entra na mesma linha, e nao numa rota concorrente"
```

---

## Task 5: O que está comigo

**Files:**
- Modify: `lib/fila-de-achados.ts`
- Create: `app/api/trabalho/meu/route.ts`

**Interfaces:**
- Consumes: `getPrisma`
- Produces:
  - `type ProjetoComPendencia = { projectId: string; code: string; client: string; auditId: string; auditTitle: string; total: number; enviadoPor: string | null; enviadoEm: string }`
  - `async function pendenciasDe(email: string, organizationId: string): Promise<ProjetoComPendencia[]>`
  - `GET /api/trabalho/meu` → `{ pendencias: ProjetoComPendencia[] }`

- [ ] **Step 1: A consulta**

Acrescentar a `lib/fila-de-achados.ts`:

```ts
export type ProjetoComPendencia = {
  projectId: string;
  code: string;
  client: string;
  auditId: string;
  auditTitle: string;
  total: number;
  enviadoPor: string | null;
  enviadoEm: string;
};

/**
 * O QUE ESTÁ COM VOCÊ, agrupado por projeto.
 *
 * É consulta, e não estado guardado: não há tabela de tarefa para sair de sincronia
 * com a linha do achado. Uma pendência some quando `resolvedAt` deixa de ser nulo,
 * e isso acontece no mesmo lugar em que o desfecho é gravado.
 *
 * Agrupa por PROJETO porque é assim que a pessoa pensa — "o 063-26 está me
 * esperando" —, e não por achado solto: quarenta linhas sem contexto não dizem
 * por onde começar.
 */
export async function pendenciasDe(
  email: string,
  organizationId: string,
): Promise<ProjetoComPendencia[]> {
  const linhas = await getPrisma().auditFeedback.findMany({
    where: {
      assigneeEmail: email,
      resolvedAt: null,
      audit: { project: { organizationId } },
    },
    select: {
      assignedAt: true,
      assignedById: true,
      audit: {
        select: {
          id: true,
          title: true,
          report: true,
          project: { select: { id: true, code: true, client: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  const autores = new Map<string, string>();
  const ids = [...new Set(linhas.map((l) => l.assignedById).filter((x): x is string => Boolean(x)))];

  if (ids.length) {
    const usuarios = await getPrisma().user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    for (const u of usuarios) autores.set(u.id, u.name || u.email);
  }

  const porAuditoria = new Map<string, ProjetoComPendencia>();

  for (const linha of linhas) {
    const projeto = linha.audit.project;
    if (!projeto) continue;

    const atual = porAuditoria.get(linha.audit.id);

    if (atual) {
      atual.total += 1;
      continue;
    }

    porAuditoria.set(linha.audit.id, {
      projectId: projeto.id,
      code: projeto.code,
      client: projeto.client,
      auditId: linha.audit.id,
      auditTitle: linha.audit.title,
      total: 1,
      /*
       * NÃO há contagem de críticos aqui, e o desenho da home no spec a mostrava.
       * Ela exigiria ler e classificar o relatório de CADA auditoria a cada
       * carregamento da home — caro, e por um número que não muda a decisão de
       * quem abre. Um campo `criticos: 0` fixo seria pior: um zero que mente.
       * Quando alguém sentir falta, entra com o custo medido.
       */
      enviadoPor: linha.assignedById ? (autores.get(linha.assignedById) ?? null) : null,
      enviadoEm: (linha.assignedAt ?? new Date()).toISOString(),
    });
  }

  return [...porAuditoria.values()];
}
```

- [ ] **Step 2: A rota**

```ts
// app/api/trabalho/meu/route.ts
/**
 * O que exige ação SUA.
 *
 * Não existe "enviados por mim" aqui, e é decisão: a home é o que pede trabalho
 * de você. O que você delegou não pede — e transformar a home em caixa de saída
 * a encheria de informação que ninguém precisa ver todo dia.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { isDatabaseConfigured } from "@/lib/db";
import { pendenciasDe } from "@/lib/fila-de-achados";

export const runtime = "nodejs";

export async function GET() {
  try {
    const actor = await requireActor();

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ pendencias: [] });
    }

    return NextResponse.json({
      pendencias: await pendenciasDe(actor.email, actor.organizationId),
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
```

- [ ] **Step 3: Compilar e conferir o portão**

```bash
npx tsc --noEmit && npm run prova:rotas
```
Expected: limpo, e `OK  nenhuma rota aberta`.

- [ ] **Step 4: Commit**

```bash
git add lib/fila-de-achados.ts app/api/trabalho/
git commit -m "meu trabalho: consulta, e nao estado guardado que sai de sincronia"
```

---

## Task 6: A home

**Files:**
- Modify: `app/page.tsx`
- Create: `components/home/fila-do-usuario.tsx`

**Interfaces:**
- Consumes: `GET /api/trabalho/meu` (Task 5)
- Produces: a rota `/` deixa de redirecionar

- [ ] **Step 1: A lista**

```tsx
// components/home/fila-do-usuario.tsx
"use client";

/**
 * O QUE ESTÁ COM VOCÊ.
 *
 * Agrupado por projeto e por auditoria, porque é assim que a pessoa pensa: "o
 * 063-26 está me esperando". Quarenta achados soltos numa lista não dizem por
 * onde começar.
 *
 * Abrir leva à auditoria INTEIRA, e não a uma vista só do que é seu: corrigir um
 * achado sem ver o resto do documento é como se conserta uma coisa e se quebra
 * outra.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

type Pendencia = {
  projectId: string;
  code: string;
  client: string;
  auditId: string;
  auditTitle: string;
  total: number;
  enviadoPor: string | null;
  enviadoEm: string;
};

function quandoFoi(iso: string) {
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 60) return `há ${Math.max(1, minutos)} min`;
  if (minutos < 60 * 24) return `há ${Math.round(minutos / 60)}h`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(iso));
}

export function FilaDoUsuario() {
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/trabalho/meu")
      .then((r) => (r.ok ? r.json() : { pendencias: [] }))
      .then((d) => vivo && setPendencias(d.pendencias ?? []))
      .catch(() => vivo && setPendencias([]));
    return () => {
      vivo = false;
    };
  }, []);

  // Enquanto não sabemos, não afirmamos nada: dizer "nada com você" e depois
  // mostrar cinco pendências é pior do que não dizer.
  if (pendencias === null) return null;
  if (pendencias.length === 0) return null;

  return (
    <section aria-labelledby="fila-titulo" className="mb-10">
      <h2 id="fila-titulo" className="mb-4 font-mono text-xs tracking-widest text-muted-foreground">
        COM VOCÊ
      </h2>

      <ul className="flex flex-col gap-3">
        {pendencias.map((p) => (
          <li
            key={p.auditId}
            className="flex items-center justify-between gap-4 border border-border bg-[var(--nexodoc-recessed)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-sm text-foreground">
                {p.code} · {p.client}
              </p>
              <p className="truncate text-sm text-muted-foreground">{p.auditTitle}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {p.total} {p.total === 1 ? "achado" : "achados"}
                {p.enviadoPor ? ` · de ${p.enviadoPor}` : ""} · {quandoFoi(p.enviadoEm)}
              </p>
            </div>

            <Link
              href={`/nexo?auditoria=${encodeURIComponent(p.auditId)}`}
              className="shrink-0 border border-primary/30 bg-primary/10 px-4 py-2 font-mono text-xs text-primary"
            >
              ABRIR
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: A raiz para de redirecionar**

Em `app/page.tsx`, substituir o bloco do redirect por:

```tsx
  /*
   * A ENTRADA DEIXOU DE SER O NEXO — e a razão do redirect continua válida.
   *
   * O comentário anterior dizia: "um menu com um item só é uma parada no
   * caminho". Continua verdade, e é por isso que esta home NÃO é um menu. Ela
   * mostra o que está esperando por você; quando não há nada, o caminho para o
   * Nexo é o elemento mais forte da tela.
   *
   * O preço, assumido: quem nunca recebe achado ganha um clique a mais. A
   * alternativa — redirecionar só quando não há pendência — faria a entrada do
   * produto mudar de lugar dependendo do dia.
   */
  const session = await auth();
```

(removendo o `if (isNexoEnabled()) redirect("/nexo");`)

E, dentro do JSX, antes da grade de módulos:

```tsx
        <FilaDoUsuario />
```

Importar `FilaDoUsuario` de `@/components/home/fila-do-usuario`.

Nota: `isNexoEnabled()` continua sendo usado no resto do arquivo para o kill-switch; não remova o import se ele ainda for referenciado.

- [ ] **Step 3: Provar à mão**

Com o servidor de pé, abra `http://localhost:3001/` logado. Sem pendência, a home mostra os módulos e o caminho para o Nexo. Não deve mais pular direto.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/home/
git commit -m "home: a raiz para de redirecionar, e mostra o que espera por voce"
```

---

## Task 7: A tarja e o desfecho no cartão

**Files:**
- Modify: `components/audit-result.tsx`

**Interfaces:**
- Consumes: `POST /api/audits/:id/feedback` com `resolutionKind` (Task 4)
- Produces: no cartão, a tarja `com <nome>` e o botão `Decisão técnica`

- [ ] **Step 1: Carregar quem está com cada achado**

O componente já busca o feedback em `useEffect` e monta `feedbackByFinding`. Acrescente, no mesmo lugar, um mapa `atribuidoPor`:

```ts
setAtribuidoPor(
  Object.fromEntries(
    linhas
      .filter((item) => item.assigneeEmail && !item.resolvedAt)
      .map((item) => [item.findingId as string, item.assigneeEmail as string]),
  ),
);
```

O tipo `SavedFeedback` ganha `assigneeEmail: string | null` e `resolutionKind: string | null`.

- [ ] **Step 2: A tarja**

Ao lado da etiqueta de veredito que já existe no cabeçalho do cartão:

```tsx
{finding.refId && atribuidoPor[finding.refId] ? (
  <span className="border border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-2 py-1 font-mono text-[11px] text-[var(--status-warning)]">
    com {atribuidoPor[finding.refId]}
  </span>
) : null}

{/*
  O DESFECHO FICA, e a tarja de "com fulano" é que sai.
  É aqui que QUEM ENVIOU descobre o que aconteceu — não há lista "enviados por
  mim" na home, de propósito (ver o spec, C.2). Se a tarja apenas sumisse ao
  resolver, quem delegou não teria onde ver a resposta, e ia perguntar por fora
  do sistema.
*/}
{finding.refId && desfechoPorAchado[finding.refId] ? (
  <span className="border border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] px-2 py-1 font-mono text-[11px] text-[var(--status-ok)]">
    {DESFECHO_LABEL[desfechoPorAchado[finding.refId].kind]}
    {desfechoPorAchado[finding.refId].por ? ` · ${desfechoPorAchado[finding.refId].por}` : ""}
  </span>
) : null}
```

E o rótulo, ao lado de `VEREDITO_LABEL`, que já existe no arquivo:

```ts
const DESFECHO_LABEL: Record<string, string> = {
  FIXED_IN_DOC: "Corrigido",
  FALSE_POSITIVE: "Falso positivo",
  ACCEPTED_RISK: "Decisão técnica",
};
```

`desfechoPorAchado` é `useState<Record<string, { kind: string; por: string | null }>>({})`,
preenchido no mesmo `useEffect` que carrega o feedback: as linhas com
`resolutionKind` viram entradas dele, e o `por` sai do nome de quem resolveu.

- [ ] **Step 3: O desfecho "Decisão técnica"**

Ao lado de "Marcar corrigido", um botão que abre um campo de nota na própria linha — e só envia com a nota preenchida:

```tsx
<Button
  variant="outline"
  size="sm"
  disabled={!notaDoRisco[finding.refId ?? ""]?.trim()}
  onClick={() =>
    void salvarDesfecho(finding, index, "ACCEPTED_RISK", notaDoRisco[finding.refId ?? ""])
  }
>
  Decisão técnica
</Button>
```

E a função que grava, ao lado de `saveFindingFeedback`:

```ts
  /**
   * O DESFECHO, na mesma rota do veredito — é a mesma linha do banco.
   *
   * `ACCEPTED_RISK` sem nota é recusado pelo SERVIDOR (`lib/desfecho-do-achado.ts`),
   * e o botão desabilitado aqui é só cortesia: a regra que vale é a de lá, porque
   * é ela que ninguém contorna com um `fetch` à mão.
   */
  async function salvarDesfecho(
    finding: StructuredFinding,
    index: number,
    resolutionKind: "FIXED_IN_DOC" | "FALSE_POSITIVE" | "ACCEPTED_RISK",
    note?: string,
  ) {
    if (!auditId) return;

    const findingId = finding.refId ?? `achado-${index + 1}`;

    const response = await fetch(getFeedbackEndpoint(auditId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingId,
        findingLabel: finding.title,
        page: finding.pagina,
        resolutionKind,
        note,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setFeedbackNotice(payload?.error ?? "Não foi possível registrar o desfecho.");
      return;
    }

    setAtribuidoPor((atual) => {
      const proximo = { ...atual };
      delete proximo[findingId];
      return proximo;
    });
    setFeedbackNotice("Desfecho registrado.");
  }
```

`notaDoRisco` é um `useState<Record<string, string>>({})` alimentado por um `<textarea>` que aparece quando o usuário clica em "Decisão técnica" pela primeira vez.

- [ ] **Step 4: Compilar e rodar as provas do visor**

```bash
npx tsc --noEmit
BASE=http://localhost:3001 SHOT_BASE=http://localhost:3001 npm run prova:validacao-do-achado
BASE=http://localhost:3001 SHOT_BASE=http://localhost:3001 npm run prova:achados-nao-somem
```
Expected: as duas passam — o cartão ganhou coisa, e não perdeu nada.

- [ ] **Step 5: Commit**

```bash
git add components/audit-result.tsx
git commit -m "cartao: com quem esta, e a decisao tecnica que exige justificativa"
```

---

## Task 8: Selecionar e enviar

**Files:**
- Modify: `components/audit-result.tsx`

**Interfaces:**
- Consumes: `POST /api/audits/:id/atribuir` (Task 3); `GET /api/organizacao/membros`
- Produces: seleção em lote na lista de achados

- [ ] **Step 1: A seleção**

`const [selecionados, setSelecionados] = useState<Set<string>>(new Set());`, e uma caixa por achado no cabeçalho do cartão:

```tsx
<input
  type="checkbox"
  checked={finding.refId ? selecionados.has(finding.refId) : false}
  onChange={() => finding.refId && alternarSelecao(finding.refId)}
  aria-label={`Selecionar ${finding.refId ?? finding.title}`}
  className="size-4 accent-primary"
/>
```

- [ ] **Step 2: A barra de ação**

Aparece só quando há seleção — mesmo padrão de `/admin/users`, que já existe no produto:

```tsx
{selecionados.size > 0 ? (
  <div className="sticky bottom-4 z-10 flex items-center gap-3 border border-border bg-[var(--nexodoc-recessed)] px-4 py-3">
    <span className="font-mono text-xs text-muted-foreground">
      {selecionados.size} {selecionados.size === 1 ? "achado" : "achados"}
    </span>

    <select
      value={destinatario}
      onChange={(e) => setDestinatario(e.target.value)}
      className="h-9 border border-border bg-background px-2 font-mono text-xs"
    >
      <option value="">Enviar para…</option>
      {membros.map((m) => (
        <option key={m.email} value={m.email}>
          {m.name ?? m.email} {m.status === "INVITED" ? "(convidado)" : ""}
        </option>
      ))}
    </select>

    <Button size="sm" disabled={!destinatario} onClick={() => void enviar()}>
      Enviar
    </Button>

    <button type="button" onClick={() => setSelecionados(new Set())} aria-label="Limpar seleção">
      ✕
    </button>
  </div>
) : null}
```

- [ ] **Step 3: Buscar os membros e enviar**

```ts
  // A lista inclui quem foi convidado e nunca entrou — mandar trabalho a quem
  // ainda não logou é o caso do primeiro dia de uso.
  useEffect(() => {
    fetch("/api/organizacao/membros")
      .then((r) => (r.ok ? r.json() : { membros: [] }))
      .then((d) => setMembros(d.membros ?? []))
      .catch(() => setMembros([]));
  }, []);

  async function enviar() {
    if (!auditId || !destinatario) return;

    const response = await fetch(`/api/audits/${encodeURIComponent(auditId)}/atribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findingIds: [...selecionados], assigneeEmail: destinatario }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { atribuidos?: number; error?: string }
      | null;

    if (!response.ok) {
      setFeedbackNotice(payload?.error ?? "Não foi possível enviar.");
      return;
    }

    setAtribuidoPor((atual) => {
      const proximo = { ...atual };
      for (const id of selecionados) proximo[id] = destinatario;
      return proximo;
    });
    setSelecionados(new Set());
    setDestinatario("");
    setFeedbackNotice(`${payload?.atribuidos ?? 0} achado(s) enviado(s).`);
  }
```

- [ ] **Step 4: Compilar e conferir**

```bash
npx tsc --noEmit && npx eslint components/audit-result.tsx
```
Expected: limpos.

- [ ] **Step 5: Commit**

```bash
git add components/audit-result.tsx
git commit -m "enviar: selecao em lote, no padrao que o admin ja usa"
```

---

## Task 9: O projeto nasce da auditoria

**Files:**
- Modify: `modules/nexo/lib/projeto-da-auditoria.ts`
- Create: `app/api/projects/por-centro-de-custo/route.ts`

**Interfaces:**
- Consumes: `resolverProjeto` de `@/lib/resolucao-de-projeto`
- Produces: `POST /api/projects/por-centro-de-custo` `{ code, client }` → `{ project }`

- [ ] **Step 1: A rota que cria**

```ts
// app/api/projects/por-centro-de-custo/route.ts
/**
 * A PASTA NASCE DO DOCUMENTO.
 *
 * `POST /api/projects` exige `ADMIN` da organização, e continua exigindo: lá
 * alguém INVENTA um código, digitando. Aqui o código foi EXTRAÍDO do PDF pela
 * classificação, e por isso qualquer membro pode criar — é a decisão A.1 do
 * spec, e a diferença entre inventar e extrair é o que a justifica.
 *
 * O risco aceito, escrito para não virar surpresa: documento ruim pode render
 * um código torto e um projeto paralelo. Ele fica visível na lista com quem o
 * criou, e é apagável.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { normalizarCentroDeCusto } from "@/lib/resolucao-de-projeto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await requireActor();

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }

    const corpo = (await request.json().catch(() => null)) as {
      code?: unknown;
      client?: unknown;
      name?: unknown;
    } | null;

    const code = normalizarCentroDeCusto(typeof corpo?.code === "string" ? corpo.code : "");
    const client = typeof corpo?.client === "string" ? corpo.client.trim() : "";

    if (!code) {
      return NextResponse.json({ error: "Sem centro de custo no documento." }, { status: 400 });
    }

    /*
     * `upsert` e não `create`: duas pessoas podem arrastar o mesmo memorial ao
     * mesmo tempo, e o unique (organizationId, code) transformaria a segunda num
     * erro que a tela não saberia explicar.
     */
    const project = await getPrisma().project.upsert({
      where: { organizationId_code: { organizationId: actor.organizationId, code } },
      create: {
        organizationId: actor.organizationId,
        code,
        client,
        name: typeof corpo?.name === "string" && corpo.name.trim() ? corpo.name.trim() : code,
        ownerEmail: actor.email,
        ownerName: actor.name,
        createdById: actor.userId,
      },
      // Projeto que já existe não é reescrito pelo que a IA leu agora: o
      // cadastro de quem o criou vale mais do que a leitura de um PDF qualquer.
      update: {},
      select: { id: true, code: true, client: true },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
```

- [ ] **Step 2: O desconhecido passa a criar**

Em `modules/nexo/lib/projeto-da-auditoria.ts`, o desfecho `desconhecido` deixa de ser impasse:

```ts
  if (resolucao.tipo === "desconhecido") {
    /*
     * CRIA em vez de recusar. Antes, aqui o Nexo parava e mandava chamar um
     * admin — era a decisão anterior, e o mantenedor a inverteu: o código não é
     * digitado por ninguém, é lido do documento.
     */
    const criado = await fetch("/api/projects/por-centro-de-custo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: resolucao.codigo, client: prefeitura ?? "", name: obra }),
      signal,
    });

    if (!criado.ok) {
      return { tipo: "sem-escritorio", motivo: "Não deu para criar a pasta do projeto." };
    }

    const { project } = (await criado.json()) as { project: ProjetoConhecido };
    return { tipo: "achado", projeto: project };
  }
```

A assinatura de `resolverProjetoDaAuditoria` ganha `prefeitura?: string | null` e `obra?: string | null`, e o `ConfirmationCard` passa `memorialFatos?.orgao` e `memorialFatos?.obra`.

O desfecho `sem-codigo` **não muda**: documento sem código legível continua perguntando, porque criar pasta sem nome seria pior do que perguntar.

- [ ] **Step 3: Compilar e conferir o portão**

```bash
npx tsc --noEmit && npm run prova:rotas
```

- [ ] **Step 4: Ampliar a prova da alçada**

Em `scripts/prova-alcada.mjs`, acrescentar ao final, antes do `browser.close()`:

```js
// Pela TELA, MEMBER não cadastra. Pelo NEXO, cria — e é de propósito: na tela
// alguém inventa um código, na auditoria o código é extraído do PDF.
await prisma.project.deleteMany({ where: { code: "777-26" } });
const peloNexo = await pVictor.request.post("/api/projects/por-centro-de-custo", {
  data: { code: "777-26", client: "CRICIÚMA", name: "Nascido da auditoria" },
});
check("MEMBER cria projeto pelo caminho da auditoria", peloNexo.status() === 201, `status ${peloNexo.status()}`);
const nascido = await prisma.project.findFirst({ where: { code: "777-26" } });
check("e ele nasce na PROSUL", nascido?.organizationId === "org-prosul", `${nascido?.organizationId}`);
await prisma.project.deleteMany({ where: { code: "777-26" } });
```

Run: `BASE=http://localhost:3001 SHOT_BASE=http://localhost:3001 npm run prova:alcada`
Expected: `OK  alcada`.

- [ ] **Step 5: Commit**

```bash
git add app/api/projects/ modules/nexo/lib/projeto-da-auditoria.ts scripts/prova-alcada.mjs
git commit -m "projeto: a pasta nasce do centro de custo lido no documento"
```

---

## Task 10: A prova de ponta a ponta

**Files:**
- Create: `scripts/prova-fila-de-achados.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: tudo acima; `entrarComo` de `scripts/lib/atores-de-teste.mjs`
- Produces: `npm run prova:fila`

- [ ] **Step 1: A prova**

```js
// scripts/prova-fila-de-achados.mjs
//
//   node scripts/prova-fila-de-achados.mjs   (== npm run prova:fila)
//
// O fluxo inteiro, com DUAS pessoas: Victor manda achados ao Milton, eles
// aparecem na home do Milton agrupados pelo projeto, e somem quando ele
// registra o desfecho.
//
// Semeia a auditoria direto no banco: disparar uma de verdade custaria minutos
// de modelo e não mediria nada do que esta prova mede.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const AUDIT_ID = "qa-fila-de-achados";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul", code: "063-26" },
  select: { id: true },
});
check("o 063-26 existe", Boolean(projeto), "rode npm run seed:dev");

const relatorio = {
  tipo_auditoria: "memorial",
  tipo_documento: "memorial",
  status_geral: "NAO_EMITIR",
  total_incongruencias: 2,
  incongruencias: [
    {
      id: "INC-001",
      prioridade: "Alta",
      pagina: "12",
      capitulo: "PPCI",
      local: "item 4.2",
      tipo: "Saída de emergência sem largura declarada",
      descricao: "Falta a largura.",
      evidencia: "a saída de emergência deverá atender ao previsto",
      conflito: "NBR 9077 exige largura mínima declarada",
      sugestao_correcao: "Declarar a largura.",
      confianca: "alta",
      impacto: "critico_documental",
    },
    {
      id: "INC-002",
      prioridade: "Media",
      pagina: "31",
      capitulo: "Estrutural",
      local: "tabela 7",
      tipo: "Tabela de cargas sem unidade",
      descricao: "Sem unidade.",
      evidencia: "carga acidental de 250 na laje de cobertura",
      conflito: "unidade ausente",
      sugestao_correcao: "Informar kN/m².",
      confianca: "alta",
      impacto: "tecnico_contratual",
    },
  ],
};

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.audit.create({
  data: {
    id: AUDIT_ID,
    projectId: projeto.id,
    title: "Memorial 063-26 — prova da fila",
    projectName: "063-26",
    auditMode: "memorial",
    status: "COMPLETED",
    report: relatorio,
    totalFindings: 2,
  },
});

const browser = await chromium.launch();

// --- Victor envia os dois achados ao Milton.
const ctxVictor = await browser.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
pVictor.setDefaultTimeout(25000);
await entrarComo(pVictor, "victor@prosul.com");

const envio = await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001", "INC-002"], assigneeEmail: "milton@prosul.com" },
});
check("Victor envia dois achados", envio.status() === 201, `status ${envio.status()}`);

const linhas = await prisma.auditFeedback.findMany({ where: { auditId: AUDIT_ID } });
check("viraram duas linhas", linhas.length === 2, `${linhas.length}`);
check(
  "e cada uma guarda a impressao digital",
  linhas.every((l) => Boolean(l.fingerprint)),
  linhas.map((l) => l.fingerprint).join(" | "),
);

// --- Milton vê na home dele.
const ctxMilton = await browser.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
pMilton.setDefaultTimeout(25000);
await entrarComo(pMilton, "milton@prosul.com");

const meu = await pMilton.request.get("/api/trabalho/meu");
const { pendencias } = await meu.json();
const doProjeto = (pendencias ?? []).find((p) => p.auditId === AUDIT_ID);
check("aparece na fila do Milton", Boolean(doProjeto), JSON.stringify(pendencias));
check("agrupado pelo projeto", doProjeto?.code === "063-26", doProjeto?.code);
check("com os dois achados", doProjeto?.total === 2, `${doProjeto?.total}`);

await pMilton.goto("/");
await pMilton.waitForLoadState("networkidle");
check(
  "e a home mostra o 063-26",
  await pMilton.getByText("063-26", { exact: false }).first().isVisible().catch(() => false),
);

// --- Decisão técnica sem nota é recusada pelo SERVIDOR.
const semNota = await pMilton.request.post(`/api/audits/${AUDIT_ID}/feedback`, {
  data: { findingId: "INC-001", resolutionKind: "ACCEPTED_RISK" },
});
check("decisao tecnica sem nota e recusada", semNota.status() === 400, `status ${semNota.status()}`);

// --- Milton resolve um.
const resolveu = await pMilton.request.post(`/api/audits/${AUDIT_ID}/feedback`, {
  data: { findingId: "INC-001", resolutionKind: "FIXED_IN_DOC" },
});
check("Milton registra o desfecho", resolveu.ok(), `status ${resolveu.status()}`);

const depois = await (await pMilton.request.get("/api/trabalho/meu")).json();
const restante = (depois.pendencias ?? []).find((p) => p.auditId === AUDIT_ID);
check("sobra um achado na fila dele", restante?.total === 1, `${restante?.total}`);

// --- Quem ENVIOU também resolve (decisão A.5 do spec).
const peloRemetente = await pVictor.request.post(`/api/audits/${AUDIT_ID}/feedback`, {
  data: { findingId: "INC-002", resolutionKind: "FALSE_POSITIVE" },
});
check("quem enviou tambem resolve", peloRemetente.ok(), `status ${peloRemetente.status()}`);

const falso = await prisma.auditFeedback.findFirst({
  where: { auditId: AUDIT_ID, findingId: "INC-002" },
});
check(
  "e o falso positivo marca os DOIS eixos",
  falso?.verdict === "FALSE_POSITIVE" && Boolean(falso?.resolvedAt),
  `verdict=${falso?.verdict} resolvedAt=${falso?.resolvedAt}`,
);

const vazia = await (await pMilton.request.get("/api/trabalho/meu")).json();
check(
  "a fila do Milton esvazia",
  !(vazia.pendencias ?? []).some((p) => p.auditId === AUDIT_ID),
);

// --- Mandar para quem nunca entrou.
await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
const paraConvidada = await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001"], assigneeEmail: "ana@prosul.com" },
});
check("da para enviar a quem nunca entrou", paraConvidada.status() === 201, `status ${paraConvidada.status()}`);

const ctxAna = await browser.newContext({ baseURL: BASE });
const pAna = await ctxAna.newPage();
pAna.setDefaultTimeout(25000);
await entrarComo(pAna, "ana@prosul.com");
const daAna = await (await pAna.request.get("/api/trabalho/meu")).json();
check(
  "e no primeiro login dela o achado esta la",
  (daAna.pendencias ?? []).some((p) => p.auditId === AUDIT_ID),
  JSON.stringify(daAna.pendencias),
);

// --- A home SEM pendência não vira tela vazia.
//
// É a metade que se esquece de medir: a home só se justifica por mostrar
// trabalho, e quem não tem nenhum precisa achar o caminho para auditar. Se esta
// asserção quebrar, a home virou a "parada no caminho" que o comentário de
// `app/page.tsx` diz para não criar.
await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });

const ctxSemNada = await browser.newContext({ baseURL: BASE });
const pSemNada = await ctxSemNada.newPage();
pSemNada.setDefaultTimeout(25000);
await entrarComo(pSemNada, "carla@prosul.com");
await pSemNada.goto("/");
await pSemNada.waitForLoadState("networkidle");

const semPendencia = await pSemNada.locator("body").innerText();
check("sem pendencia, a home nao mostra COM VOCE", !/COM VOC[EÊ]/i.test(semPendencia));
check(
  "e oferece o caminho para auditar",
  /nexo|auditar|auditoria/i.test(semPendencia),
  semPendencia.replace(/\s+/g, " ").slice(0, 120),
);

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await browser.close();
console.log(falhas === 0 ? "\nOK  fila de achados" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Step 2: Rodar até passar**

```bash
npm run seed:dev
BASE=http://localhost:3001 SHOT_BASE=http://localhost:3001 node scripts/prova-fila-de-achados.mjs
```
Expected: `OK  fila de achados`

- [ ] **Step 3: Registrar e commitar**

```json
"prova:fila": "node scripts/prova-fila-de-achados.mjs",
```

Acrescentar `prova:fila` ao `prova:substrato`, que passa a se chamar `prova:tudo`.

```bash
git add scripts/prova-fila-de-achados.mjs package.json
git commit -m "prova: o Milton recebe, ve na home, e o desfecho esvazia a fila"
```

---

## Fechamento

- [ ] **Rodar tudo**

```bash
npm run test:portao && npm run test:resolucao && npm run test:desfecho
BASE=http://localhost:3001 SHOT_BASE=http://localhost:3001 npm run prova:tudo
npm run build
npx eslint .
```
Expected: tudo verde. Prova antiga que quebre é sinal de que a fila mexeu em algo que ela media — entenda antes de corrigir a prova.

- [ ] **Atualizar o spec da revisão colaborativa**

Em `docs/arquitetura-revisao-colaborativa.md`, registrar na seção 27 que a fatia
fina foi construída sem `FindingOccurrence`, e que o gate de emissão continua
dependendo da materialização completa.

- [ ] **Commit final**

```bash
git commit -m "fila de achados: fechada, e o historico e a proxima fatia"
```
