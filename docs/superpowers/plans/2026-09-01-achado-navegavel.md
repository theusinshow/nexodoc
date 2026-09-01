# Achado navegável — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** fazer o achado ser conferível no documento por quem não estava lá —
o memorial passa a morar no servidor, e o link do e-mail leva à página do achado.

**Arquitetura:** os bytes do memorial já chegam ao servidor e são descartados por
`describeStoredFile`. A costura passa a guardá-los numa tabela `StoredFile`
chaveada pelo checksum. O palco tenta o IndexedDB local primeiro e cai para o
servidor. O link ganha `&achado=`, ligado à prop `achadoEmFoco` que já existe.

**Stack:** Next.js 15 (App Router), React 19, Prisma 7 + Postgres (Neon),
TypeScript, Playwright. Testes puros em **node cru** (`node scripts/x.ts`).

**Spec:** `docs/superpowers/specs/2026-09-01-achado-navegavel-design.md`

## Restrições globais

- **pt-BR em tudo que é visível e em todo comentário de código.**
- **Núcleo puro não importa o alias `@/`** — sem ele o arquivo não roda sob o
  type-stripping do node cru. Em `scripts/*.ts`, caminho relativo com `.ts`.
- **Script que importa `@/` roda com o hook:**
  `node --import ./scripts/lib/resolver-de-imports.mjs <script>`. Sem ele o erro
  é `Cannot find package '@/lib'`, que aponta para o import quando o problema é a
  ausência do resolvedor.
- **`npm run db:generate` depois de todo `prisma migrate dev`.** O banco ganha a
  coluna e o client tipado não; o sintoma é `Unknown argument`.
- **Reiniciar o `next dev` depois de migrar.** Ele segura o client Prisma antigo
  em memória e devolve `Cannot read properties of undefined`. `pkill` pode não
  alcançá-lo: pegue o PID com `netstat -ano | grep ":3000.*LISTENING"`.
- **Commit direto na `main`.** Sem branch, sem PR. `git add` com caminhos
  explícitos, conferindo com `git diff --cached --stat`.
- **Só o memorial auditado é guardado.** Pranchas e volumes ficam de fora.
- **404, nunca 403**, para arquivo de outro escritório.
- **Nenhum e-mail novo é disparado automaticamente.** Ver a Task 8.
- **Nenhuma tarefa gasta token de IA.**

## Mapa dos arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `lib/fonte-do-documento.ts` | Puro. Decide entre PDF local, do servidor, ou nenhum. |
| `lib/link-do-achado.ts` | Puro. Monta e lê `?auditoria=X&achado=Y`. |
| `scripts/test-fonte-do-documento.ts` | Teste puro. |
| `scripts/test-link-do-achado.ts` | Teste puro. |
| `app/api/arquivos/[checksum]/route.ts` | `GET` devolve os bytes, com escopo de escritório. |
| `scripts/prova-arquivo-guardado.mjs` | Prova de banco: dedupe, teto, escopo. |
| `scripts/prova-milton-abre-o-pdf.mjs` | Prova de navegador, duas pessoas. |
| `prisma/migrations/<ts>_arquivo_guardado/migration.sql` | Gerado. |

**Modificados**

| Arquivo | O quê |
|---|---|
| `prisma/schema.prisma` | `StoredFile`; `AuditFile.checksumSha256`. |
| `lib/file-storage.ts` | Ganha `guardarArquivo()` — o primeiro caminho de escrita. |
| `lib/project-files.ts` | `createStoredProjectUpload` aceita `organizationId` e grava. |
| `lib/audit-persistence.ts` | Passa `organizationId`; grava o checksum em `AuditFile`. |
| `app/api/audit/route.ts:4346` | Passa `organizationId: actor.organizationId`. |
| `app/api/audits/[id]/route.ts` | Devolve os arquivos com checksum. |
| `modules/nexo/lib/audit.ts` | `consultarAuditoria` carrega os arquivos. |
| `modules/nexo/components/PalcoDoNexo.tsx` | `memorialPdf` cai para o servidor. |
| `modules/nexo/components/use-abrir-auditoria-por-link.ts` | Lê `?achado=`. |
| `modules/nexo/components/NexoWorkspace.tsx` | Repassa o achado em foco. |
| `lib/aviso-de-achados.ts` | O link do e-mail leva ao achado. |
| `lib/achado-compartilhado.ts` | Comentar reabre o aviso para os outros. |
| `components/audit-result.tsx` | "Ver no documento" vira botão nomeado. |
| `package.json` | Quatro scripts novos. |

---

### Task 1: de onde vem o PDF (puro)

**Files:**
- Criar: `lib/fonte-do-documento.ts`
- Criar: `scripts/test-fonte-do-documento.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: nada.
- Produz:
  - `type FonteDoDocumento = { tipo: "local"; url: string } | { tipo: "servidor"; url: string } | { tipo: "ausente"; motivo: string }`
  - `fonteDoDocumento(args: { urlLocal: string | null; checksum: string | null }): FonteDoDocumento`

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-fonte-do-documento.ts`:

```ts
/**
 * DE ONDE VEM O PDF do memorial. Puro → node cru.
 *
 *   node scripts/test-fonte-do-documento.ts   (== npm run test:fonte-documento)
 */
import assert from "node:assert/strict";

import { fonteDoDocumento } from "../lib/fonte-do-documento.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("fonte do documento\n");

test("o LOCAL vence quando existe", () => {
  /*
   * Instantâneo e sem rede. Quem rodou a auditoria tem o memorial no
   * IndexedDB, e mandá-lo baixar 5 MB do servidor seria piorar o que já
   * funcionava.
   */
  const f = fonteDoDocumento({ urlLocal: "blob:abc", checksum: "abc123" });
  assert.equal(f.tipo, "local");
  assert.equal(f.tipo === "local" && f.url, "blob:abc");
});

test("sem local, cai para o SERVIDOR", () => {
  // É o caso que este trabalho existe para resolver: quem chegou pelo link do
  // e-mail nunca teve o memorial nesta máquina.
  const f = fonteDoDocumento({ urlLocal: null, checksum: "abc123" });
  assert.equal(f.tipo, "servidor");
  assert.equal(f.tipo === "servidor" && f.url, "/api/arquivos/abc123");
});

test("sem local e sem checksum, AUSENTE com motivo", () => {
  /*
   * A tela DIZ isso, em vez de esconder o botão: botão ausente não se
   * distingue de funcionalidade inexistente.
   */
  const f = fonteDoDocumento({ urlLocal: null, checksum: null });
  assert.equal(f.tipo, "ausente");
  assert.equal(
    f.tipo === "ausente" && f.motivo,
    "Este documento foi auditado antes de o sistema passar a guardá-lo.",
  );
});

test("checksum em branco é o mesmo que não ter", () => {
  assert.equal(fonteDoDocumento({ urlLocal: null, checksum: "" }).tipo, "ausente");
  assert.equal(fonteDoDocumento({ urlLocal: null, checksum: "   " }).tipo, "ausente");
});

test("url local em branco não vence nada", () => {
  const f = fonteDoDocumento({ urlLocal: "  ", checksum: "abc123" });
  assert.equal(f.tipo, "servidor");
});

test("checksum torto NÃO vira URL", () => {
  /*
   * O valor entra num caminho de URL. Um `../` aqui sairia do endpoint, e
   * confiar em `encodeURIComponent` sozinho seria confiar que ninguém nunca
   * troque a montagem. O formato é fechado: 64 hexadecimais.
   */
  for (const torto of ["../etc/passwd", "abc/def", "ZZZ", "abc123!"]) {
    assert.equal(
      fonteDoDocumento({ urlLocal: null, checksum: torto }).tipo,
      "ausente",
      torto,
    );
  }
});

test("checksum de 64 hex é aceito", () => {
  const bom = "a".repeat(64);
  const f = fonteDoDocumento({ urlLocal: null, checksum: bom });
  assert.equal(f.tipo, "servidor");
  assert.equal(f.tipo === "servidor" && f.url, `/api/arquivos/${bom}`);
});

console.log(`\n${passed} passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-fonte-do-documento.ts
```

Esperado: FALHA com `Cannot find module '.../lib/fonte-do-documento.ts'`.

- [ ] **Passo 3: escrever a implementação**

Criar `lib/fonte-do-documento.ts`:

```ts
/**
 * DE ONDE VEM O PDF do memorial — e o que dizer quando não vem de lugar nenhum.
 *
 * O `podeVerNoDocumento` do palco era `Boolean(report && memorialPdf)`, e
 * `memorialPdf` vinha só do IndexedDB DESTA máquina. Quem chegava pelo link do
 * e-mail não tinha memorial nenhum, e o botão simplesmente não existia — para a
 * pessoa para quem a funcionalidade foi pedida.
 *
 * A ORDEM É DELIBERADA. O local vem primeiro por ser instantâneo e não gastar
 * rede: quem rodou a auditoria não perde nada, e quem chegou de fora ganha o que
 * não tinha.
 *
 * PURO e sem imports → roda em node cru (`npm run test:fonte-documento`).
 */

