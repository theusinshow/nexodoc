# Multiplayer dos achados — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** dar ao achado um lugar onde duas pessoas conversam — com um
responsável, N envolvidos, e uma linha do tempo que é ao mesmo tempo o histórico.

**Arquitetura:** `AuditFeedback` continua sendo a linha de estado do achado.
Penduram-se nela duas tabelas: `AuditFindingMessage` (a conversa **e** o
histórico, distinguidos por `kind`) e `AuditFindingWatcher` (os envolvidos, com
`notifiedAt` por pessoa). O "resolvido" local deixa de ser fonte e é empurrado
uma vez para o servidor. Tudo assíncrono — nenhum SSE, nenhum polling.

**Stack:** Next.js 15 (App Router), React 19, Prisma 7 + Postgres (Neon),
TypeScript, Playwright. Testes puros rodam em **node cru** (`node scripts/x.ts`),
sem framework.

**Spec:** `docs/superpowers/specs/2026-09-01-multiplayer-dos-achados-design.md`

## Restrições globais

- **pt-BR em tudo que é visível e em todo comentário de código.**
- **Núcleo puro não importa o alias `@/`** — com ele o arquivo deixa de rodar sob
  o type-stripping do node cru. Em `scripts/*.ts`, caminho relativo com `.ts`.
- **Commit direto na `main`.** Sem branch, sem PR.
- **`git add` com caminhos explícitos, nunca `git add -A`.** Conferir com
  `git diff --cached --stat` antes de commitar.
- **`npm run db:generate` depois de todo `prisma migrate dev`** — o banco ganha a
  coluna e o client tipado não; o sintoma é `Unknown argument`, que aponta para o
  código quando o problema é o client velho.
- **Nenhuma tarefa gasta token de IA.** Tudo semeia banco ou IndexedDB.
- **Nenhum e-mail novo é disparado.** O aviso passa a alcançar os envolvidos;
  responder no achado **não** manda e-mail. Isso é o sub-projeto 3.
- **`verdict` nunca é inventado.** Marcar corrigido não julga a IA; gravar
  `verdict` a partir de um clique que não julgou contamina o benchmark.
- **Reiniciar o `next dev` antes de acreditar numa falha de portão.**

## Mapa dos arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `lib/conversa-do-achado.ts` | Puro. `linhaDoTempo()` — transforma linhas cruas em frases legíveis, misturando fala e evento. |
| `lib/quem-avisar.ts` | Puro. `quemAvisar()` — responsável + envolvidos, menos avisados, menos resolvidos. |
| `lib/achado-compartilhado.ts` | IO. `garantirLinhaDoAchado()`, `comentar()`, `envolver()`, `desenvolver()`. |
| `scripts/test-conversa-do-achado.ts` | Teste puro da linha do tempo. |
| `scripts/test-quem-avisar.ts` | Teste puro da regra de aviso. |
| `app/api/audits/[id]/achados/[findingId]/conversa/route.ts` | `GET` lê a conversa; `POST` comenta. |
| `app/api/audits/[id]/achados/[findingId]/envolvidos/route.ts` | `POST` envolve; `DELETE` desenvolve. |
| `components/achado/conversa-do-achado.tsx` | A lista e o campo de escrever. |
| `components/achado/linha-da-conversa.tsx` | Uma linha — fala ou evento. |
| `scripts/prova-conversa-do-achado.mjs` | Prova de banco. |
| `scripts/prova-duas-pessoas-no-achado.mjs` | Prova de navegador, Victor e Milton. |

**Modificados**

| Arquivo | O quê |
|---|---|
| `prisma/schema.prisma` | `AuditFindingMessage`, `AuditFindingWatcher`, relações e o docblock de `AuditFeedback`. |
| `lib/fila-de-achados.ts` | `atribuirAchados` aceita `recado` e grava o evento. |
| `app/api/audits/[id]/atribuir/route.ts` | Aceita `recado` no corpo. |
| `app/api/audits/[id]/feedback/route.ts` | `GET` devolve envolvidos; `POST` grava o evento de desfecho. |
| `lib/aviso-de-achados.ts` | O aviso alcança os envolvidos. |
| `components/audit-result.tsx` | Campo de recado no lote; ponto de montagem da conversa. |
| `modules/nexo/state/conversation-store.tsx` | `esquecerAchadosResolvidos` para a empurrada. |
| `modules/nexo/components/PalcoDoNexo.tsx` | Lê o resolvido do servidor. |
| `package.json` | Quatro scripts novos. |

---

### Task 1: a linha do tempo (puro)

**Files:**
- Criar: `lib/conversa-do-achado.ts`
- Criar: `scripts/test-conversa-do-achado.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: nada. É núcleo, sem imports.
- Produz:
  - `type LinhaCrua = { kind: string; authorEmail: string; authorNome: string; body: string; details: Record<string, unknown> | null; createdAt: number }`
  - `type LinhaLegivel = { kind: string; quem: string; frase: string; body: string; createdAt: number; ehEvento: boolean }`
  - `linhaDoTempo(linhas: readonly LinhaCrua[]): LinhaLegivel[]`

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-conversa-do-achado.ts`:

```ts
/**
 * A LINHA DO TEMPO do achado — fala e evento na mesma cronologia. Puro → node cru.
 *
 *   node scripts/test-conversa-do-achado.ts   (== npm run test:conversa-achado)
 */
import assert from "node:assert/strict";

import { linhaDoTempo, type LinhaCrua } from "../lib/conversa-do-achado.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

function crua(over: Partial<LinhaCrua> = {}): LinhaCrua {
  return {
    kind: "comentario",
    authorEmail: "victor@prosul.com",
    authorNome: "Victor",
    body: "",
    details: null,
    createdAt: 1_000,
    ...over,
  };
}

console.log("conversa do achado\n");

test("a fala de alguém sai como fala, não como evento", () => {
  const [linha] = linhaDoTempo([crua({ body: "isso é do estrutural, não meu" })]);
  assert.equal(linha.ehEvento, false);
  assert.equal(linha.quem, "Victor");
  assert.equal(linha.body, "isso é do estrutural, não meu");
  assert.equal(linha.frase, "");
});

test("a atribuição vira frase, e o recado continua sendo fala", () => {
  /*
   * O recado do encaminhamento NÃO é uma segunda funcionalidade: é a primeira
   * mensagem da conversa. A linha carrega as duas coisas — o que aconteceu e o
   * que a pessoa escreveu junto.
   */
  const [linha] = linhaDoTempo([
    crua({
      kind: "atribuiu",
      body: "olha o item 14",
      details: { para: "milton@prosul.com", paraNome: "Milton" },
    }),
  ]);
  assert.equal(linha.ehEvento, true);
  assert.equal(linha.frase, "atribuiu a Milton");
  assert.equal(linha.body, "olha o item 14", "o recado sobrevive ao evento");
});

test("a reatribuição diz DE QUEM saiu — é o que o histórico existe para guardar", () => {
  /*
   * Antes deste trabalho, reatribuir sobrescrevia `assigneeEmail` e quem tinha o
   * achado desaparecia sem rastro.
   */
  const [linha] = linhaDoTempo([
    crua({
      kind: "reatribuiu",
      details: { deNome: "Milton", paraNome: "Carla" },
    }),
  ]);
  assert.equal(linha.frase, "passou de Milton para Carla");
});

test("envolver e desenvolver são eventos distintos", () => {
  const linhas = linhaDoTempo([
    crua({ kind: "envolveu", details: { paraNome: "Carla" }, createdAt: 1 }),
    crua({ kind: "desenvolveu", details: { paraNome: "Carla" }, createdAt: 2 }),
  ]);
  assert.equal(linhas[0].frase, "envolveu Carla");
  assert.equal(linhas[1].frase, "tirou Carla dos envolvidos");
});

test("o fecho diz COMO foi encerrado, e não só que foi", () => {
  const casos: [string, string][] = [
    ["FIXED_IN_DOC", "marcou como corrigido no documento"],
    ["FALSE_POSITIVE", "marcou como falso positivo"],
    ["ACCEPTED_RISK", "assumiu o risco"],
  ];
  for (const [desfecho, esperado] of casos) {
    const [linha] = linhaDoTempo([crua({ kind: "resolveu", details: { desfecho } })]);
    assert.equal(linha.frase, esperado, desfecho);
  }
});

test("reabrir é evento próprio", () => {
  const [linha] = linhaDoTempo([crua({ kind: "reabriu" })]);
  assert.equal(linha.frase, "reabriu o achado");
});

test("a ordem é cronológica, e não a de chegada do banco", () => {
  const linhas = linhaDoTempo([
    crua({ body: "terceiro", createdAt: 300 }),
    crua({ body: "primeiro", createdAt: 100 }),
    crua({ body: "segundo", createdAt: 200 }),
  ]);
  assert.deepEqual(linhas.map((l) => l.body), ["primeiro", "segundo", "terceiro"]);
});

test("kind desconhecido não some e não quebra", () => {
  /*
   * `kind` é texto, não enum — o vocabulário cresce sem migração. Uma linha de
   * um `kind` que este código não conhece tem que aparecer mesmo assim: sumir
   * com um pedaço do histórico é pior do que mostrá-lo sem frase bonita.
   */
  const [linha] = linhaDoTempo([crua({ kind: "inventou", body: "olá" })]);
  assert.equal(linha.ehEvento, true);
  assert.equal(linha.frase, "registrou uma mudança");
  assert.equal(linha.body, "olá");
});

test("sem nome, o e-mail serve — melhor endereço do que linha sem dono", () => {
  const [linha] = linhaDoTempo([crua({ authorNome: "", body: "oi" })]);
  assert.equal(linha.quem, "victor@prosul.com");
});

console.log(`\n${passed} passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-conversa-do-achado.ts
```

Esperado: FALHA com `Cannot find module '.../lib/conversa-do-achado.ts'`.

- [ ] **Passo 3: escrever a implementação**

Criar `lib/conversa-do-achado.ts`:

```ts
/**
 * A LINHA DO TEMPO DE UM ACHADO — o que as pessoas escreveram e o que o sistema
 * registrou, na MESMA cronologia.
 *
 * O histórico É a conversa, e isso é decisão de desenho. Duas tabelas — uma de
 * mensagens, outra de eventos — produziriam duas linhas do tempo que a tela
 * teria que fundir, e que poderiam discordar. Uma só entrega o que alguém
 * quer ler ao abrir um achado:
 *
 *   Victor atribuiu a Milton · "olha o item 14"
 *   Milton: isso é do estrutural, não meu
 *   Victor envolveu Carla
 *   Carla marcou como corrigido no documento
 *
 * Note a segunda e a quarta: o recado do encaminhamento não é uma segunda
 * funcionalidade, é a primeira fala da conversa. Uma linha carrega as duas
 * coisas — o que aconteceu (`frase`) e o que a pessoa escreveu (`body`).
 *
 * PURO e sem imports → roda em node cru (`npm run test:conversa-achado`).
 */

/** Uma linha como o banco a devolve, já com o nome de quem falou resolvido. */
export type LinhaCrua = {
  kind: string;
  authorEmail: string;
  /** O nome que o escritório conhece. Vazio cai para o e-mail. */
  authorNome: string;
  body: string;
  details: Record<string, unknown> | null;
  createdAt: number;
};

export type LinhaLegivel = {
  kind: string;
  /** Quem fez ou falou. Nunca vazio. */
  quem: string;
  /** O que aconteceu, em português. Vazio no comentário puro. */
  frase: string;
  /** O que a pessoa escreveu. Pode conviver com `frase` — ver o docblock. */
  body: string;
  createdAt: number;
  ehEvento: boolean;
};

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * O nome de quem o evento aponta — o destinatário da atribuição, o envolvido.
 *
 * Cai para o e-mail, e depois para "alguém": a frase precisa fechar mesmo com
 * `details` de uma versão anterior que não gravava o nome.
 */
function alvo(details: Record<string, unknown> | null, prefixo: "para" | "de"): string {
  return (
    texto(details?.[`${prefixo}Nome`]) || texto(details?.[prefixo]) || "alguém"
  );
}

const DESFECHOS: Record<string, string> = {
  FIXED_IN_DOC: "marcou como corrigido no documento",
  FALSE_POSITIVE: "marcou como falso positivo",
  ACCEPTED_RISK: "assumiu o risco",
};

/**
 * A frase de um evento. `""` significa que a linha é fala pura.
 *
 * `kind` desconhecido devolve uma frase genérica em vez de vazio ou de erro:
 * o campo é texto e não enum de propósito (o vocabulário cresce sem migração),
 * e sumir com um pedaço do histórico é pior do que mostrá-lo sem frase bonita.
 */
function fraseDo(kind: string, details: Record<string, unknown> | null): string {
  switch (kind) {
    case "comentario":
      return "";
    case "atribuiu":
      return `atribuiu a ${alvo(details, "para")}`;
    case "reatribuiu":
      return `passou de ${alvo(details, "de")} para ${alvo(details, "para")}`;
    case "envolveu":
      return `envolveu ${alvo(details, "para")}`;
    case "desenvolveu":
      return `tirou ${alvo(details, "para")} dos envolvidos`;
    case "resolveu":
      return DESFECHOS[texto(details?.desfecho)] ?? "encerrou o achado";
    case "reabriu":
      return "reabriu o achado";
    default:
      return "registrou uma mudança";
  }
}

/**
 * As linhas em ordem cronológica, com a frase montada.
 *
 * A ordenação acontece AQUI, e não se confia na do banco: a consulta pode mudar,
 * e uma conversa fora de ordem conta uma história errada — "Carla corrigiu"
 * antes de "Victor atribuiu à Carla" inverte quem pediu o quê.
 */