/** 64 hexadecimais. O valor vira caminho de URL — ver `fonteDoDocumento`. */
const CHECKSUM = /^[a-f0-9]{64}$/i;

export type FonteDoDocumento =
  | { tipo: "local"; url: string }
  | { tipo: "servidor"; url: string }
  | { tipo: "ausente"; motivo: string };

export function fonteDoDocumento(args: {
  urlLocal: string | null;
  checksum: string | null;
}): FonteDoDocumento {
  const local = (args.urlLocal ?? "").trim();
  if (local) return { tipo: "local", url: local };

  const checksum = (args.checksum ?? "").trim();

  /*
   * O FORMATO É FECHADO, e não escapado.
   *
   * O valor entra num caminho de URL. Um `../` sairia do endpoint, e confiar
   * apenas em `encodeURIComponent` seria confiar que ninguém troque a montagem
   * depois. Recusar o que não é checksum não custa nada e não depende de quem
   * monta a string.
   */
  if (!CHECKSUM.test(checksum)) {
    return {
      tipo: "ausente",
      motivo: "Este documento foi auditado antes de o sistema passar a guardá-lo.",
    };
  }

  return { tipo: "servidor", url: `/api/arquivos/${checksum}` };
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node scripts/test-fonte-do-documento.ts
```

Esperado: 7 linhas `ok` e `7 passaram`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, dentro de `"scripts"`, depois de `"test:quem-avisar"`:

```json
"test:fonte-documento": "node scripts/test-fonte-do-documento.ts",
```

- [ ] **Passo 6: commit**

```bash
git add lib/fonte-do-documento.ts scripts/test-fonte-do-documento.ts package.json
git diff --cached --stat
git commit -m "o PDF passa a ter três procedências, e a ausência ganha frase"
```

---

### Task 2: o link até o achado (puro)

**Files:**
- Criar: `lib/link-do-achado.ts`
- Criar: `scripts/test-link-do-achado.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: nada.
- Produz:
  - `linkDoAchado(args: { base: string; auditId: string; findingId?: string | null }): string`
  - `lerLinkDoAchado(args: { auditoria: string | null; achado: string | null }): { auditId: string | null; findingId: string | null }`

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-link-do-achado.ts`:

```ts
/**
 * O LINK QUE VAI ATÉ O ACHADO — montar e ler. Puro → node cru.
 *
 *   node scripts/test-link-do-achado.ts   (== npm run test:link-achado)
 */
import assert from "node:assert/strict";

import { lerLinkDoAchado, linkDoAchado } from "../lib/link-do-achado.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("link do achado\n");

test("sem achado, é o link da auditoria — como sempre foi", () => {
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app", auditId: "aud-1" }),
    "https://nexodoc.app/nexo?auditoria=aud-1",
  );
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app", auditId: "aud-1", findingId: null }),
    "https://nexodoc.app/nexo?auditoria=aud-1",
  );
});

test("com achado, o link leva até ele", () => {
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app", auditId: "aud-1", findingId: "INC-014" }),
    "https://nexodoc.app/nexo?auditoria=aud-1&achado=INC-014",
  );
});

test("a barra sobrando na base não vira barra dupla", () => {
  assert.equal(
    linkDoAchado({ base: "https://nexodoc.app/", auditId: "aud-1" }),
    "https://nexodoc.app/nexo?auditoria=aud-1",
  );
});

test("os ids são escapados", () => {
  // O id vem do relatório da IA. Nunca viu um com `&`, e é exatamente por isso
  // que o dia em que vier não pode reescrever a query.
  const l = linkDoAchado({ base: "https://x.app", auditId: "a b", findingId: "c&d=e" });
  assert.equal(l, "https://x.app/nexo?auditoria=a%20b&achado=c%26d%3De");
});

test("ler devolve os dois quando os dois vêm", () => {
  assert.deepEqual(lerLinkDoAchado({ auditoria: "aud-1", achado: "INC-014" }), {
    auditId: "aud-1",
    findingId: "INC-014",
  });
});

test("achado SEM auditoria é ignorado", () => {
  /*
   * Focar um achado exige saber de qual parecer ele é. Aceitar o achado sozinho
   * faria a tela procurar um id numa auditoria que não abriu — e não achar nada,
   * sem dizer por quê.
   */
  assert.deepEqual(lerLinkDoAchado({ auditoria: null, achado: "INC-014" }), {
    auditId: null,
    findingId: null,
  });
});

test("id torto é descartado, e não propagado", () => {
  // Vira seletor CSS em `[data-achado="..."]`. Um valor livre ali é chance de
  // quebrar a consulta, e o formato do id é conhecido.
  assert.equal(lerLinkDoAchado({ auditoria: "aud-1", achado: "a b" }).findingId, null);
  assert.equal(lerLinkDoAchado({ auditoria: "aud-1", achado: "<x>" }).findingId, null);
  assert.equal(lerLinkDoAchado({ auditoria: "a b", achado: "INC-1" }).auditId, null);
});

test("vazio é nulo, e não string vazia", () => {
  assert.deepEqual(lerLinkDoAchado({ auditoria: "", achado: "" }), {
    auditId: null,
    findingId: null,
  });
});