export function linhaDoTempo(linhas: readonly LinhaCrua[]): LinhaLegivel[] {
  return [...linhas]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((l) => {
      const frase = fraseDo(l.kind, l.details);

      return {
        kind: l.kind,
        // Melhor um endereço do que uma linha sem dono — a mesma escolha que a
        // rota de feedback já faz para a tarja do responsável.
        quem: l.authorNome.trim() || l.authorEmail,
        frase,
        body: l.body,
        createdAt: l.createdAt,
        ehEvento: l.kind !== "comentario",
      };
    });
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node scripts/test-conversa-do-achado.ts
```

Esperado: 9 linhas `ok` e `9 passaram`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, dentro de `"scripts"`, logo depois de `"test:desfecho"`:

```json
"test:conversa-achado": "node scripts/test-conversa-do-achado.ts",
```

Rodar `npm run test:conversa-achado` e confirmar a mesma saída.

- [ ] **Passo 6: commit**

```bash
git add lib/conversa-do-achado.ts scripts/test-conversa-do-achado.ts package.json
git diff --cached --stat
git commit -m "o histórico do achado é a conversa: uma cronologia só"
```

---

### Task 2: quem recebe o aviso (puro)

**Files:**
- Criar: `lib/quem-avisar.ts`
- Criar: `scripts/test-quem-avisar.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: nada.
- Produz:
  - `type PessoaNoAchado = { email: string; papel: "responsavel" | "envolvido"; notifiedAt: number | null }`
  - `type AchadoParaAvisar = { resolvido: boolean; pessoas: readonly PessoaNoAchado[] }`
  - `quemAvisar(achados: readonly AchadoParaAvisar[]): { email: string; quantidade: number }[]`

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-quem-avisar.ts`:

```ts
/**
 * QUEM ESTÁ ESPERANDO AVISO — agora com N envolvidos. Puro → node cru.
 *
 *   node scripts/test-quem-avisar.ts   (== npm run test:quem-avisar)
 */
import assert from "node:assert/strict";

import { quemAvisar, type AchadoParaAvisar } from "../lib/quem-avisar.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("quem avisar\n");

const achado = (over: Partial<AchadoParaAvisar> = {}): AchadoParaAvisar => ({
  resolvido: false,
  pessoas: [],
  ...over,
});

test("o responsável entra", () => {
  const r = quemAvisar([
    achado({ pessoas: [{ email: "milton@prosul.com", papel: "responsavel", notifiedAt: null }] }),
  ]);
  assert.deepEqual(r, [{ email: "milton@prosul.com", quantidade: 1 }]);
});

test("os envolvidos entram junto do responsável", () => {
  const r = quemAvisar([
    achado({
      pessoas: [
        { email: "milton@prosul.com", papel: "responsavel", notifiedAt: null },
        { email: "carla@prosul.com", papel: "envolvido", notifiedAt: null },
      ],
    }),
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(new Set(r.map((x) => x.email)), new Set(["milton@prosul.com", "carla@prosul.com"]));
});

test("quem JÁ FOI AVISADO não é avisado de novo", () => {
  // É esta condição que torna o botão seguro de tocar duas vezes.
  const r = quemAvisar([
    achado({
      pessoas: [
        { email: "milton@prosul.com", papel: "responsavel", notifiedAt: 1_000 },
        { email: "carla@prosul.com", papel: "envolvido", notifiedAt: null },
      ],
    }),
  ]);
  assert.deepEqual(r, [{ email: "carla@prosul.com", quantidade: 1 }]);
});

test("achado JÁ RESOLVIDO não avisa ninguém", () => {
  /*
   * Se a pessoa corrigiu antes de o aviso sair, avisar seria mandá-la olhar
   * trabalho que ela mesma fechou.
   */
  const r = quemAvisar([
    achado({
      resolvido: true,
      pessoas: [{ email: "milton@prosul.com", papel: "responsavel", notifiedAt: null }],
    }),
  ]);
  assert.deepEqual(r, []);
});

test("a mesma pessoa em três achados é UM aviso com quantidade três", () => {
  const um = { email: "milton@prosul.com", papel: "responsavel" as const, notifiedAt: null };
  const r = quemAvisar([
    achado({ pessoas: [um] }),
    achado({ pessoas: [um] }),
    achado({ pessoas: [um] }),
  ]);
  assert.deepEqual(r, [{ email: "milton@prosul.com", quantidade: 3 }]);
});

test("responsável E envolvido no mesmo achado conta UMA vez", () => {
  /*
   * Dá para ser responsável por um achado e envolvido nele ao mesmo tempo (a
   * atribuição não remove ninguém dos envolvidos). Contar dois faria o assunto
   * do e-mail dizer "2 achados esperam por você" havendo um.
   */
  const r = quemAvisar([
    achado({
      pessoas: [
        { email: "milton@prosul.com", papel: "responsavel", notifiedAt: null },
        { email: "milton@prosul.com", papel: "envolvido", notifiedAt: null },
      ],
    }),
  ]);
  assert.deepEqual(r, [{ email: "milton@prosul.com", quantidade: 1 }]);
});

test("quem tem MAIS achados vem primeiro", () => {
  // É a pessoa cujo dia o envio mais muda, e a que quem confirma mais precisa
  // conferir antes de apertar.
  const r = quemAvisar([
    achado({ pessoas: [{ email: "a@prosul.com", papel: "responsavel", notifiedAt: null }] }),
    achado({ pessoas: [{ email: "b@prosul.com", papel: "responsavel", notifiedAt: null }] }),
    achado({ pessoas: [{ email: "b@prosul.com", papel: "responsavel", notifiedAt: null }] }),
  ]);
  assert.equal(r[0].email, "b@prosul.com");
  assert.equal(r[0].quantidade, 2);
});

test("sem ninguém, ninguém", () => {
  assert.deepEqual(quemAvisar([]), []);
  assert.deepEqual(quemAvisar([achado()]), []);
});

console.log(`\n${passed} passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-quem-avisar.ts
```

Esperado: FALHA com `Cannot find module '.../lib/quem-avisar.ts'`.

- [ ] **Passo 3: escrever a implementação**

Criar `lib/quem-avisar.ts`:

```ts
/**
 * QUEM ESTÁ ESPERANDO AVISO — a regra, sem banco.
 *
 * Ela já existia como o objeto `PENDENTE_DE_AVISO` dentro de
 * [[aviso-de-achados.ts]], e valia para UMA pessoa por achado. Com envolvidos,
 * a mesma regra passa a valer para N — e sai do Prisma para poder ser provada
 * sem banco.
 *
 * AS TRÊS CONDIÇÕES, cada uma com o motivo:
 *
 *  · tem e-mail — sem dono não há a quem avisar;
 *  · `notifiedAt` nulo — apertar o botão duas vezes não repete a mensagem. É
 *    esta condição que torna o botão seguro de tocar;
 *  · o achado não está resolvido — se a pessoa corrigiu antes de o aviso sair,
 *    avisar seria mandá-la olhar trabalho que ela mesma fechou.
 *
 * PURO e sem imports → roda em node cru (`npm run test:quem-avisar`).
 */
export type PessoaNoAchado = {
  email: string;
  papel: "responsavel" | "envolvido";
  /** Milissegundos, ou nulo quando o aviso ainda não saiu para ESTA pessoa. */
  notifiedAt: number | null;
};

export type AchadoParaAvisar = {
  resolvido: boolean;
  pessoas: readonly PessoaNoAchado[];
};

export function quemAvisar(
  achados: readonly AchadoParaAvisar[],
): { email: string; quantidade: number }[] {
  const contagem = new Map<string, number>();

  for (const achado of achados) {
    if (achado.resolvido) continue;

    /*
     * UM ACHADO CONTA UMA VEZ POR PESSOA.
     *
     * Dá para ser responsável por um achado e envolvido nele ao mesmo tempo — a
     * atribuição não remove ninguém dos envolvidos. Sem este conjunto, o assunto
     * do e-mail diria "2 achados esperam por você" havendo um.
     */
    const nesteAchado = new Set<string>();

    for (const pessoa of achado.pessoas) {
      const email = pessoa.email.trim().toLowerCase();
      if (!email || pessoa.notifiedAt !== null) continue;
      nesteAchado.add(email);
    }

    for (const email of nesteAchado) {
      contagem.set(email, (contagem.get(email) ?? 0) + 1);
    }
  }

  return [...contagem.entries()]
    .map(([email, quantidade]) => ({ email, quantidade }))
    /*
     * Quem tem MAIS achados primeiro: é a pessoa cujo dia este envio mais muda,
     * e a que quem confirma mais precisa conferir antes de apertar. É a mesma
     * ordem que `comNomes` já usava.
     */
    .sort((a, b) => b.quantidade - a.quantidade || a.email.localeCompare(b.email, "pt-BR"));
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node scripts/test-quem-avisar.ts
```

Esperado: 8 linhas `ok` e `8 passaram`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, logo depois de `"test:conversa-achado"`:

```json
"test:quem-avisar": "node scripts/test-quem-avisar.ts",
```

- [ ] **Passo 6: commit**

```bash
git add lib/quem-avisar.ts scripts/test-quem-avisar.ts package.json
git diff --cached --stat
git commit -m "a regra do aviso sai do Prisma e passa a valer para N pessoas"
```

---

### Task 3: as duas tabelas

**Files:**
- Modificar: `prisma/schema.prisma`
- Criar: `prisma/migrations/<timestamp>_multiplayer_dos_achados/migration.sql` (gerado)

**Interfaces:**
- Consome: nada.
- Produz: `AuditFindingMessage`, `AuditFindingWatcher`, e as relações
  `AuditFeedback.mensagens` / `AuditFeedback.envolvidos`.

- [ ] **Passo 1: acrescentar o docblock que explica o que `AuditFeedback` virou**

Em `prisma/schema.prisma`, no docblock de `model AuditFeedback`, logo antes de
`model AuditFeedback {`, acrescentar ao FIM do comentário existente:

```prisma
/// ESTA LINHA VIROU O ACHADO COMPARTILHADO. Nasceu para guardar o julgamento da
/// IA, e hoje guarda também a atribuição, o aviso, o desfecho e — desde o
/// multiplayer — a âncora da conversa e dos envolvidos. O nome ficou pequeno.
///
/// NÃO foi renomeada de propósito: migração de tabela por vaidade de
/// nomenclatura, num sistema no ar, é risco sem retorno.
```

- [ ] **Passo 2: declarar as relações em `AuditFeedback`**

Ainda em `model AuditFeedback`, logo depois de
`audit          Audit                  @relation(fields: [auditId], references: [id], onDelete: Cascade)`:

```prisma
  mensagens      AuditFindingMessage[]
  envolvidos     AuditFindingWatcher[]
```

- [ ] **Passo 3: declarar as duas tabelas**

Ao fim de `prisma/schema.prisma`:

```prisma
/// Uma linha da CONVERSA de um achado — o que uma pessoa escreveu, ou o que o
/// sistema registrou. As duas coisas na MESMA cronologia, e isso é decisão.
///
/// Uma tabela de mensagens e outra de eventos produziriam duas linhas do tempo
/// que a tela teria que fundir, e que poderiam discordar. Ver
/// [[lib/conversa-do-achado.ts]], que monta a leitura.
model AuditFindingMessage {
  id          String        @id @default(cuid())
  feedbackId  String
  /// `comentario` | `atribuiu` | `reatribuiu` | `envolveu` | `desenvolveu` |
  /// `resolveu` | `reabriu`.
  ///
  /// Texto e não enum: o vocabulário é de produto e cresce sem merecer uma
  /// migração — mesma razão de `AuditLearning.type`. Quem lê trata `kind`
  /// desconhecido com uma frase genérica, nunca sumindo com a linha.
  kind        String
  /// E-mail de quem falou. Como no resto do módulo, é o e-mail que identifica —
  /// dá para ter sido convidado e ainda não ter conta.
  authorEmail String
  authorId    String?
  /// O que a pessoa escreveu. Vazio nos eventos de sistema — e NÃO vazio na
  /// atribuição com recado: o recado é a primeira fala da conversa, e a linha
  /// carrega o evento e a fala ao mesmo tempo.
  body        String        @default("")
  /// `{de, deNome, para, paraNome}` na reatribuição; `{desfecho}` no fecho. É o
  /// que a frase precisa para se montar sem uma segunda consulta — e o que a
  /// mantém verdadeira quando a pessoa citada sai do escritório depois.
  details     Json?
  createdAt   DateTime      @default(now())
  feedback    AuditFeedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@index([feedbackId, createdAt])
}

/// Quem ACOMPANHA o achado sem responder por ele.
///
/// O responsável é UM, e continua em `AuditFeedback.assigneeEmail` — a coluna
/// indexada que a home consulta em `pendenciasDe()`. Com N responsáveis iguais,
/// "o achado está resolvido quando quem fecha?" não teria resposta que não
/// perdesse achado. A assimetria é a decisão: um responde, os outros acompanham.
model AuditFindingWatcher {
  id         String        @id @default(cuid())
  feedbackId String
  email      String
  /// POR PESSOA, e não uma coluna só no achado.
  ///
  /// O docblock de `AuditFeedback.notifiedAt` explica por quê: reatribuir zera o
  /// aviso, senão a Carla herda o "já avisado" que era do Milton e nunca fica
  /// sabendo. Com N pessoas, esse estado é de cada uma.
  notifiedAt DateTime?
  addedById  String?
  addedAt    DateTime      @default(now())
  feedback   AuditFeedback @relation(fields: [feedbackId], references: [id], onDelete: Cascade)

  @@unique([feedbackId, email])
  @@index([email, notifiedAt])
}
```

- [ ] **Passo 4: gerar a migração e o client**

```bash
npx prisma validate
npm run db:migrate:dev -- --name multiplayer_dos_achados
npm run db:generate
```

Se o comando pendurar com `P1002`, a migração está travada no pooler: rode
`npm run db:destravar` e repita.

- [ ] **Passo 5: conferir o SQL — nenhum `DROP`**

```bash
cat prisma/migrations/*_multiplayer_dos_achados/migration.sql
grep -ci drop prisma/migrations/*_multiplayer_dos_achados/migration.sql
```

Esperado: dois `CREATE TABLE`, três `CREATE INDEX` (um deles `UNIQUE`), dois
`ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE CASCADE`, e a contagem de `drop`
igual a `0`. Se aparecer qualquer `DROP`, **pare**: o schema local divergiu do
banco.

- [ ] **Passo 6: provar o `Cascade` contra o banco**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs -e "
import('./lib/db.ts').then(async ({ getPrisma }) => {
  const p = getPrisma();
  const audit = await p.audit.findFirst({ select: { id: true } });
  const f = await p.auditFeedback.create({
    data: { auditId: audit.id, targetKey: 'finding:QA-CASCADE' },
    select: { id: true },
  });
  await p.auditFindingMessage.create({
    data: { feedbackId: f.id, kind: 'comentario', authorEmail: 'qa@prosul.com', body: 'oi' },
  });
  await p.auditFindingWatcher.create({
    data: { feedbackId: f.id, email: 'qa@prosul.com' },
  });
  await p.auditFeedback.delete({ where: { id: f.id } });
  const m = await p.auditFindingMessage.count({ where: { feedbackId: f.id } });
  const w = await p.auditFindingWatcher.count({ where: { feedbackId: f.id } });
  console.log('mensagens orfas:', m, '| envolvidos orfaos:', w);
});
"
```

Esperado: `mensagens orfas: 0 | envolvidos orfaos: 0`.

- [ ] **Passo 7: commit**

```bash
git add prisma/schema.prisma prisma/migrations
git diff --cached --stat
git commit -m "o achado ganha conversa e envolvidos: as duas tabelas"
```

---

### Task 4: escrever no achado (IO)

**Files:**
- Criar: `lib/achado-compartilhado.ts`
- Criar: `scripts/prova-conversa-do-achado.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: `chaveEntreVersoes` de `lib/diff-de-pareceres.ts`; `AuditReport` de
  `lib/audit-report.ts`.
- Produz:
  - `class AchadoRecusado extends Error { readonly status: 400 | 404 }`
  - `garantirLinhaDoAchado(args: { auditId: string; findingId: string; organizationId: string }): Promise<{ id: string }>`
  - `registrarNoAchado(args: { feedbackId: string; kind: string; autor: { id: string | null; email: string }; body?: string; details?: Record<string, unknown> }): Promise<void>`
  - `comentar(args: { auditId: string; findingId: string; organizationId: string; autor: { id: string | null; email: string }; body: string }): Promise<{ id: string }>`
  - `envolver(args: { auditId: string; findingId: string; organizationId: string; autor: { id: string | null; email: string }; email: string; nome: string }): Promise<void>`
  - `desenvolver(args: { auditId: string; findingId: string; organizationId: string; autor: { id: string | null; email: string }; email: string; nome: string }): Promise<void>`

- [ ] **Passo 1: escrever a prova que falha**

Criar `scripts/prova-conversa-do-achado.mjs`:

```js
// A CONVERSA DO ACHADO, provada contra o banco.
//
//   node scripts/prova-conversa-do-achado.mjs   (== npm run prova:conversa-achado)
//
// Quatro perguntas que só o banco responde:
//   1. comentar num achado NUNCA atribuído cria a linha sem inventar veredito?
//   2. envolver e desenvolver deixam rastro na conversa?
//   3. apagar o achado leva conversa e envolvidos junto?
//   4. rodar duas vezes duplica alguma coisa?
//
// SEM IA e SEM NAVEGADOR.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { comentar, envolver, desenvolver, garantirLinhaDoAchado } = await import(
  "../lib/achado-compartilhado.ts"
);

const prisma = getPrisma();
const ORG = "org-prosul";
const FINDING = "QA-CONVERSA";
const AUTOR = { id: null, email: "victor@prosul.com" };

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: ORG } },
  select: { id: true },
});
check("existe auditoria com projeto", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const chave = { auditId_targetKey: { auditId: audit.id, targetKey: `finding:${FINDING}` } };
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id, findingId: FINDING } });

// 1. Comentar num achado que ninguém atribuiu.
const linha = await comentar({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
  autor: AUTOR,
  body: "isso é do estrutural, não meu",
});

const gravada = await prisma.auditFeedback.findUnique({
  where: chave,
  select: { id: true, verdict: true, resolvedAt: true, assigneeEmail: true },
});
check("a linha do achado nasceu", Boolean(gravada));
check(
  "comentar NÃO inventa veredito nem desfecho",
  gravada?.verdict === null && gravada?.resolvedAt === null,
  JSON.stringify(gravada),
);
check("comentar NÃO atribui a ninguém", gravada?.assigneeEmail === null);

// 2. Envolver e desenvolver deixam rastro.
await envolver({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
  autor: AUTOR,
  email: "carla@prosul.com",
  nome: "Carla",
});
const comEnvolvido = await prisma.auditFindingWatcher.count({
  where: { feedbackId: linha.id },
});
check("a Carla entrou como envolvida", comEnvolvido === 1, `achei ${comEnvolvido}`);

await desenvolver({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
  autor: AUTOR,
  email: "carla@prosul.com",
  nome: "Carla",
});
const semEnvolvido = await prisma.auditFindingWatcher.count({
  where: { feedbackId: linha.id },
});
check("a Carla saiu dos envolvidos", semEnvolvido === 0, `achei ${semEnvolvido}`);

const kinds = (
  await prisma.auditFindingMessage.findMany({
    where: { feedbackId: linha.id },
    orderBy: { createdAt: "asc" },
    select: { kind: true },
  })
).map((m) => m.kind);
check(
  "sair dos envolvidos NÃO apaga o histórico de ter entrado",
  kinds.join(",") === "comentario,envolveu,desenvolveu",
  kinds.join(","),
);

// 3. Idempotência do `garantirLinhaDoAchado`.
const denovo = await garantirLinhaDoAchado({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
});
check("garantir a linha duas vezes devolve a MESMA", denovo.id === linha.id);
const quantas = await prisma.auditFeedback.count({
  where: { auditId: audit.id, findingId: FINDING },
});
check("existe UMA linha para o achado", quantas === 1, `achei ${quantas}`);

// 4. Cascade.
await prisma.auditFeedback.delete({ where: { id: linha.id } });
const msgs = await prisma.auditFindingMessage.count({ where: { feedbackId: linha.id } });
const wat = await prisma.auditFindingWatcher.count({ where: { feedbackId: linha.id } });
check("apagar o achado leva a conversa junto", msgs === 0, `sobraram ${msgs}`);
check("apagar o achado leva os envolvidos junto", wat === 0, `sobraram ${wat}`);

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-conversa-do-achado.mjs
```

Esperado: FALHA com `Cannot find module '.../lib/achado-compartilhado.ts'`.

**O `--import` não é opcional.** `lib/achado-compartilhado.ts` importa pelo alias
`@/`, e node cru não o resolve — sem o hook o erro é
`Cannot find package '@/lib'`, que aponta para o import quando o problema é a
ausência do resolvedor.

- [ ] **Passo 3: escrever a implementação**

Criar `lib/achado-compartilhado.ts`:

```ts
/**
 * ESCREVER NO ACHADO — a conversa e os envolvidos.
 *
 * Todo caminho que muda um achado passa por aqui, e todo caminho deixa uma linha
 * na conversa. É isso que substitui o portão de permissão: antes, reatribuir
 * sobrescrevia `assigneeEmail` e quem tinha o achado sumia sem rastro. Agora
 * qualquer um do escritório pode agir, e toda ação fica assinada.
 *
 * O FINGERPRINT É CALCULADO AQUI, do relatório gravado, e nunca aceito do
 * cliente — mesma regra de [[fila-de-achados.ts]], e pelo mesmo motivo: ele é a
 * identidade do achado entre versões, e um valor errado só apareceria meses
 * depois, quando a reauditoria não reencontrasse a pendência.
 */
import type { AuditReport } from "@/lib/audit-report";
import { getPrisma } from "@/lib/db";
import { chaveEntreVersoes } from "@/lib/diff-de-pareceres";

export class AchadoRecusado extends Error {
  readonly status: 400 | 404;

  constructor(status: 400 | 404, message: string) {
    super(message);
    this.name = "AchadoRecusado";
    this.status = status;
  }
}

type Autor = { id: string | null; email: string };

/**
 * A LINHA DO ACHADO, criando-a se ainda não existe.
 *
 * Comentar num achado que ninguém atribuiu é legítimo — é justamente o caso de
 * "isso não é meu". Mas a conversa precisa de uma linha para se pendurar (o
 * `Cascade` das duas tabelas depende dela), então comentar cria a linha.
 *
 * O que ela NÃO faz: inventar veredito, desfecho ou responsável. Uma linha
 * nascida de um comentário fica com tudo isso nulo, e é o estado honesto — a
 * pessoa falou, não julgou nem assumiu nada.
 */
export async function garantirLinhaDoAchado(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
}): Promise<{ id: string }> {
  const prisma = getPrisma();

  /*
   * A auditoria é buscada COM o escopo do escritório. Sem isso, alguém com um id
   * de outra organização escreveria dentro dela — mesma guarda de
   * `atribuirAchados`.
   */
  const audit = await prisma.audit.findFirst({
    where: { id: args.auditId, project: { organizationId: args.organizationId } },
    select: { id: true, report: true, projectId: true },
  });

  if (!audit) throw new AchadoRecusado(404, "Auditoria não encontrada.");

  /*
   * SEM PROJETO NÃO HÁ ACHADO COMPARTILHADO — mesma recusa de `atribuirAchados`:
   * a pendência existiria numa fila que ninguém vai abrir.
   */
  if (!audit.projectId) {
    throw new AchadoRecusado(400, "Esta auditoria não pertence a um projeto.");
  }

  const report = audit.report as AuditReport | null;
  const achado = (report?.incongruencias ?? []).find((item) => item.id === args.findingId);

  if (!achado) throw new AchadoRecusado(404, "Achado não encontrado neste parecer.");

  const targetKey = `finding:${args.findingId}`;

  return await prisma.auditFeedback.upsert({
    where: { auditId_targetKey: { auditId: audit.id, targetKey } },
    create: {
      auditId: audit.id,
      targetKey,
      findingId: args.findingId,
      findingLabel: achado.tipo.slice(0, 160),
      page: achado.pagina ? achado.pagina.slice(0, 80) : null,
      fingerprint: chaveEntreVersoes(achado),
    },
    /* Nada. A linha pode já carregar veredito, desfecho e responsável, e
     * garantir a existência dela não é ocasião para mexer em nenhum deles. */
    update: {},
    select: { id: true },
  });
}

/** O teto do corpo de uma mensagem. Generoso, mas finito: o campo é texto livre
 *  e vai para o banco sem passar por nenhuma outra régua. */
const LIMITE_DO_CORPO = 4000;

/** Uma linha na conversa. Todo caminho que muda o achado chama isto. */
export async function registrarNoAchado(args: {
  feedbackId: string;
  kind: string;
  autor: Autor;
  body?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await getPrisma().auditFindingMessage.create({
    data: {
      feedbackId: args.feedbackId,
      kind: args.kind,
      authorEmail: args.autor.email.trim().toLowerCase(),
      authorId: args.autor.id,
      body: (args.body ?? "").trim().slice(0, LIMITE_DO_CORPO),
      ...(args.details ? { details: args.details as never } : {}),
    },
  });
}

export async function comentar(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
  autor: Autor;
  body: string;
}): Promise<{ id: string }> {
  const corpo = args.body.trim();

  // Comentário vazio não é comentário. Recusar aqui, e não só desabilitar o
  // botão: a tela é cortesia, e um POST direto passava por cima dela.
  if (!corpo) throw new AchadoRecusado(400, "Escreva alguma coisa.");

  const linha = await garantirLinhaDoAchado(args);
  await registrarNoAchado({
    feedbackId: linha.id,
    kind: "comentario",
    autor: args.autor,
    body: corpo,
  });

  return linha;
}

export async function envolver(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
  autor: Autor;
  email: string;
  nome: string;
}): Promise<void> {
  const email = args.email.trim().toLowerCase();
  if (!email) throw new AchadoRecusado(400, "Informe quem envolver.");

  const membro = await getPrisma().organizationMember.findFirst({
    where: { organizationId: args.organizationId, email },
    select: { email: true, status: true },
  });

  if (!membro) throw new AchadoRecusado(400, "Essa pessoa não faz parte do escritório.");

  /*
   * DESLIGADO NÃO ENTRA — mesma regra de `atribuirAchados`. INVITED entra: o
   * convite nasce antes da conta, e é no primeiro login que a pessoa encontra o
   * que a esperava.
   */
  if (membro.status === "DISABLED") {
    throw new AchadoRecusado(400, "Essa pessoa foi desligada do escritório.");
  }

  const linha = await garantirLinhaDoAchado(args);

  /*
   * `upsert` e não `create`: envolver duas vezes a mesma pessoa é um clique
   * repetido, não um erro para mostrar na tela. E o `notifiedAt` NÃO é zerado
   * no reencontro — ela já foi avisada deste achado, e reavisar seria repetir a
   * mensagem por causa de um clique.
   */
  const jaEstava = await getPrisma().auditFindingWatcher.findUnique({
    where: { feedbackId_email: { feedbackId: linha.id, email } },
    select: { id: true },
  });

  if (jaEstava) return;

  await getPrisma().auditFindingWatcher.create({
    data: { feedbackId: linha.id, email, addedById: args.autor.id },
  });

  await registrarNoAchado({
    feedbackId: linha.id,
    kind: "envolveu",
    autor: args.autor,
    details: { para: email, paraNome: args.nome.trim() || email },
  });
}

export async function desenvolver(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
  autor: Autor;
  email: string;
  nome: string;
}): Promise<void> {
  const email = args.email.trim().toLowerCase();
  const linha = await garantirLinhaDoAchado(args);

  const removidos = await getPrisma().auditFindingWatcher.deleteMany({
    where: { feedbackId: linha.id, email },
  });

  // Tirar quem não estava é um clique repetido. Registrar mesmo assim poluiria
  // a conversa com um evento que não aconteceu.
  if (removidos.count === 0) return;

  /*
   * SAIR DOS ENVOLVIDOS NÃO APAGA O HISTÓRICO DE TER ENTRADO. O `envolveu`
   * continua na conversa, e o `desenvolveu` entra depois dele: é a diferença
   * entre "a Carla nunca esteve aqui" e "a Carla esteve e saiu".
   */
  await registrarNoAchado({
    feedbackId: linha.id,
    kind: "desenvolveu",
    autor: args.autor,
    details: { para: email, paraNome: args.nome.trim() || email },
  });
}
```

- [ ] **Passo 4: rodar a prova e ver passar**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-conversa-do-achado.mjs
```

Esperado: 13 linhas `OK` e `prova passou`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, depois de `"prova:identidade"`:

```json
"prova:conversa-achado": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-conversa-do-achado.mjs",
```

- [ ] **Passo 6: commit**

```bash
git add lib/achado-compartilhado.ts scripts/prova-conversa-do-achado.mjs package.json
git diff --cached --stat
git commit -m "comentar num achado que ninguém atribuiu cria a linha, e não inventa veredito"
```

---

### Task 5: a atribuição deixa rastro e carrega recado

**Files:**
- Modificar: `lib/fila-de-achados.ts`
- Modificar: `app/api/audits/[id]/atribuir/route.ts`

**Interfaces:**
- Consome: `registrarNoAchado` de `lib/achado-compartilhado.ts` (Task 4).
- Produz: `atribuirAchados` passa a aceitar `recado?: string` e
  `assigneeNome?: string`; a rota aceita `recado` no corpo.

- [ ] **Passo 1: acrescentar o rastro em `atribuirAchados`**

Em `lib/fila-de-achados.ts`, acrescentar ao import:

```ts
import { registrarNoAchado } from "@/lib/achado-compartilhado";
```

Trocar a assinatura de `atribuirAchados` para incluir os dois campos novos:

```ts
export async function atribuirAchados(args: {
  auditId: string;
  findingIds: string[];
  assigneeEmail: string;
  /** O nome de quem recebe, para a frase da conversa não virar um endereço. */
  assigneeNome?: string;
  /**
   * O RECADO que acompanha o encaminhamento — "olha o item 14".
   *
   * Não é uma segunda funcionalidade: vira a primeira fala da conversa daquele
   * achado, na mesma linha do evento `atribuiu`. Um por achado enviado, e não
   * uma linha compartilhada: cada achado tem a sua conversa.
   */
  recado?: string;
  atribuidoPor: { id: string | null; email: string };
  organizationId: string;
}): Promise<{ atribuidos: number }> {
```

Dentro do laço `for (const findingId of args.findingIds)`, logo **antes** do
`const targetKey = ...`, capturar quem estava com o achado:

```ts
    /*
     * QUEM ESTAVA COM O ACHADO, lido antes de sobrescrever.
     *
     * É a informação que a reatribuição apagava. Sem esta leitura, a conversa
     * saberia dizer "passou para a Carla" e não "saiu do Milton" — e o histórico
     * existe justamente para responder a segunda.
     */
    const anterior = await prisma.auditFeedback.findUnique({
      where: { auditId_targetKey: { auditId: audit.id, targetKey: `finding:${findingId}` } },
      select: { assigneeEmail: true },
    });
```

E, logo **depois** do `await prisma.auditFeedback.upsert({...})`, antes de
`atribuidos += 1;`:

```ts
    /*
     * A LINHA NA CONVERSA. É o que substitui o portão de permissão: qualquer um
     * do escritório pode atribuir, e toda atribuição fica assinada.
     */
    const linha = await prisma.auditFeedback.findUniqueOrThrow({
      where: { auditId_targetKey: { auditId: audit.id, targetKey } },
      select: { id: true },
    });

    const trocou = Boolean(anterior?.assigneeEmail) && anterior?.assigneeEmail !== membro.email;

    await registrarNoAchado({
      feedbackId: linha.id,
      kind: trocou ? "reatribuiu" : "atribuiu",
      autor: args.atribuidoPor,
      // O recado vira a fala; sem recado, a linha é só o evento.
      body: args.recado ?? "",
      details: {
        para: membro.email,
        paraNome: (args.assigneeNome ?? "").trim() || membro.email,
        ...(trocou ? { de: anterior?.assigneeEmail } : {}),
      },
    });
```

- [ ] **Passo 2: a rota aceita o recado**

Em `app/api/audits/[id]/atribuir/route.ts`, no tipo do corpo:

```ts
    const corpo = (await request.json().catch(() => null)) as {
      findingIds?: unknown;
      assigneeEmail?: unknown;
      assigneeNome?: unknown;
      recado?: unknown;
    } | null;
```

E logo depois da leitura de `assigneeEmail`:

```ts
    const assigneeNome =
      typeof corpo?.assigneeNome === "string" ? corpo.assigneeNome.trim().slice(0, 120) : "";
    /* O mesmo teto do corpo de uma mensagem, em `achado-compartilhado.ts`. */
    const recado = typeof corpo?.recado === "string" ? corpo.recado.trim().slice(0, 4000) : "";
```

E na chamada:

```ts
    const resultado = await atribuirAchados({
      auditId: id,
      findingIds,
      assigneeEmail,
      assigneeNome,
      recado,
      atribuidoPor: { id: actor.userId, email: actor.email },
      organizationId: actor.organizationId,
    });
```

- [ ] **Passo 3: provar contra o banco que a reatribuição deixa rastro**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs -e "
import('./lib/db.ts').then(async ({ getPrisma }) => {
  const { atribuirAchados } = await import('./lib/fila-de-achados.ts');
  const p = getPrisma();
  const a = await p.audit.findFirst({
    where: { project: { organizationId: 'org-prosul' }, report: { not: null } },
    select: { id: true, report: true },
  });
  const primeiro = a.report.incongruencias[0].id;
  await p.auditFeedback.deleteMany({ where: { auditId: a.id, findingId: primeiro } });
  const base = { auditId: a.id, findingIds: [primeiro], organizationId: 'org-prosul',
                 atribuidoPor: { id: null, email: 'victor@prosul.com' } };
  await atribuirAchados({ ...base, assigneeEmail: 'milton@prosul.com', assigneeNome: 'Milton', recado: 'olha o item 14' });
  await atribuirAchados({ ...base, assigneeEmail: 'carla@prosul.com', assigneeNome: 'Carla' });
  const f = await p.auditFeedback.findFirstOrThrow({ where: { auditId: a.id, findingId: primeiro }, select: { id: true, notifiedAt: true } });
  const msgs = await p.auditFindingMessage.findMany({ where: { feedbackId: f.id }, orderBy: { createdAt: 'asc' }, select: { kind: true, body: true, details: true } });
  console.log(JSON.stringify(msgs, null, 2));
  console.log('notifiedAt zerado na reatribuicao:', f.notifiedAt === null);
  await p.auditFeedback.delete({ where: { id: f.id } });
});
"
```

Esperado: duas mensagens — a primeira `atribuiu` com `body: "olha o item 14"` e
`details.paraNome: "Milton"`; a segunda `reatribuiu` com
`details.de: "milton@prosul.com"` e `details.paraNome: "Carla"`. E
`notifiedAt zerado na reatribuicao: true`.

- [ ] **Passo 4: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint lib/fila-de-achados.ts "app/api/audits/[id]/atribuir/route.ts"
```

- [ ] **Passo 5: commit**

```bash
git add lib/fila-de-achados.ts "app/api/audits/[id]/atribuir/route.ts"
git diff --cached --stat
git commit -m "reatribuir para de apagar quem tinha o achado"
```

---

### Task 6: as rotas da conversa e dos envolvidos

**Files:**
- Criar: `app/api/audits/[id]/achados/[findingId]/conversa/route.ts`
- Criar: `app/api/audits/[id]/achados/[findingId]/envolvidos/route.ts`

**Interfaces:**
- Consome: `comentar`, `envolver`, `desenvolver`, `AchadoRecusado`,
  `garantirLinhaDoAchado` (Task 4); `linhaDoTempo`, `LinhaCrua` (Task 1).
- Produz:
  - `GET  /api/audits/:id/achados/:findingId/conversa` → `{ linhas: LinhaLegivel[], envolvidos: { email, nome }[], euSou: string }`
  - `POST /api/audits/:id/achados/:findingId/conversa` — corpo `{ body: string }`
  - `POST /api/audits/:id/achados/:findingId/envolvidos` — corpo `{ email, nome }`
  - `DELETE /api/audits/:id/achados/:findingId/envolvidos` — corpo `{ email, nome }`

- [ ] **Passo 1: escrever a rota da conversa**

Criar `app/api/audits/[id]/achados/[findingId]/conversa/route.ts`:

```ts
/**
 * A CONVERSA DE UM ACHADO — ler e escrever.
 *
 * Rota por ACHADO, e não por auditoria: é a granularidade em que o trabalho
 * acontece. Uma rota da auditoria inteira devolveria a conversa de trinta
 * achados para desenhar a de um.
 *
 * Quem pode: qualquer pessoa do escritório que enxergue a auditoria
 * (`auditByIdWhereForActor`, via `garantirLinhaDoAchado`). Não há nível novo de
 * permissão, e é decisão: num escritório de um dígito de pessoas, portão gera
 * pedido de liberação, não segurança. O que existe no lugar é rastro — toda
 * ação vira linha assinada.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import {
  AchadoRecusado,
  comentar,
  garantirLinhaDoAchado,
} from "@/lib/achado-compartilhado";
import { linhaDoTempo, type LinhaCrua } from "@/lib/conversa-do-achado";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const VALID_ID = /^[A-Za-z0-9-]{1,80}$/;

function recusa(err: unknown) {
  const negado = accessDeniedResponse(err);
  if (negado) return negado;
  if (err instanceof AchadoRecusado) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

/** Os nomes do escritório, numa consulta só — e não uma por linha. */
async function nomesDe(emails: string[], organizationId: string) {
  const unicos = [...new Set(emails.map((e) => e.toLowerCase()))].filter(Boolean);
  if (unicos.length === 0) return new Map<string, string>();

  const membros = await getPrisma().organizationMember.findMany({
    where: { organizationId, email: { in: unicos } },
    select: { email: true, name: true },
  });

  return new Map(membros.filter((m) => m.name).map((m) => [m.email, m.name as string]));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ linhas: [], envolvidos: [], euSou: actor.email });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const linha = await garantirLinhaDoAchado({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
    });

    const [mensagens, envolvidos] = await Promise.all([
      getPrisma().auditFindingMessage.findMany({
        where: { feedbackId: linha.id },
        orderBy: { createdAt: "asc" },
      }),
      getPrisma().auditFindingWatcher.findMany({
        where: { feedbackId: linha.id },
        orderBy: { addedAt: "asc" },
        select: { email: true },
      }),
    ]);

    const nomes = await nomesDe(
      [...mensagens.map((m) => m.authorEmail), ...envolvidos.map((e) => e.email)],
      actor.organizationId,
    );

    const cruas: LinhaCrua[] = mensagens.map((m) => ({
      kind: m.kind,
      authorEmail: m.authorEmail,
      authorNome: nomes.get(m.authorEmail) ?? "",
      body: m.body,
      details: (m.details as Record<string, unknown> | null) ?? null,
      createdAt: m.createdAt.getTime(),
    }));

    return NextResponse.json({
      linhas: linhaDoTempo(cruas),
      envolvidos: envolvidos.map((e) => ({
        email: e.email,
        // Melhor um endereço do que uma linha sem dono.
        nome: nomes.get(e.email) ?? e.email,
      })),
      /* QUEM ESTÁ LENDO, do servidor — mesma razão do `euSou` na rota de
       * feedback: com duas fontes, o dia em que a sessão trocar sem a árvore
       * remontar a tela atribui a fala à pessoa errada. */
      euSou: actor.email.toLowerCase(),
    });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const corpo = (await request.json().catch(() => null)) as { body?: unknown } | null;

    await comentar({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
      autor: { id: actor.userId, email: actor.email },
      body: typeof corpo?.body === "string" ? corpo.body : "",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}
```

- [ ] **Passo 2: escrever a rota dos envolvidos**

Criar `app/api/audits/[id]/achados/[findingId]/envolvidos/route.ts`:

```ts
/**
 * OS ENVOLVIDOS de um achado — entrar e sair.
 *
 * `POST` envolve, `DELETE` tira. Os dois deixam linha na conversa, e sair NÃO
 * apaga o registro de ter entrado: é a diferença entre "a Carla nunca esteve
 * aqui" e "a Carla esteve e saiu".
 *
 * O RESPONSÁVEL NÃO MORA AQUI. Ele é um, e continua em
 * `AuditFeedback.assigneeEmail`, gravado por `POST /atribuir`. A assimetria é a
 * decisão do desenho: um responde, os outros acompanham.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { AchadoRecusado, desenvolver, envolver } from "@/lib/achado-compartilhado";
import { isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

const VALID_ID = /^[A-Za-z0-9-]{1,80}$/;

function recusa(err: unknown) {
  const negado = accessDeniedResponse(err);
  if (negado) return negado;
  if (err instanceof AchadoRecusado) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

async function ler(request: Request) {
  const corpo = (await request.json().catch(() => null)) as {
    email?: unknown;
    nome?: unknown;
  } | null;

  return {
    email: typeof corpo?.email === "string" ? corpo.email : "",
    nome: typeof corpo?.nome === "string" ? corpo.nome : "",
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const { email, nome } = await ler(request);

    await envolver({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
      autor: { id: actor.userId, email: actor.email },
      email,
      nome,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; findingId: string }> },
) {
  try {
    const actor = await requireActor();
    const { id, findingId } = await params;

    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    if (!VALID_ID.test(id) || !VALID_ID.test(findingId)) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }

    const { email, nome } = await ler(request);

    await desenvolver({
      auditId: id,
      findingId,
      organizationId: actor.organizationId,
      autor: { id: actor.userId, email: actor.email },
      email,
      nome,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const r = recusa(err);
    if (r) return r;
    throw err;
  }
}
```

- [ ] **Passo 3: provar que nenhuma rota ficou aberta**

```bash
npm run prova:rotas
```

Esperado: passa. Esse script varre as rotas e recusa qualquer uma sem portão —
as duas novas usam `requireActor()`.

- [ ] **Passo 4: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint "app/api/audits/[id]/achados"
```

- [ ] **Passo 5: commit**

```bash
git add "app/api/audits/[id]/achados"
git diff --cached --stat
git commit -m "o achado ganha endereço próprio: conversa e envolvidos"
```

---

### Task 7: o aviso alcança os envolvidos

**Files:**
- Modificar: `lib/aviso-de-achados.ts`

**Interfaces:**
- Consome: `quemAvisar`, `AchadoParaAvisar` de `lib/quem-avisar.ts` (Task 2).
- Produz: `quemFaltaAvisar` e `avisarEnvolvidos` passam a incluir os envolvidos;
  as assinaturas públicas não mudam.

- [ ] **Passo 1: trocar a consulta de quem falta avisar**

Em `lib/aviso-de-achados.ts`, acrescentar ao import:

```ts
import { quemAvisar, type AchadoParaAvisar } from "@/lib/quem-avisar";
```

Substituir o corpo de `quemFaltaAvisar` por:

```ts
export async function quemFaltaAvisar(
  auditId: string,
  organizationId: string,
): Promise<PessoaAAvisar[]> {
  await contextoDaAuditoria(auditId, organizationId);

  /*
   * A CONSULTA TRAZ O ACHADO INTEIRO, e não só o e-mail do responsável.
   *
   * A regra deixou de ser "uma pessoa por linha": com envolvidos, um achado tem
   * N pessoas, cada uma com seu próprio `notifiedAt`. Quem decide quem entra é
   * [[lib/quem-avisar.ts]], que é puro e tem teste sem banco — aqui fica só o IO.
   */
  const linhas = await getPrisma().auditFeedback.findMany({
    where: { auditId },
    select: {
      assigneeEmail: true,
      notifiedAt: true,
      resolvedAt: true,
      envolvidos: { select: { email: true, notifiedAt: true } },
    },
  });

  const achados: AchadoParaAvisar[] = linhas.map((l) => ({
    resolvido: l.resolvedAt !== null,
    pessoas: [
      ...(l.assigneeEmail
        ? [
            {
              email: l.assigneeEmail,
              papel: "responsavel" as const,
              notifiedAt: l.notifiedAt?.getTime() ?? null,
            },
          ]
        : []),
      ...l.envolvidos.map((e) => ({
        email: e.email,
        papel: "envolvido" as const,
        notifiedAt: e.notifiedAt?.getTime() ?? null,
      })),
    ],
  }));

  return await comNomes(quemAvisar(achados), organizationId);
}
```

- [ ] **Passo 2: `comNomes` recebe a contagem já feita**

Ainda em `lib/aviso-de-achados.ts`, trocar a assinatura e o começo de `comNomes`:

```ts
/**
 * Resolve os nomes numa consulta só.
 *
 * A CONTAGEM já vem pronta de [[lib/quem-avisar.ts]] — ela era feita aqui, e
 * saiu porque virou regra com N pessoas por achado e merecia teste sem banco.
 * O que sobrou aqui é o que precisa do banco: o nome e o estado do convite.
 */
async function comNomes(
  contados: { email: string; quantidade: number }[],
  organizationId: string,
): Promise<PessoaAAvisar[]> {
  if (contados.length === 0) return [];

  const membros = await getPrisma().organizationMember.findMany({
    where: { organizationId, email: { in: contados.map((c) => c.email) } },
    select: { email: true, name: true, status: true },
  });

  const porEmail = new Map(membros.map((m) => [m.email, m]));

  return contados.map(({ email, quantidade }) => {
    const membro = porEmail.get(email);

    return {
      email,
      nome: membro?.name || email,
      quantidade,
      convidado: membro?.status === "INVITED",
    };
  });
}
```

A ordenação sai daqui — `quemAvisar` já devolve ordenado, e ordenar duas vezes
esconderia de qual das duas a ordem final veio.

- [ ] **Passo 3: marcar o aviso também nos envolvidos**

Em `lib/aviso-de-achados.ts`, dentro de `avisarEnvolvidos`, o bloco que carimba
`notifiedAt` hoje é exatamente este (por volta da linha 420):

```ts
    await prisma.auditFeedback.updateMany({
      where: { ...PENDENTE_DE_AVISO, auditId: args.auditId, assigneeEmail: pessoa.email },
      data: { notifiedAt: new Date() },
    });
```

Substituí-lo por:

```ts
    /* UM instante para os dois carimbos. Duas chamadas a `new Date()` dariam
     * milissegundos diferentes ao responsável e ao envolvido do MESMO envio. */
    const agora = new Date();

    await prisma.auditFeedback.updateMany({
      where: { ...PENDENTE_DE_AVISO, auditId: args.auditId, assigneeEmail: pessoa.email },
      data: { notifiedAt: agora },
    });

    /*
     * O ENVOLVIDO TAMBÉM É MARCADO. Sem isto, o próximo clique no botão mandaria
     * de novo para quem só acompanha — e é exatamente a repetição que
     * `notifiedAt` existe para evitar.
     *
     * O estreitamento segue a mesma lição do comentário acima: esta pessoa,
     * nesta auditoria, e só o que ainda estava pendente.
     */
    await prisma.auditFindingWatcher.updateMany({
      where: {
        email: pessoa.email,
        notifiedAt: null,
        feedback: { auditId: args.auditId },
      },
      data: { notifiedAt: agora },
    });
```

**Preserve o comentário longo que já está dentro do `where` do primeiro
`updateMany`** — ele documenta um defeito real que já foi pago (o spread escrito
depois do e-mail carimbava o parecer inteiro a cada volta do laço).

- [ ] **Passo 4: provar que o aviso não repete**

```bash
npm run prova:aviso
```

Esperado: passa. Esse script já cobre "apertar duas vezes não repete o e-mail"; o
que a mudança precisa é não regredi-lo.

- [ ] **Passo 5: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint lib/aviso-de-achados.ts
```

- [ ] **Passo 6: commit**

```bash
git add lib/aviso-de-achados.ts
git diff --cached --stat
git commit -m "o aviso passa a alcançar quem só acompanha"
```

---

### Task 8: "resolvido" passa a ter um dono só

**Files:**
- Modificar: `modules/nexo/state/conversation-store.tsx`
- Modificar: `modules/nexo/components/PalcoDoNexo.tsx`
- Modificar: `components/audit-result.tsx`

**Interfaces:**
- Consome: `GET /api/audits/[id]/feedback`, que já devolve `resolvedAt` por linha.
- Produz: no store — `esquecerAchadosResolvidos(auditId: string): void`.

- [ ] **Passo 1: o store ganha como esquecer**

Em `modules/nexo/state/conversation-store.tsx`, no tipo do contexto, logo depois
de `marcarAchadoResolvido`:

```tsx
  /**
   * Apaga o progresso LOCAL de uma auditoria, depois de ele ter sido empurrado
   * para o servidor. Ver [[audit-result.tsx]]: é o passo que faz o Postgres
   * virar a única fonte de "resolvido".
   */
  esquecerAchadosResolvidos: (auditId: string) => void;
```

E o callback, ao lado de `marcarAchadoResolvido`:

```tsx
  const esquecerAchadosResolvidos = useCallback(
    (auditId: string) => {
      setAchadosResolvidos((atual) => {
        if (!(auditId in atual)) return atual;
        const proximo = { ...atual };
        delete proximo[auditId];
        return proximo;
      });
      schedulePersist();
    },
    [schedulePersist],
  );
```

Acrescentar `esquecerAchadosResolvidos` ao objeto de valor do provider **e ao
array de dependências do `useMemo`** — são dois lugares, e esquecer o segundo faz
a tela ler um valor velho.

- [ ] **Passo 2: a empurrada, no lugar onde a tela já busca o feedback**

Em `components/audit-result.tsx`, o efeito que faz `GET` em
`` `/api/audits/${encodeURIComponent(auditId)}/feedback` `` (por volta da linha
315) passa a, depois de receber a resposta, empurrar o que só existe local.

Acrescentar duas props ao componente que recebe `auditId` e as usa nesse efeito —
`resolvidosLocais: ReadonlySet<string>` e `aoAbsorverResolvidos: () => void` — e,
dentro do efeito, logo após `setFeedback(payload.feedback)`:

```tsx
        /*
         * A EMPURRADA — uma vez por auditoria, aqui e não no arranque.
         *
         * "Resolvido" morava em dois lugares que se ignoravam: `achadosResolvidos`
         * no JSON privado da conversa e `AuditFeedback.resolvedAt` no Postgres.
         * O Postgres passa a mandar — mas há marcações locais REAIS, e abandoná-las
         * apagaria trabalho de quem usa, em silêncio.
         *
         * Varrer todas as conversas no arranque seria trabalho por auditorias que
         * ninguém abriu. Aqui já se sabe qual é a auditoria e o que o servidor tem.
         */
        const noServidor = new Set(
          payload.feedback
            .filter((f) => f.resolvedAt)
            .map((f) => f.findingId)
            .filter((x): x is string => Boolean(x)),
        );
        const faltando = [...resolvidosLocais].filter((refId) => !noServidor.has(refId));

        if (faltando.length > 0) {
          await Promise.all(
            faltando.map((refId) =>
              fetch(`/api/audits/${encodeURIComponent(auditId)}/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  findingId: refId,
                  /*
                   * SEM VEREDITO. Marcar corrigido não é julgar a IA, e gravar
                   * `verdict` a partir de um clique que nunca julgou contaminaria
                   * o benchmark — o estrago silencioso que
                   * `lib/desfecho-do-achado.ts` descreve.
                   */
                  resolutionKind: "FIXED_IN_DOC",
                }),
              }).catch(() => null),
            ),
          );
        }

        /* Esquecer é o que impede a empurrada de acontecer de novo, e o que faz
         * o servidor virar a única fonte daqui em diante. */
        aoAbsorverResolvidos();
```

- [ ] **Passo 3: o palco lê do servidor e passa o local para a empurrada**

Em `modules/nexo/components/PalcoDoNexo.tsx`, acrescentar
`esquecerAchadosResolvidos` à desestruturação de `useConversation()` que já traz
`achadosResolvidos` e `marcarAchadoResolvido`, e passar ao `<AuditResult>` as
duas props novas:

```tsx
        resolvidosLocais={resolvidosDesta}
        aoAbsorverResolvidos={() => {
          const id = salvo?.auditId;
          if (id) esquecerAchadosResolvidos(id);
        }}
```

`resolvidosDesta` já existe no arquivo (o `useMemo` por volta da linha 152).

- [ ] **Passo 4: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint modules/nexo/state/conversation-store.tsx modules/nexo/components/PalcoDoNexo.tsx components/audit-result.tsx
```

- [ ] **Passo 5: provar no navegador que a marca local sobe**

Com `next dev` reiniciado e `NEXODOC_DEV_AUTH=true`:

1. Entre como `victor@prosul.com`, abra uma auditoria com achados.
2. No console do navegador, plante uma marca local e recarregue:

```js
// Marque um achado pela tela, confirme que ele aparece marcado, e então:
const q = indexedDB.open("nexo");
q.onsuccess = () => {
  const tx = q.result.transaction("conversations", "readonly");
  tx.objectStore("conversations").getAll().onsuccess = (e) =>
    console.log(e.target.result.map((c) => c.achadosResolvidos).filter(Boolean));
};
```