console.log(`\n${passed} passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-link-do-achado.ts
```

Esperado: FALHA com `Cannot find module '.../lib/link-do-achado.ts'`.

- [ ] **Passo 3: escrever a implementação**

Criar `lib/link-do-achado.ts`:

```ts
/**
 * O LINK QUE VAI ATÉ O ACHADO.
 *
 * O e-mail levava a `/nexo?auditoria=<id>` e entregava o parecer inteiro — com
 * quarenta achados, o link cumpria metade da promessa: dizia onde, não o quê.
 *
 * Montar e ler moram no MESMO arquivo de propósito: são as duas pontas do mesmo
 * contrato, e separá-las é como o formato de um lado passa a divergir do outro
 * sem que nenhum teste perceba.
 *
 * PURO e sem imports → roda em node cru (`npm run test:link-achado`).
 */

/**
 * O formato dos dois ids. `auditId` é uuid ou cuid; `findingId` é `INC-014`.
 *
 * Fechar o formato importa na LEITURA: o `findingId` vira seletor em
 * `[data-achado="..."]` (ver `audit-result.tsx`), e o `auditId` vira caminho de
 * requisição. Um valor livre em qualquer um dos dois é chance de quebrar a
 * consulta ou a rota — e o formato real é conhecido e estreito.
 */
const ID = /^[A-Za-z0-9_-]{1,80}$/;

export function linkDoAchado(args: {
  base: string;
  auditId: string;
  findingId?: string | null;
}): string {
  const base = args.base.replace(/\/+$/, "");
  const achado = (args.findingId ?? "").trim();
  const query = `auditoria=${encodeURIComponent(args.auditId)}`;

  return achado
    ? `${base}/nexo?${query}&achado=${encodeURIComponent(achado)}`
    : `${base}/nexo?${query}`;
}

export function lerLinkDoAchado(args: {
  auditoria: string | null;
  achado: string | null;
}): { auditId: string | null; findingId: string | null } {
  const auditoria = (args.auditoria ?? "").trim();
  const achado = (args.achado ?? "").trim();

  const auditId = ID.test(auditoria) ? auditoria : null;

  /*
   * SEM AUDITORIA NÃO HÁ ACHADO. Focar um achado exige saber de qual parecer ele
   * é; aceitá-lo sozinho faria a tela procurar um id numa auditoria que nunca
   * abriu — e não achar nada, sem dizer por quê.
   */
  if (!auditId) return { auditId: null, findingId: null };

  return { auditId, findingId: ID.test(achado) ? achado : null };
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node scripts/test-link-do-achado.ts
```

Esperado: 8 linhas `ok` e `8 passaram`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, depois de `"test:fonte-documento"`:

```json
"test:link-achado": "node scripts/test-link-do-achado.ts",
```

- [ ] **Passo 6: commit**

```bash
git add lib/link-do-achado.ts scripts/test-link-do-achado.ts package.json
git diff --cached --stat
git commit -m "o link ganha o achado, e as duas pontas do contrato moram juntas"
```

---

### Task 3: a tabela do arquivo guardado

**Files:**
- Modificar: `prisma/schema.prisma`
- Criar: `prisma/migrations/<timestamp>_arquivo_guardado/migration.sql` (gerado)

**Interfaces:**
- Consome: nada.
- Produz: `StoredFile` e `AuditFile.checksumSha256`.

- [ ] **Passo 1: declarar a tabela**

Ao fim de `prisma/schema.prisma`:

```prisma
/// O ARQUIVO, de verdade — os bytes.
///
/// `lib/file-storage.ts` existia desde sempre e NUNCA gravou nada: 64 linhas que
/// calculam chave, checksum e URL, e devolvem `storageProvider: "none"`. Os
/// bytes do memorial chegavam ao servidor (`audit-persistence` passa
/// `file.buffer`) e eram descartados. Resultado: quem recebia um achado por
/// e-mail não tinha como conferi-lo no documento — e uma auditoria que não se
/// pode conferir é uma afirmação.
///
/// POSTGRES, E NÃO S3. Decidido em 01/09/2026 sabendo do custo: sem vendor novo,
/// sem credencial nova, no mesmo backup do resto. `file-storage.ts` continua
/// sendo a costura, então trocar de provedor depois não é reescrever.
///
/// SÓ O MEMORIAL AUDITADO. Pranchas e volumes ficam de fora, e é o que segura o
/// custo: memorial real tem 1,6 a 5,2 MB; um volume passa de 20 MB com 88% de
/// JPEG.
model StoredFile {
  /// A CHAVE É O CONTEÚDO. Reauditar o mesmo memorial não grava de novo, e
  /// `ProjectUpload.checksumSha256` já é calculado e já aponta para cá.
  ///
  /// Cinco revisões assinadas do mesmo memorial são cinco arquivos DIFERENTES e
  /// ocupam cinco vagas — é o comportamento certo: o parecer de cada uma cita
  /// as páginas da sua.
  checksumSha256 String   @id
  /// O escopo de quem pode ler, na mesma régua de [[lib/audit-access.ts]].
  organizationId String
  mimeType       String
  sizeBytes      Int
  bytes          Bytes
  createdAt      DateTime @default(now())

  /// Sustenta a regra de expurgo no dia em que ela existir. Não há nenhuma hoje.
  @@index([organizationId, createdAt])
}
```

- [ ] **Passo 2: o achado precisa saber qual arquivo abrir**

Em `model AuditFile`, logo depois de `sizeBytes`:

```prisma
  /// O ARQUIVO GUARDADO a que esta linha se refere — a chave de [[StoredFile]].
  ///
  /// Fica aqui, e não numa consulta ao `ProjectUpload` por `metadata->>'auditId'`:
  /// `AuditFile` já É a lista dos arquivos desta auditoria, e amarrar a busca a
  /// uma chave dentro de um JSON faria a tela depender de um formato que nada
  /// garante.
  ///
  /// Nulo nas auditorias anteriores a este trabalho — os bytes delas não foram
  /// guardados, e a tela diz isso em vez de esconder o botão.
  checksumSha256     String?
```

- [ ] **Passo 3: gerar a migração e o client**

```bash
npx prisma validate
npm run db:migrate:dev -- --name arquivo_guardado
npm run db:generate
```

Se pendurar com `P1002`, rode `npm run db:destravar` e repita.

- [ ] **Passo 4: conferir o SQL — nenhum `DROP`**

```bash
cat prisma/migrations/*_arquivo_guardado/migration.sql
grep -ci drop prisma/migrations/*_arquivo_guardado/migration.sql
```

Esperado: um `CREATE TABLE "StoredFile"` com `bytes BYTEA NOT NULL`, um
`CREATE INDEX`, um `ALTER TABLE "AuditFile" ADD COLUMN "checksumSha256" TEXT`, e
a contagem de `drop` igual a `0`. Qualquer `DROP` significa que o schema local
divergiu do banco — **pare**.

- [ ] **Passo 5: reiniciar o `next dev`**

```bash
netstat -ano | grep ":3000.*LISTENING"
```

Mate o PID que aparecer (`taskkill //F //PID <pid>`) e suba de novo com
`NEXODOC_DEV_AUTH=true npm run dev`. **Não pule:** o servidor segura o client
Prisma antigo e as rotas novas devolvem
`Cannot read properties of undefined (reading 'findUnique')` — um erro que aponta
para o código quando o problema é o processo velho.

- [ ] **Passo 6: commit**

```bash
git add prisma/schema.prisma prisma/migrations
git diff --cached --stat
git commit -m "os bytes ganham onde morar: a tabela do arquivo guardado"
```

---

### Task 4: o primeiro caminho de escrita

**Files:**
- Modificar: `lib/file-storage.ts`
- Modificar: `lib/project-files.ts`
- Modificar: `lib/audit-persistence.ts`
- Modificar: `app/api/audit/route.ts:4346`
- Criar: `scripts/prova-arquivo-guardado.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: `StoredFile` (Task 3).
- Produz:
  - `class ArquivoRecusado extends Error { readonly motivo: string }`
  - `guardarArquivo(args: { data: Buffer | Uint8Array | string; organizationId: string; mimeType: string }): Promise<{ checksumSha256: string; sizeBytes: number }>`
  - `LIMITE_DO_ARQUIVO = 25_000_000`

- [ ] **Passo 1: escrever a prova que falha**

Criar `scripts/prova-arquivo-guardado.mjs`:

```js
// O ARQUIVO GUARDADO, provado contra o banco.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-arquivo-guardado.mjs
//   (== npm run prova:arquivo)
//
// Três perguntas que só o banco responde:
//   1. gravar o mesmo conteúdo duas vezes duplica?
//   2. arquivo grande demais é recusado COM MOTIVO, ou estoura mais fundo?
//   3. os bytes voltam byte a byte?
//
// SEM IA e SEM NAVEGADOR.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { guardarArquivo, ArquivoRecusado, LIMITE_DO_ARQUIVO } = await import(
  "../lib/file-storage.ts"
);

const prisma = getPrisma();
const ORG = "org-prosul";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const conteudo = Buffer.from("%PDF-1.7 memorial de prova\n".repeat(500), "utf8");

// 1. Grava.
const primeiro = await guardarArquivo({
  data: conteudo,
  organizationId: ORG,
  mimeType: "application/pdf",
});
check("gravou e devolveu o checksum", /^[a-f0-9]{64}$/.test(primeiro.checksumSha256));
check("o tamanho confere", primeiro.sizeBytes === conteudo.byteLength);

// 2. Grava o MESMO conteúdo de novo.
const segundo = await guardarArquivo({
  data: conteudo,
  organizationId: ORG,
  mimeType: "application/pdf",
});
check("o mesmo conteúdo dá o MESMO checksum", segundo.checksumSha256 === primeiro.checksumSha256);