Esperado ANTES do recarregamento: a lista mostra o `refId` marcado.
Esperado DEPOIS: a lista vem vazia (o local foi esquecido), e o achado continua
aparecendo marcado — agora vindo do servidor.

3. Confirme no banco:

```bash
node --import ./scripts/lib/resolver-de-imports.mjs -e "
import('./lib/db.ts').then(async ({ getPrisma }) => {
  const r = await getPrisma().auditFeedback.findMany({
    where: { resolvedAt: { not: null } },
    select: { findingId: true, resolutionKind: true, verdict: true },
    take: 10,
  });
  console.log(r);
});
"
```

Esperado: as linhas com `resolutionKind: 'FIXED_IN_DOC'` e **`verdict: null`**.
Um `verdict` preenchido aqui é falha — significa que a empurrada julgou a IA.

- [ ] **Passo 6: commit**

```bash
git add modules/nexo/state/conversation-store.tsx modules/nexo/components/PalcoDoNexo.tsx components/audit-result.tsx
git diff --cached --stat
git commit -m "resolvido deixa de morar em dois lugares que se ignoravam"
```

---

### Task 9: a conversa na tela

**Files:**
- Criar: `components/achado/linha-da-conversa.tsx`
- Criar: `components/achado/conversa-do-achado.tsx`
- Modificar: `components/audit-result.tsx`

**Interfaces:**
- Consome: as rotas da Task 6; `LinhaLegivel` de `lib/conversa-do-achado.ts`.
- Produz: `<ConversaDoAchado auditId findingId membros />`.

- [ ] **Passo 1: a linha**

Criar `components/achado/linha-da-conversa.tsx`:

```tsx
"use client";

/**
 * UMA LINHA da conversa do achado — fala ou evento.
 *
 * As duas moram na mesma cronologia (ver [[lib/conversa-do-achado.ts]]), e a
 * diferença é de PESO, não de lugar: o evento é uma nota discreta, a fala tem
 * corpo. Separá-las em duas listas contaria a história em duas colunas que o
 * leitor teria que costurar sozinho.
 *
 * A atribuição com recado é os dois ao mesmo tempo — a frase do evento e o
 * texto da pessoa — e por isso os dois campos são renderizados sem `else`.
 */
import type { LinhaLegivel } from "@/lib/conversa-do-achado";

function quando(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LinhaDaConversa({ linha }: { linha: LinhaLegivel }) {
  return (
    <li className="list-none border-l border-border pl-3">
      <p className="m-0 text-[11.5px] leading-5 text-muted-foreground">
        <span className="text-foreground">{linha.quem}</span>
        {linha.frase ? ` ${linha.frase}` : ""}
        <span className="ml-2 font-mono text-[10.5px]">{quando(linha.createdAt)}</span>
      </p>
      {linha.body ? (
        <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] leading-5 text-foreground">
          {linha.body}
        </p>
      ) : null}
    </li>
  );
}
```