const quantos = await prisma.storedFile.count({
  where: { checksumSha256: primeiro.checksumSha256 },
});
check("gravar duas vezes NÃO duplica", quantos === 1, `achei ${quantos}`);

// 3. Os bytes voltam iguais.
const lido = await prisma.storedFile.findUniqueOrThrow({
  where: { checksumSha256: primeiro.checksumSha256 },
  select: { bytes: true, mimeType: true, organizationId: true },
});
check("os bytes voltam byte a byte", Buffer.from(lido.bytes).equals(conteudo));
check("o mime e o escritório vieram junto", lido.mimeType === "application/pdf" && lido.organizationId === ORG);

// 4. Grande demais é RECUSADO com motivo.
let recusa = null;
try {
  await guardarArquivo({
    data: Buffer.alloc(LIMITE_DO_ARQUIVO + 1),
    organizationId: ORG,
    mimeType: "application/pdf",
  });
} catch (err) {
  recusa = err;
}
check("arquivo acima do teto é recusado", recusa instanceof ArquivoRecusado);
check(
  "e a recusa DIZ o porquê, com os dois números",
  Boolean(recusa?.motivo?.includes("MB")),
  recusa?.motivo,
);

await prisma.storedFile.deleteMany({ where: { checksumSha256: primeiro.checksumSha256 } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-arquivo-guardado.mjs
```

Esperado: FALHA — `guardarArquivo is not a function`.

- [ ] **Passo 3: escrever o caminho de escrita**

Em `lib/file-storage.ts`, acrescentar ao topo:

```ts
import { getPrisma } from "@/lib/db";
```

E ao fim do arquivo:

```ts
/**
 * O TETO POR ARQUIVO.
 *
 * Memorial real tem 1,6 a 5,2 MB (medido em `docs/samples`). 25 MB é folga
 * generosa para o caso torto sem deixar um arquivo qualquer entrar. O que ele
 * evita não é o custo — é estourar em algum lugar mais fundo, sem motivo que
 * chegue a quem tentou.
 */
export const LIMITE_DO_ARQUIVO = 25_000_000;

export class ArquivoRecusado extends Error {
  /*
   * Campo declarado e atribuído à mão, e não propriedade de parâmetro: o node
   * roda os scripts em modo strip-only, que apaga tipos sem transformar sintaxe.
   * Mesmo motivo de `AchadoRecusado` em [[achado-compartilhado.ts]].
   */
  readonly motivo: string;

  constructor(motivo: string) {
    super(motivo);
    this.name = "ArquivoRecusado";
    this.motivo = motivo;
  }
}

/**
 * GUARDA OS BYTES — o primeiro caminho de escrita que este módulo já teve.
 *
 * `describeStoredFile`, acima, só descreve: calcula chave e checksum e devolve
 * `provider: "none"`. Era um esqueleto para um provedor que nunca foi
 * construído, e por isso o memorial chegava ao servidor e era descartado.
 *
 * IDEMPOTENTE POR CONSTRUÇÃO: a chave primária é o checksum, então gravar o
 * mesmo conteúdo duas vezes é `update` de nada. Não há "já existe?" a perguntar
 * antes — e é isso que faz duas pessoas auditando o mesmo memorial ao mesmo
 * tempo não virar um erro de banco.
 */
export async function guardarArquivo(args: {
  data: StorableData;
  organizationId: string;
  mimeType: string;
}): Promise<{ checksumSha256: string; sizeBytes: number }> {
  const buffer = toBuffer(args.data);

  if (buffer.byteLength > LIMITE_DO_ARQUIVO) {
    const tamanho = (buffer.byteLength / 1_000_000).toFixed(1);
    const teto = (LIMITE_DO_ARQUIVO / 1_000_000).toFixed(0);
    throw new ArquivoRecusado(
      `Arquivo grande demais: ${tamanho} MB (teto ${teto} MB).`,
    );
  }

  const checksumSha256 = getChecksumSha256(buffer);

  await getPrisma().storedFile.upsert({
    where: { checksumSha256 },
    create: {
      checksumSha256,
      organizationId: args.organizationId,
      mimeType: args.mimeType,
      sizeBytes: buffer.byteLength,
      bytes: buffer,
    },
    /*
     * Nada. O conteúdo é a chave — se o checksum bate, os bytes são os mesmos, e
     * reescrever 5 MB para gravar o que já está lá seria trabalho por nada.
     */
    update: {},
  });

  return { checksumSha256, sizeBytes: buffer.byteLength };
}
```

- [ ] **Passo 4: rodar a prova e ver passar**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-arquivo-guardado.mjs
```

Esperado: 8 linhas `OK` e `prova passou`.

- [ ] **Passo 5: ligar a costura que já recebe os bytes**

Em `lib/project-files.ts`, na assinatura de `createStoredProjectUpload`,
acrescentar ao objeto `input`:

```ts
    /**
     * O ESCRITÓRIO DONO DOS BYTES. Quando vem, o arquivo é GUARDADO de verdade;
     * quando não vem, o comportamento é o de sempre — só metadados.
     *
     * Explícito, e não deduzido do `projectId`: guardar 5 MB é decisão de quem
     * chama, e uma busca implícita faria isso acontecer em caminhos que nunca
     * pediram.
     */
    organizationId?: string | null;
```

E o corpo passa a ser:

```ts
export async function createStoredProjectUpload(
  tx: UploadTx,
  input: {
    data: StorableData;
    projectId?: string | null;
    organizationId?: string | null;
    actor: ActorIdentity;
    module: string;
    source?: string;
    fileName: string;
    mimeType: string;
    pageCount?: number | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const { data, organizationId, ...upload } = input;
  const storage = describeStoredFile({
    data,
    module: upload.module,
    projectId: upload.projectId,
    fileName: upload.fileName,
  });

  /*
   * OS BYTES, quando há escritório para respondê-los.
   *
   * Fora da transação de propósito: um arquivo de 5 MB dentro da transação que
   * grava o parecer manteria o lock aberto pelo tempo do upload, e o parecer é o
   * que não pode falhar. Se isto falhar, a auditoria continua gravada e o botão
   * "ver no documento" apenas não aparece — degradação, não perda.
   */
  const guardado = organizationId
    ? await guardarArquivo({ data, organizationId, mimeType: upload.mimeType })
    : null;

  return createProjectUpload(tx, {
    ...upload,
    ...storage,
    ...(guardado
      ? { storageProvider: "postgres", storageKey: guardado.checksumSha256 }
      : {}),
  });
}
```

E o import no topo de `lib/project-files.ts`:

```ts
import { describeStoredFile, guardarArquivo } from "@/lib/file-storage";
```

- [ ] **Passo 6: a auditoria passa o escritório e grava o checksum**

Em `lib/audit-persistence.ts`, na assinatura de `persistCompletedAudit`,
acrescentar depois de `projectId`:

```ts
  organizationId?: string | null;
```

No `createMany` de `auditFile`, acrescentar o checksum. Substituir o bloco por:

```ts
      await transaction.auditFile.deleteMany({ where: { auditId: args.auditId! } });
      await transaction.auditFile.createMany({
        data: args.uploadedFiles.map((file) => ({
          auditId: args.auditId!,
          fileName: file.file.name,
          documentType: file.fileType,
          pageCount: file.extracted.pageCount,
          extractedCharCount: file.extracted.charCount,
          sizeBytes: file.file.size,
          /*
           * O checksum é calculado do MESMO buffer que vai para `StoredFile`, e
           * não de uma segunda leitura: dois cálculos são duas chances de
           * divergir, e a divergência aqui daria um botão que aponta para um
           * arquivo que não existe.
           */
          checksumSha256: getChecksumSha256(file.buffer),
        })),
      });
```

E o import correspondente no topo:

```ts
import { getChecksumSha256 } from "@/lib/project-store";
```

Na chamada a `createStoredProjectUpload` (dentro do `if (args.projectId && args.actor)`),
acrescentar:

```ts
            organizationId: args.organizationId,
```

- [ ] **Passo 7: a rota passa o escritório**

Em `app/api/audit/route.ts`, na chamada a `persistCompletedAudit` (por volta da
linha 4346), acrescentar depois de `projectId,`:

```ts
      organizationId: actor.organizationId,
```

`actor` já está no escopo — é o mesmo usado em `listAuditLearnings` na linha 3787.

- [ ] **Passo 8: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint lib/file-storage.ts lib/project-files.ts lib/audit-persistence.ts app/api/audit/route.ts
```

- [ ] **Passo 9: commit**

```bash
git add lib/file-storage.ts lib/project-files.ts lib/audit-persistence.ts \
  app/api/audit/route.ts scripts/prova-arquivo-guardado.mjs package.json
git diff --cached --stat
git commit -m "file-storage grava pela primeira vez, na costura que já recebia os bytes"
```

Antes do commit, registre o script em `package.json`, depois de
`"prova:conversa-achado"`:

```json
"prova:arquivo": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-arquivo-guardado.mjs",
```

---

### Task 5: a rota que devolve o arquivo

**Files:**
- Criar: `app/api/arquivos/[checksum]/route.ts`

**Interfaces:**
- Consome: `StoredFile` (Task 3); `requireActor` de `lib/access-control`.
- Produz: `GET /api/arquivos/<checksum>` → os bytes, ou 404.

- [ ] **Passo 1: escrever a rota**

Criar `app/api/arquivos/[checksum]/route.ts`:

```ts
/**
 * O ARQUIVO GUARDADO — os bytes, para quem tem direito a eles.
 *
 * É esta rota que faz o achado ser conferível por quem não estava lá. Antes
 * dela, `podeVerNoDocumento` dependia do IndexedDB da própria máquina, e o botão
 * não existia justamente para quem recebeu o achado por e-mail.
 *
 * 404, E NUNCA 403, para arquivo de outro escritório. "Existe, mas não é seu" já
 * entrega que existe — e um checksum é adivinhável por quem tem o arquivo, o que
 * transformaria a resposta num oráculo de "este documento passou por aqui".
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const CHECKSUM = /^[a-f0-9]{64}$/i;

function naoEncontrado() {
  return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ checksum: string }> },
) {
  try {
    const actor = await requireActor();
    const { checksum } = await params;

    if (!isDatabaseConfigured() || !CHECKSUM.test(checksum)) {
      return naoEncontrado();
    }

    /*
     * O ESCRITÓRIO ENTRA NA CONSULTA, e não numa comparação depois.
     *
     * Buscar por checksum e conferir a organização em seguida é a mesma coisa
     * até o dia em que alguém acrescenta um `early return` no meio. Aqui não há
     * meio: ou a linha é do escritório de quem pede, ou ela não existe.
     */
    const arquivo = await getPrisma().storedFile.findFirst({
      where: {
        checksumSha256: checksum.toLowerCase(),
        organizationId: actor.organizationId,
      },
      select: { bytes: true, mimeType: true, sizeBytes: true },
    });

    if (!arquivo) return naoEncontrado();

    return new NextResponse(Buffer.from(arquivo.bytes), {
      headers: {
        "Content-Type": arquivo.mimeType,
        "Content-Length": String(arquivo.sizeBytes),
        /*
         * `inline`: o visor de PDF do parecer o abre dentro da tela, e
         * `attachment` faria o navegador baixá-lo em vez de mostrá-lo.
         */
        "Content-Disposition": "inline",
        /*
         * IMUTÁVEL, e por um ano: a chave É o conteúdo. Um checksum nunca passa
         * a apontar para outros bytes, então revalidar seria pagar rede para
         * confirmar o que a chave já garante.
         *
         * `private` porque o conteúdo é do escritório — cache compartilhado o
         * serviria a quem a consulta acima recusaria.
         */
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
```

- [ ] **Passo 2: provar que nenhuma rota ficou aberta**

```bash
npm run prova:rotas
```

Esperado: `OK  nenhuma rota aberta`.

- [ ] **Passo 3: provar o escopo contra o servidor**

Com o `next dev` de pé (reiniciado após a Task 3), semeie um arquivo de outro
escritório e confirme o 404. Crie `scratchpad/qa-escopo.mjs`:

```js
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { entrarComo } from "../scripts/lib/atores-de-teste.mjs";
nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");
const { guardarArquivo } = await import("../lib/file-storage.ts");
const p = getPrisma();

const meu = await guardarArquivo({
  data: Buffer.from("meu memorial"), organizationId: "org-prosul", mimeType: "application/pdf",
});
const alheio = await guardarArquivo({
  data: Buffer.from("memorial de outro escritorio"), organizationId: "org-outra", mimeType: "application/pdf",
});

const b = await chromium.launch();
const ctx = await b.newContext({ baseURL: "http://localhost:3000" });
const pg = await ctx.newPage();
await entrarComo(pg, "victor@prosul.com");
const r = await pg.evaluate(async ([a, c]) => {
  const meu = await fetch(`/api/arquivos/${a}`);
  const alheio = await fetch(`/api/arquivos/${c}`);
  const torto = await fetch("/api/arquivos/nao-e-checksum");
  return { meu: meu.status, alheio: alheio.status, torto: torto.status,
           tipo: meu.headers.get("content-type"), corpo: await alheio.text() };
}, [meu.checksumSha256, alheio.checksumSha256]);
console.log("o meu           :", r.meu, "(esperado 200)", r.tipo);
console.log("o do outro      :", r.alheio, "(esperado 404)");
console.log("checksum torto  :", r.torto, "(esperado 404)");
console.log("o corpo do 404 nao entrega que existe:", !r.corpo.includes("outro"));
await b.close();
await p.storedFile.deleteMany({ where: { checksumSha256: { in: [meu.checksumSha256, alheio.checksumSha256] } } });
```

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scratchpad/qa-escopo.mjs
```

Esperado: `200`, `404`, `404`, e `true`. Apague o script depois — é rascunho.

- [ ] **Passo 4: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint "app/api/arquivos"
```

- [ ] **Passo 5: commit**

```bash
git add "app/api/arquivos"
git diff --cached --stat
git commit -m "o documento passa a ter endereço, e o de fora recebe 404 e não 403"
```

---

### Task 6: o palco cai para o servidor

**Files:**
- Modificar: `app/api/audits/[id]/route.ts`
- Modificar: `modules/nexo/lib/audit.ts`
- Modificar: `modules/nexo/components/PalcoDoNexo.tsx`

**Interfaces:**
- Consome: `fonteDoDocumento` (Task 1); a rota da Task 5.
- Produz: `consultarAuditoria` passa a devolver
  `arquivos: { fileName: string; checksumSha256: string | null }[]` dentro de
  `resultado`.

- [ ] **Passo 1: a consulta devolve os arquivos**

Em `app/api/audits/[id]/route.ts`, trocar o `select` e o corpo da resposta:

```ts
      select: {
        status: true,
        report: true,
        result: true,
        error: true,
        /*
         * OS ARQUIVOS, para o parecer saber qual documento abrir. Quem chega
         * pelo link do e-mail não tem o memorial nesta máquina, e o checksum é
         * o que o leva até `/api/arquivos/<checksum>`.
         */
        files: { select: { fileName: true, checksumSha256: true } },
      },
    });

    if (!audit) {
      return NextResponse.json({ status: "DESCONHECIDA" }, { status: 404 });
    }

    return NextResponse.json({
      status: audit.status,
      report: (audit.report as AuditReport | null) ?? null,
      result: audit.result ?? "",
      error: audit.error ?? null,
      arquivos: audit.files,
    });
```

- [ ] **Passo 2: o cliente carrega os arquivos**

Em `modules/nexo/lib/audit.ts`, no tipo do corpo lido por `consultarAuditoria`,
acrescentar `arquivos`, e no desfecho `pronta` incluí-los:

```ts
      resultado: {
        report: corpo.report,
        texto: corpo.result ?? "",
        auditId,
        arquivos: corpo.arquivos ?? [],
      },
```

E acrescentar o campo à interface `MemorialAuditResult`
(`modules/nexo/lib/audit.ts:40`), depois de `auditId`:

```ts
  /**
   * Os arquivos auditados, com a chave do que está guardado no servidor.
   *
   * OPCIONAL, e é o caso comum estar ausente: `postAudit` devolve o que
   * `/api/audit` responde (`result`, `report`, `auditId`), e quem acabou de
   * rodar a auditoria tem o memorial no IndexedDB de qualquer forma. Quem
   * precisa disto é quem chega por `consultarAuditoria` — pelo link do e-mail,
   * sem o arquivo na máquina.
   *
   * Ausente também nos artefatos gravados ANTES deste trabalho. `fonteDoDocumento`
   * trata os dois casos do mesmo jeito, e a tela diz o motivo.
   */
  arquivos?: { fileName: string; checksumSha256: string | null }[];
```

**Por que isso chega ao palco:** `use-abrir-auditoria-por-link` grava
`resposta.resultado` inteiro como `payload` do artefato, e o palco lê esse
payload em `salvo` (`PalcoDoNexo.tsx:135`). O campo viaja junto sem mais nenhuma
fiação.

- [ ] **Passo 3: o palco tenta o local, depois o servidor**

Em `modules/nexo/components/PalcoDoNexo.tsx`, acrescentar o import:

```tsx
import { fonteDoDocumento } from "@/lib/fonte-do-documento";
```

Substituir o efeito que monta `memorialPdf` (por volta da linha 88) por:

```tsx
  useEffect(() => {
    let url: string | null = null;
    let vivo = true;
    void recuperarMemorial().then((guardado) => {
      if (!vivo || !guardado) return;
      url = URL.createObjectURL(guardado.file);
      setMemorialPdf({ name: guardado.file.name, url });
    });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [recuperarMemorial]);

  /*
   * O DOCUMENTO, LOCAL OU DO SERVIDOR.
   *
   * O local vem primeiro por ser instantâneo e não gastar rede — quem rodou a
   * auditoria não perde nada. Quem chegou pelo link do e-mail nunca teve o
   * memorial nesta máquina, e é para essa pessoa que o degrau do servidor
   * existe: era ela quem não tinha botão nenhum.
   *
   * A escolha é PURA e mora em [[lib/fonte-do-documento.ts]], com teste que roda
   * sem navegador.
   */
  const doServidor = salvo?.arquivos?.find((a) => a.checksumSha256) ?? null;
  const fonte = fonteDoDocumento({
    urlLocal: memorialPdf?.url ?? null,
    checksum: doServidor?.checksumSha256 ?? null,
  });
  const documento =
    fonte.tipo === "ausente"
      ? null
      : {
          name: memorialPdf?.name ?? doServidor?.fileName ?? "memorial.pdf",
          url: fonte.url,
        };
```

Trocar as duas linhas que usavam `memorialPdf` diretamente:

```tsx
  const podeVerNoDocumento = Boolean(report && documento);
```

e, no `<AuditResult>`:

```tsx
        pdfSources={documento ? [documento] : []}
        /* Por que o botão não aparece, quando não aparece. Botão ausente não se
         * distingue de funcionalidade inexistente. */
        motivoSemDocumento={fonte.tipo === "ausente" ? fonte.motivo : undefined}
```

- [ ] **Passo 4: o parecer conta o motivo**

Em `components/audit-result.tsx`, acrescentar a prop ao tipo do componente, junto
de `pdfSources`:

```tsx
  /** Por que não há documento para abrir. Só quando não há. */
  motivoSemDocumento?: string;
```

E, no cabeçalho onde a vista "No documento" é oferecida, mostrar a frase quando
ela vier — ao lado do controle, em `text-[11.5px] text-muted-foreground`:

```tsx
              {motivoSemDocumento ? (
                <span className="text-[11.5px] text-muted-foreground">
                  {motivoSemDocumento}
                </span>
              ) : null}
```

- [ ] **Passo 5: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint modules/nexo/components/PalcoDoNexo.tsx modules/nexo/lib/audit.ts \
  components/audit-result.tsx "app/api/audits/[id]/route.ts"
```

- [ ] **Passo 6: commit**

```bash
git add "app/api/audits/[id]/route.ts" modules/nexo/lib/audit.ts \
  modules/nexo/components/PalcoDoNexo.tsx components/audit-result.tsx
git diff --cached --stat
git commit -m "o memorial deixa de depender da máquina de quem auditou"
```

---

### Task 7: o link leva até o achado

**Files:**
- Modificar: `modules/nexo/components/use-abrir-auditoria-por-link.ts`
- Modificar: `modules/nexo/components/NexoWorkspace.tsx`
- Modificar: `modules/nexo/components/PalcoDoNexo.tsx`

**Interfaces:**
- Consome: `lerLinkDoAchado` (Task 2).
- Produz: `useAbrirAuditoriaPorLink` passa a receber
  `{ auditoria: string | null; achado: string | null }` e a devolver
  `achadoEmFoco: string | null` junto do que já devolve.

- [ ] **Passo 1: o gancho lê os dois parâmetros**

Em `modules/nexo/components/use-abrir-auditoria-por-link.ts`, acrescentar o
import:

```ts
import { lerLinkDoAchado } from "@/lib/link-do-achado";
```

Trocar a assinatura e o começo:

```ts
export function useAbrirAuditoriaPorLink(params: {
  auditoria: string | null;
  achado: string | null;
}): AberturaPorLink {
  const { getResult, saveResult } = useConversation();

  /*
   * OS DOIS PARÂMETROS, lidos pela MESMA regra que monta o link no e-mail
   * ([[lib/link-do-achado.ts]]). Achado sem auditoria é descartado: focar um
   * achado exige saber de qual parecer ele é.
   */
  const { auditId, findingId } = lerLinkDoAchado(params);
```

E, no corpo, trocar todo uso de `auditId` que antes vinha do argumento — o nome
já é o mesmo, então não há outra troca a fazer. No `return`, acrescentar:

```ts
    /*
     * O ACHADO A FOCAR. Só faz sentido depois de o parecer abrir, e por isso
     * acompanha `abriu` — mandá-lo antes faria a tela procurar um cartão que
     * ainda não existe.
     */
    achadoEmFoco: findingId,
```

E ao tipo `AberturaPorLink`:

```ts
  /** O achado que o link pediu, ou nulo. */
  achadoEmFoco: string | null;
```

- [ ] **Passo 2: o workspace passa o parâmetro novo**

Em `modules/nexo/components/NexoWorkspace.tsx:1284` a chamada é hoje:

```tsx
  const aberturaPorLink = useAbrirAuditoriaPorLink(
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("auditoria"),
  );
```

Substituir por:

```tsx
  const aberturaPorLink = useAbrirAuditoriaPorLink(
    typeof window === "undefined"
      ? { auditoria: null, achado: null }
      : (() => {
          const q = new URLSearchParams(window.location.search);
          return { auditoria: q.get("auditoria"), achado: q.get("achado") };
        })(),
  );
```

**A guarda de `window` fica.** Este componente renderiza no servidor antes de
hidratar, e `window.location` ali é `ReferenceError` — o comentário logo acima da
chamada explica por que o gancho mora neste arquivo e não no palco.

- [ ] **Passo 3: o palco leva o foco ao parecer**

Em `modules/nexo/components/PalcoDoNexo.tsx`, no `<AuditResult>`, passar:

```tsx
        achadoEmFoco={aberturaPorLink.achadoEmFoco ?? undefined}
```

`AuditResult` já sabe o que fazer com isso: troca para a aba Achados, rola até o
cartão e o faz piscar uma vez (`audit-result.tsx:1224`).

- [ ] **Passo 4: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint modules/nexo/components/use-abrir-auditoria-por-link.ts \
  modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/PalcoDoNexo.tsx
```

- [ ] **Passo 5: commit**

```bash
git add modules/nexo/components/use-abrir-auditoria-por-link.ts \
  modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/PalcoDoNexo.tsx
git diff --cached --stat
git commit -m "o link para de entregar o parecer inteiro e passa a abrir o achado"
```

---

### Task 8: o e-mail leva ao achado, e a resposta reabre o aviso

**Files:**
- Modificar: `lib/aviso-de-achados.ts`
- Modificar: `lib/achado-compartilhado.ts`

**Interfaces:**
- Consome: `linkDoAchado` (Task 2).
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: o corpo do e-mail monta o link com o achado**

Em `lib/aviso-de-achados.ts`, acrescentar o import:

```ts
import { linkDoAchado } from "@/lib/link-do-achado";
```

`corpoDoAviso` recebe a pessoa e o contexto. Acrescentar ao tipo `PessoaAAvisar`:

```ts
  /**
   * O achado a abrir quando a pessoa tem UM só. Com dois ou mais o link leva ao
   * parecer, porque escolher um deles por ela seria esconder os outros.
   */
  achadoUnico?: string | null;
```

Em `corpoDoAviso`, trocar a montagem do link (linha ~233):

```ts
  const link = linkDoAchado({
    base,
    auditId: contexto.auditId,
    findingId: pessoa.quantidade === 1 ? pessoa.achadoUnico : null,
  });
```

E, em `comNomes`, propagar o achado único. `quemAvisar` devolve
`{ email, quantidade }`; para saber QUAL achado, `pessoasPendentes` já tem as
linhas em mãos. Em `pessoasPendentes`, monte um mapa antes de chamar `comNomes`:

```ts
  /*
   * O ÚNICO ACHADO de quem só tem um. É o que transforma "1 achado espera por
   * você" num link que abre exatamente ele.
   */
  const achadoPorPessoa = new Map<string, string[]>();
  for (const l of linhas) {
    if (l.resolvedAt || !l.findingId) continue;
    const pessoas = [
      ...(l.assigneeEmail && !l.notifiedAt ? [l.assigneeEmail] : []),
      ...l.envolvidos.filter((e) => !e.notifiedAt).map((e) => e.email),
    ];
    for (const email of pessoas) {
      const lista = achadoPorPessoa.get(email) ?? [];
      lista.push(l.findingId);
      achadoPorPessoa.set(email, lista);
    }
  }

  const pessoas = await comNomes(quemAvisar(achados), organizationId);

  return pessoas.map((p) => {
    const dela = achadoPorPessoa.get(p.email) ?? [];
    return { ...p, achadoUnico: dela.length === 1 ? dela[0] : null };
  });
```

E acrescente `findingId: true` ao `select` da consulta de `pessoasPendentes`.

- [ ] **Passo 2: comentar reabre o aviso para os OUTROS**

Em `lib/achado-compartilhado.ts`, em `comentar`, depois do `registrarNoAchado`:

```ts
  /*
   * A RESPOSTA REABRE O AVISO — para os outros, e não para quem escreveu.
   *
   * E-mail automático a cada resposta foi recusado de propósito: o aviso é ato
   * único, e uma conversa de seis mensagens viraria seis e-mails em que o sexto
   * diz menos que o primeiro. Zerar `notifiedAt` faz a novidade aparecer no
   * botão "Avisar" que já existe, e quem decide mandar continua sendo gente.
   *
   * Quem escreveu fica de fora: ninguém precisa ser avisado do que acabou de
   * dizer.
   */
  const autor = args.autor.email.trim().toLowerCase();

  await getPrisma().auditFeedback.updateMany({
    where: { id: linha.id, assigneeEmail: { not: autor }, resolvedAt: null },
    data: { notifiedAt: null },
  });

  await getPrisma().auditFindingWatcher.updateMany({
    where: { feedbackId: linha.id, email: { not: autor } },
    data: { notifiedAt: null },
  });
```

- [ ] **Passo 3: provar que o aviso volta a apontar a pessoa certa**

Criar `scratchpad/qa-resposta-reabre.mjs`:

```js
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");
const { quemFaltaAvisar } = await import("../lib/aviso-de-achados.ts");
const { comentar } = await import("../lib/achado-compartilhado.ts");
const { atribuirAchados } = await import("../lib/fila-de-achados.ts");
const p = getPrisma();
const ORG = "org-prosul";
const a = await p.audit.findFirst({
  where: { project: { organizationId: ORG }, report: { not: null } },
  select: { id: true, report: true },
});
const fid = a.report.incongruencias[0].id;
await p.auditFeedback.deleteMany({ where: { auditId: a.id } });

await atribuirAchados({
  auditId: a.id, findingIds: [fid], assigneeEmail: "milton@prosul.com", assigneeNome: "Milton",
  organizationId: ORG, atribuidoPor: { id: null, email: "victor@prosul.com" },
});
const f = await p.auditFeedback.findFirstOrThrow({ where: { auditId: a.id, findingId: fid }, select: { id: true } });
await p.auditFeedback.update({ where: { id: f.id }, data: { notifiedAt: new Date() } });
console.log("depois de avisar :", (await quemFaltaAvisar(a.id, ORG)).map((x) => x.nome).join(", ") || "(ninguém)");

await comentar({ auditId: a.id, findingId: fid, organizationId: ORG,
  autor: { id: null, email: "victor@prosul.com" }, body: "e aí, conseguiu ver?" });
console.log("o Victor comentou:", (await quemFaltaAvisar(a.id, ORG)).map((x) => x.nome).join(", ") || "(ninguém)");

await comentar({ auditId: a.id, findingId: fid, organizationId: ORG,
  autor: { id: null, email: "milton@prosul.com" }, body: "vendo agora" });
const depois = await p.auditFeedback.findUniqueOrThrow({ where: { id: f.id }, select: { notifiedAt: true } });
console.log("o proprio Milton NAO se reavisa:", depois.notifiedAt === null ? "FALHOU" : "ok");
await p.auditFeedback.deleteMany({ where: { auditId: a.id } });
```

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scratchpad/qa-resposta-reabre.mjs
```

Esperado:

```
depois de avisar : (ninguém)
o Victor comentou: Milton
o proprio Milton NAO se reavisa: ok
```

Apague o script depois — é rascunho.

- [ ] **Passo 4: as provas que já existem continuam passando**

```bash
npm run prova:aviso
npm run prova:conversa-achado
```

Esperado: as duas verdes. `prova:aviso` cobre "apertar duas vezes não repete o
e-mail" — a mudança não pode regredi-lo.

- [ ] **Passo 5: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint lib/aviso-de-achados.ts lib/achado-compartilhado.ts
```

- [ ] **Passo 6: commit**

```bash
git add lib/aviso-de-achados.ts lib/achado-compartilhado.ts
git diff --cached --stat
git commit -m "o e-mail leva ao achado, e responder reacende o aviso sem virar e-mail"
```

---

### Task 9: "Ver no documento" vira ação com nome

**Files:**
- Modificar: `components/audit-result.tsx`

**Interfaces:**
- Consome: nada de tarefas anteriores.
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: o botão nomeado, ao lado das outras decisões**

Em `components/audit-result.tsx`, na linha de ações do cartão do achado — a mesma
que traz "Marcar corrigido", "Enviar" e "Decisão técnica" —, acrescentar como
**primeiro** botão:

```tsx
                          {finding.pdfUrl ? (
                            /*
                             * VER NO DOCUMENTO, com a palavra escrita.
                             *
                             * A capacidade existia desde sempre (`openInlinePdf`
                             * abre a página e grifa o trecho), escondida no menu
                             * de reticências. Numa auditoria, conferir a
                             * afirmação no documento não é ação secundária: é a
                             * que decide todas as outras da linha.
                             */
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openInlinePdf(finding)}
                            >
                              <ExternalLink aria-hidden />
                              Ver no documento
                            </Button>
                          ) : null}
```

- [ ] **Passo 2: tirar o item do menu**

No `Dropdown` do achado (`aria-label="Ações do achado"`, por volta da linha
3622), remover o `DropdownItem` de "Abrir PDF" — o bloco inteiro:

```tsx
                                {finding.pdfUrl ? (
                                  <DropdownItem
                                    onClick={() => {
                                      openInlinePdf(finding);
                                      close();
                                    }}
                                  >
                                    <ExternalLink className="size-4" />
                                    Abrir PDF
                                  </DropdownItem>
                                ) : null}
```

Dois caminhos para a mesma coisa fazem a pessoa escolher entre eles em vez de
agir, e o do menu era o escondido.

- [ ] **Passo 3: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint components/audit-result.tsx
```

- [ ] **Passo 4: conferir na tela**

Com o `next dev` de pé, abra um parecer, vá para a aba Achados e confirme:
o botão "Ver no documento" aparece na linha de ações, o menu de reticências já
não oferece "Abrir PDF", e clicar no botão abre o visor na página do achado.

- [ ] **Passo 5: commit**

```bash
git add components/audit-result.tsx
git diff --cached --stat
git commit -m "conferir no documento deixa de ser item escondido de menu"
```

---

### Task 10: a prova de que o Milton abre o PDF

**Files:**
- Criar: `scripts/prova-milton-abre-o-pdf.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: tudo das tarefas anteriores.
- Produz: nada.

- [ ] **Passo 1: escrever a prova**

Criar `scripts/prova-milton-abre-o-pdf.mjs`:

```js
// O MILTON ABRE O PDF QUE NUNCA ESTEVE NA MÁQUINA DELE.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-milton-abre-o-pdf.mjs
//   (== npm run prova:milton)
//
// É a prova que resume o sub-projeto. Antes dela, `podeVerNoDocumento` dependia
// do IndexedDB da própria máquina: quem recebia um achado por e-mail não tinha
// botão nenhum, e o achado era uma afirmação sem como conferir.
//
// O contexto do Milton é NOVO — IndexedDB vazio, como o de quem clica no link
// pela primeira vez. É essa a condição que a prova precisa manter.
//
// SEM IA: o parecer é o que o seed deixou; o PDF é semeado direto no StoredFile.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { guardarArquivo } = await import("../lib/file-storage.ts");
const { linkDoAchado } = await import("../lib/link-do-achado.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const prisma = getPrisma();

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: "org-prosul" }, report: { not: null }, status: "COMPLETED" },
  orderBy: { createdAt: "desc" },
  select: { id: true, report: true },
});
check("existe auditoria com parecer", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const findingId = audit.report.incongruencias[0].id;

/*
 * UM PDF DE VERDADE, mínimo mas válido: o visor tem que conseguir abri-lo, e um
 * arquivo de texto passaria na rota e falharia na tela — que é o pior lugar para
 * descobrir.
 */
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);
const guardado = await guardarArquivo({
  data: pdf, organizationId: "org-prosul", mimeType: "application/pdf",
});