- [ ] **Passo 2: a conversa**

Criar `components/achado/conversa-do-achado.tsx`:

```tsx
"use client";

/**
 * A CONVERSA DE UM ACHADO — a lista, o campo de escrever e os envolvidos.
 *
 * Arquivo PRÓPRIO, e não mais trezentas linhas em `audit-result.tsx`. Aquele
 * arquivo tem 4.859 linhas, e é exatamente assim que se chega a 4.859 linhas.
 *
 * Assíncrono de propósito: recarrega ao montar e depois de cada ação, e nada
 * mais. Sem SSE e sem polling — o defeito que este trabalho conserta é estado
 * privado, não latência, e tempo real sobre estado que diverge só faria
 * divergir mais rápido.
 */
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LinhaLegivel } from "@/lib/conversa-do-achado";

import { LinhaDaConversa } from "./linha-da-conversa";

type Envolvido = { email: string; nome: string };
type Membro = { email: string; name?: string | null };

export function ConversaDoAchado({
  auditId,
  findingId,
  membros,
}: {
  auditId: string;
  findingId: string;
  membros: readonly Membro[];
}) {
  const [linhas, setLinhas] = useState<LinhaLegivel[]>([]);
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const base = `/api/audits/${encodeURIComponent(auditId)}/achados/${encodeURIComponent(findingId)}`;

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`${base}/conversa`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const p = (await r.json()) as { linhas?: LinhaLegivel[]; envolvidos?: Envolvido[] };
      setLinhas(p.linhas ?? []);
      setEnvolvidos(p.envolvidos ?? []);
      setErro(null);
    } catch {
      // A conversa é acessória ao parecer: falhar aqui não pode derrubar a tela
      // do achado. Diz o que houve e deixa o resto de pé.
      setErro("Não deu para carregar a conversa.");
    }
  }, [base]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar() {
    const corpo = texto.trim();
    if (!corpo || ocupado) return;
    setOcupado(true);
    try {
      const r = await fetch(`${base}/conversa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: corpo }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Não deu para enviar.");
      }
      setTexto("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para enviar.");
    } finally {
      setOcupado(false);
    }
  }

  async function mexerNoEnvolvido(email: string, nome: string, entra: boolean) {
    setOcupado(true);
    try {
      await fetch(`${base}/envolvidos`, {
        method: entra ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nome }),
      });
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  const disponiveis = membros.filter(
    (m) => !envolvidos.some((e) => e.email === m.email.toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          Acompanham
        </span>
        {envolvidos.length === 0 ? (
          <span className="text-[11.5px] text-muted-foreground">ninguém ainda</span>
        ) : (
          envolvidos.map((e) => (
            <button
              key={e.email}
              type="button"
              disabled={ocupado}
              onClick={() => void mexerNoEnvolvido(e.email, e.nome, false)}
              className="nx-edge-6 px-2 py-0.5 text-[11.5px] [--nx-edge:var(--border)] hover:[--nx-fill:var(--accent)]"
              title="Tirar dos envolvidos"
            >
              {e.nome} ×
            </button>
          ))
        )}
        {disponiveis.length > 0 ? (
          <select
            value=""
            disabled={ocupado}
            onChange={(ev) => {
              const m = disponiveis.find((x) => x.email === ev.target.value);
              if (m) void mexerNoEnvolvido(m.email, m.name ?? "", true);
            }}
            className="bg-transparent text-[11.5px] text-muted-foreground"
            style={{ colorScheme: "dark" }}
          >
            <option value="">+ envolver</option>
            {disponiveis.map((m) => (
              <option key={m.email} value={m.email}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {linhas.map((l, i) => (
          <LinhaDaConversa key={`${l.createdAt}-${i}`} linha={l} />
        ))}
      </ul>

      {linhas.length === 0 ? (
        <p className="m-0 text-[11.5px] text-muted-foreground">
          Nada dito ainda sobre este achado.
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva para quem está neste achado…"
          rows={2}
        />
        <div className="flex items-center justify-between gap-2">
          {erro ? <span className="text-[11.5px] text-muted-foreground">{erro}</span> : <span />}
          <Button onClick={() => void enviar()} disabled={ocupado || !texto.trim()}>
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Passo 3: o campo de recado no lote**

Em `components/audit-result.tsx`, junto do estado do envio em lote (perto de
`const [destinatario, setDestinatario] = useState("");`, linha ~1303):

```tsx
  /* O RECADO do encaminhamento. Vira a primeira fala da conversa de CADA achado
   * enviado — uma linha por achado, e não uma compartilhada. */
  const [recado, setRecado] = useState("");
```

Em `enviarSelecionados`, no corpo do `POST`:

```tsx
          body: JSON.stringify({
            findingIds: [...selecionados],
            assigneeEmail: destinatario,
            assigneeNome: membros.find((m) => m.email === destinatario)?.name ?? "",
            recado,
          }),
```

E, depois do envio bem-sucedido, limpar: `setRecado("");`

No formulário do envio, imediatamente acima do botão que dispara
`enviarSelecionados`, acrescentar:

```tsx
          <Textarea
            value={recado}
            onChange={(e) => setRecado(e.target.value)}
            placeholder="Recado (opcional) — vai junto de cada achado enviado"
            rows={2}
          />
```

- [ ] **Passo 4: montar a conversa no achado**

Ainda em `components/audit-result.tsx`, no bloco que renderiza os detalhes de um
achado (onde `TrechosDoAchado` já é usado), acrescentar logo depois dele:

```tsx
              {auditId && finding.refId ? (
                <ConversaDoAchado
                  auditId={auditId}
                  findingId={finding.refId}
                  membros={membros}
                />
              ) : null}
```

E o import no topo do arquivo:

```tsx
import { ConversaDoAchado } from "@/components/achado/conversa-do-achado";
```

**Nada além disso entra em `audit-result.tsx`.**

- [ ] **Passo 5: conferir tipos e lint**

```bash
npx tsc --noEmit
npx eslint components/achado components/audit-result.tsx
```

- [ ] **Passo 6: commit**

```bash
git add components/achado components/audit-result.tsx
git diff --cached --stat
git commit -m "o achado ganha onde conversar, em arquivo que não é o de 4.859 linhas"
```

---

### Task 10: a prova com duas pessoas

**Files:**
- Criar: `scripts/prova-duas-pessoas-no-achado.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: tudo das tarefas anteriores.
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: escrever a prova**

Criar `scripts/prova-duas-pessoas-no-achado.mjs`:

```js
// DUAS PESSOAS NO MESMO ACHADO — o que este sub-projeto existe para fazer.
//
//   node scripts/prova-duas-pessoas-no-achado.mjs   (== npm run prova:duas-pessoas)
//
// Victor manda um achado ao Milton COM RECADO; o Milton responde que não é
// dele; o Victor vê a resposta. Antes deste trabalho, o Milton só podia
// registrar um DESFECHO — fechar errado ou deixar apodrecer.
//
// Dois contextos do Playwright, como em prova-fila-de-achados.mjs: o login dev
// resolve o usuário pelo e-mail, e cada contexto carrega uma identidade.
//
// SEM IA: a auditoria é a que o seed já deixou.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const VICTOR = "victor@prosul.com";
const MILTON = "milton@prosul.com";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: "org-prosul" }, report: { not: null } },
  select: { id: true, report: true },
});
check("existe auditoria com parecer", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const findingId = audit.report.incongruencias[0].id;
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id, findingId } });

const navegador = await chromium.launch();

// --- Victor atribui com recado, pela API que a tela usa ---
const ctxVictor = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
const pVictor = await ctxVictor.newPage();
await entrarComo(pVictor, VICTOR);

const atribuiu = await pVictor.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/atribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingIds: [fid],
        assigneeEmail: "milton@prosul.com",
        assigneeNome: "Milton",
        recado: "olha o item 14, acho que é o mesmo erro do 084",
      }),
    });
    return r.status;
  },
  [audit.id, findingId],
);
check("o Victor atribuiu com recado", atribuiu === 201, `HTTP ${atribuiu}`);

// --- Milton responde ---
const ctxMilton = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
const pMilton = await ctxMilton.newPage();
await entrarComo(pMilton, MILTON);

const viuOMilton = await pMilton.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, { cache: "no-store" });
    return await r.json();
  },
  [audit.id, findingId],
);
check(
  "o Milton vê o recado do Victor",
  viuOMilton.linhas?.some((l) => l.body?.includes("item 14")),
  JSON.stringify(viuOMilton.linhas),
);
check(
  "o recado veio junto do evento de atribuição",
  viuOMilton.linhas?.[0]?.frase === "atribuiu a Milton",
  viuOMilton.linhas?.[0]?.frase,
);

const respondeu = await pMilton.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "isso é do estrutural, não meu" }),
    });
    return r.status;
  },
  [audit.id, findingId],
);
check("o Milton respondeu", respondeu === 201, `HTTP ${respondeu}`);

// --- Victor vê a resposta ---
const viuOVictor = await pVictor.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, { cache: "no-store" });
    return await r.json();
  },
  [audit.id, findingId],
);
check(
  "o Victor vê a resposta do Milton",
  viuOVictor.linhas?.some((l) => l.body === "isso é do estrutural, não meu"),
  JSON.stringify(viuOVictor.linhas),
);
check(
  "a conversa está em ordem: atribuição primeiro, resposta depois",
  viuOVictor.linhas?.length === 2 &&
    viuOVictor.linhas[0].kind === "atribuiu" &&
    viuOVictor.linhas[1].kind === "comentario",
  viuOVictor.linhas?.map((l) => l.kind).join(","),
);

await navegador.close();
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id, findingId } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: rodar a prova**

Com `next dev` reiniciado e `NEXODOC_DEV_AUTH=true`:

```bash
node scripts/prova-duas-pessoas-no-achado.mjs
```

Esperado: sete linhas `OK` e `prova passou`.

- [ ] **Passo 3: registrar o script**

Em `package.json`, depois de `"prova:conversa-achado"`:

```json
"prova:duas-pessoas": "node scripts/prova-duas-pessoas-no-achado.mjs",
```

- [ ] **Passo 4: rodar tudo o que este trabalho tocou**

```bash
npm run test:conversa-achado && npm run test:quem-avisar \
  && npm run test:desfecho && npm run prova:conversa-achado \
  && npm run prova:fila && npm run prova:aviso \
  && npm run prova:duas-pessoas && npm run prova:rotas \
  && npx tsc --noEmit
```

Esperado: tudo verde. `prova:fila` e `prova:aviso` são os que já existiam — eles
provam que a fila e o aviso não regrediram. Se algo falhar, **não** siga para o
commit.

- [ ] **Passo 5: commit**

```bash
git add scripts/prova-duas-pessoas-no-achado.mjs package.json
git diff --cached --stat
git commit -m "a prova do que isto existe para fazer: dois engenheiros, um achado"
```

---

## O que este plano deixa de propósito para depois

- **E-mail quando alguém responde.** O aviso alcança os envolvidos, mas a
  resposta não dispara mensagem nova. Notificação e link direto são o
  sub-projeto 3, e é lá que essa fiação existe.
- **Ver o achado no PDF.** Sub-projeto 3.
- **Paginação da conversa.** Um achado com quarenta mensagens é sinal de que a
  discussão devia ter saído do campo, não um caso a otimizar antes de existir.
- **Portão de permissão.** Qualquer um do escritório fecha o achado de qualquer
  um. O rastro agora existe para dizer se isso chegou a doer.
- **Renomear `AuditFeedback`.** O nome ficou pequeno; a migração não vale o risco.