await prisma.auditFile.updateMany({
  where: { auditId: audit.id },
  data: { checksumSha256: guardado.checksumSha256 },
});
const temArquivo = await prisma.auditFile.count({
  where: { auditId: audit.id, checksumSha256: { not: null } },
});
check("a auditoria aponta para o arquivo guardado", temArquivo > 0);

const navegador = await chromium.launch();

/*
 * CONTEXTO NOVO = IndexedDB VAZIO. É a condição da prova: o Milton nunca rodou
 * esta auditoria, e o memorial nunca esteve nesta máquina.
 */
const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
const pg = await ctx.newPage();
await entrarComo(pg, "milton@prosul.com");

const local = await pg.evaluate(async () => {
  const q = indexedDB.open("nexo");
  const db = await new Promise((r) => { q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
  if (!db || !db.objectStoreNames.contains("conversations")) return 0;
  const tx = db.transaction("conversations", "readonly");
  return await new Promise((r) => {
    const g = tx.objectStore("conversations").getAll();
    g.onsuccess = () => r(g.result.length);
    g.onerror = () => r(0);
  });
});
check("o Milton começa sem conversa nenhuma nesta máquina", local === 0, `achei ${local}`);

const destino = linkDoAchado({ base: BASE, auditId: audit.id, findingId });
await pg.goto(destino, { waitUntil: "networkidle" });
await pg.waitForTimeout(4000);

check("o link tem o achado", destino.includes(`achado=${findingId}`), destino);

// A rota devolve os bytes para ele?
const baixou = await pg.evaluate(async (checksum) => {
  const r = await fetch(`/api/arquivos/${checksum}`);
  return { status: r.status, tipo: r.headers.get("content-type"), bytes: (await r.arrayBuffer()).byteLength };
}, guardado.checksumSha256);
check("o Milton baixa o documento", baixou.status === 200, `HTTP ${baixou.status}`);
check("e ele é um PDF com bytes", baixou.tipo === "application/pdf" && baixou.bytes === pdf.byteLength,
  JSON.stringify(baixou));

// E a tela oferece o botão?
const botao = pg.getByRole("button", { name: /Ver no documento/i }).first();
await botao.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
check("a tela oferece VER NO DOCUMENTO", (await botao.count()) > 0);

/*
 * A CAIXA CONTRA A JANELA, e não só a presença no DOM: asserção de DOM passa
 * verde com o painel inteiro fora da tela, e este projeto já pagou por isso.
 */
const caixa = await botao.boundingBox();
const janela = pg.viewportSize();
check(
  "e o botão está DENTRO da janela",
  Boolean(caixa) && caixa.x >= 0 && caixa.y >= 0 &&
    caixa.x + caixa.width <= janela.width && caixa.y + caixa.height <= janela.height,
  JSON.stringify({ caixa, janela }),
);

await pg.screenshot({ path: "prova-milton-abre-o-pdf.png" });
console.log("\nprova-milton-abre-o-pdf.png");

await navegador.close();
await prisma.auditFile.updateMany({ where: { auditId: audit.id }, data: { checksumSha256: null } });
await prisma.storedFile.deleteMany({ where: { checksumSha256: guardado.checksumSha256 } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: rodar a prova**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-milton-abre-o-pdf.mjs
```

Esperado: 8 linhas `OK` e `prova passou`. Abra o PNG e confirme a olho que o
botão "Ver no documento" está no cartão do achado que o link pediu.

- [ ] **Passo 3: registrar o script**

Em `package.json`, depois de `"prova:arquivo"`:

```json
"prova:milton": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-milton-abre-o-pdf.mjs",
```

- [ ] **Passo 4: rodar tudo o que este trabalho tocou**

```bash
npm run test:fonte-documento && npm run test:link-achado \
  && npm run test:conversa-achado && npm run test:quem-avisar \
  && npm run prova:arquivo && npm run prova:conversa-achado \
  && npm run prova:duas-pessoas && npm run prova:aviso \
  && npm run prova:milton && npm run prova:rotas \
  && npx tsc --noEmit
```

Esperado: tudo verde. Se algo falhar, **não** siga para o commit.

**`npm run prova:fila` e `npm run prova:barra` já estavam quebrados antes deste
trabalho** e não entram nesta lista — ver o registro em
`docs/superpowers/plans/2026-09-01-multiplayer-dos-achados.md`.

- [ ] **Passo 5: o PNG não entra no repositório**

```bash
git status --short | grep prova-milton
```

Se aparecer, não o adicione: é artefato de corrida.

- [ ] **Passo 6: commit**

```bash
git add scripts/prova-milton-abre-o-pdf.mjs package.json
git diff --cached --stat
git commit -m "a prova que resume o sub-projeto: o Milton abre o que nunca foi dele"
```

---

## O que este plano deixa de propósito para depois

- **Guardar pranchas e volumes.** Só o memorial auditado. É o que segura o custo.
- **Backfill dos memoriais já auditados.** Os bytes não existem mais no servidor;
  não há de onde tirá-los. `AuditFile.checksumSha256` nulo é o estado honesto, e
  a tela diz o motivo.
- **Retenção e expurgo.** Nada é apagado por idade. `StoredFile.createdAt` está
  lá para sustentar a regra no dia em que ela existir.
- **Armazenamento de objetos.** A costura fica pronta; trocar é de provedor.
- **Redesenhar o cartão do achado.** Sub-projeto 5.
