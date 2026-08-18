# O parecer que some — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer o parecer da auditoria sobreviver a sair e voltar da conversa — consertando a corrida que hoje o apaga, e recuperando do servidor os que já se perderam.

**Architecture:** Três peças, nesta ordem. (1) `saveResult` passa a remendar `snapshotRef.current` de forma síncrona e a gravar com `flushPersist`, matando a corrida que faz o flush do `finally` gravar uma lista de resultados anterior à auditoria. (2) A abertura da conversa passa a escolher a cópia por `updatedAt` em vez de por presença, e, se ainda faltar o parecer, busca-o por `auditId` contra `/api/audits/[id]`. (3) As gravações que falham deixam de falhar caladas, com aviso graduado pelo risco. A lógica de decisão de cada peça sai para módulos puros, testáveis em node cru sem navegador e sem token.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19 (React Compiler ativo), IndexedDB, Prisma/Postgres. Testes em node cru (type-stripping), `node:assert/strict`, sem bundler.

**Spec:** `docs/superpowers/specs/2026-08-17-parecer-que-some-design.md`

## Global Constraints

- **Testes rodam com node cru:** import por caminho **relativo com extensão `.ts`**; **nunca** alias `@/` em runtime dentro de módulo que um `scripts/test-*.ts` importe. `import type` é apagado no strip.
- **Módulos puros são puros:** sem IO, sem `process.env`, sem React, sem import de valor com `@/`. É o que permite testá-los sem navegador.
- **Verificar por exit code, nunca pela última linha:** os `scripts/test-*.ts` imprimem "N teste(s) passaram" mesmo com falhas. Use `node scripts/x.ts && echo OK` ou `; echo $?`.
- **Idioma:** código e comentários em pt-BR, seguindo o padrão do repositório.
- **Nenhum token de modelo em nenhuma task.** A reprodução da Task 1 usa uma auditoria que já está gravada no Postgres. Se alguma task parecer exigir rodar uma auditoria nova, PARE e pergunte.
- **"Compila limpo" não é evidência de que roda** (`docs/validacao-2026-08-13.md`). Toda task que muda comportamento de tela termina com a tela ABERTA.
- **React Compiler:** proibido tocar `ref.current` durante o render. Os remendos deste plano são todos dentro de callbacks (`useCallback`), que é onde `salvarMemorial` e `marcarAuditoriaPendente` já fazem o mesmo.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `modules/nexo/lib/results.ts` | modificado. Ganha `aplicarResultado` — a inserção/substituição pura que hoje vive inline no `setResults`. Já é o módulo puro dos resultados e já tem `removerResultado`. |
| `modules/nexo/lib/copia-mais-nova.ts` | **novo.** Puro. Decide qual cópia abrir: disco ou servidor. |
| `modules/nexo/lib/parecer-a-recuperar.ts` | **novo.** Puro. Dado um registro de conversa, qual auditoria falta e pode ser recuperada. |
| `modules/nexo/lib/aviso-de-gravacao.ts` | **novo.** Puro. Dois desfechos de gravação → nível do aviso. |
| `modules/nexo/lib/nexo-db.ts` | modificado. Campos novos em `StoredConversation`: `auditorias` e `artefatosApagados`. |
| `modules/nexo/state/conversation-store.tsx` | modificado. Peça 1 inteira, e a orquestração das peças 2 e 3. |
| `modules/nexo/components/ConfirmationCard.tsx` | modificado. Registra a auditoria na conversa quando ela COMEÇA. |
| `modules/nexo/components/NexoSidebar.tsx` | modificado. Os dois avisos novos, ao lado do que já existe. |
| `modules/nexo/components/NexoWorkspace.tsx` | modificado. `catch` nas três chamadas `void conv.salvarMemorial(...)`. |
| `scripts/test-copia-mais-nova.ts` | **novo.** |
| `scripts/test-parecer-a-recuperar.ts` | **novo.** |
| `scripts/test-aviso-de-gravacao.ts` | **novo.** |
| `scripts/test-nexo-session.ts` | modificado. Cobre `aplicarResultado`. |

A decisão de decomposição: as três decisões novas nascem em arquivos separados porque respondem perguntas diferentes — *"qual cópia abrir?"*, *"o que falta recuperar?"* e *"quão grave é esta falha?"*. `conversation-store.tsx` já tem 1.150 linhas e é onde a corrida nasceu; plantar mais domínio lá dentro repetiria o erro.

---

### Task 1: Provar a corrida antes de consertá-la

A spec (§9) diz que a causa é **dedução, não reprodução**. Esta task existe para não consertar o defeito errado. **Nenhum código de produção muda aqui.**

**A reprodução custa zero token** porque `use-reconectar-auditoria.ts` tem a corrida idêntica (`await saveResult({files: []})` seguido de `marcarAuditoriaPendente(null)`, linhas 82-95) e é disparada por um bilhete que aponta para uma auditoria **já gravada** no Postgres. Nada de modelo é chamado: `consultarAuditoria` só lê.

**Files:**
- Modify (temporariamente, revertido no fim): `modules/nexo/state/conversation-store.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: uma seção de evidência acrescentada à spec. Nenhum símbolo de código.

- [ ] **Step 1: Achar uma auditoria pronta no banco**

```bash
npm run dev
```

Abrir `http://localhost:3000/admin/audits` e anotar o `id` de uma auditoria com status concluído (a do `084_25` serve). Se a lista vier vazia, PARE: sem auditoria gravada não há como reproduzir sem gastar token — reporte isso em vez de rodar uma.

- [ ] **Step 2: Instrumentar o persist**

Em `modules/nexo/state/conversation-store.tsx`, dentro de `persistNow`, logo depois de `const s = snapshotRef.current;`:

```ts
// TEMPORÁRIO — Task 1. Remover antes do commit.
console.log("[persist]", s.results.map((r) => r.artifactId), "bilhete:", s.auditoriaPendente?.auditId ?? null);
```

- [ ] **Step 3: Plantar o bilhete**

Com o Nexo aberto numa conversa qualquer, no console do navegador:

```js
const db = await new Promise((ok) => { const r = indexedDB.open("nexo"); r.onsuccess = () => ok(r.result); });
// Trocar CONV_ID pelo id da conversa aberta (aparece na URL ou em `conversas` no store)
// e AUDIT_ID pelo id anotado no Step 1.
const tx = db.transaction("conversas", "readwrite");
const store = tx.objectStore("conversas");
const rec = await new Promise((ok) => { const r = store.get("CONV_ID"); r.onsuccess = () => ok(r.result); });
rec.auditoriaPendente = { auditId: "AUDIT_ID", artifactId: "auditoria-teste", nivel: "deep", arquivo: "084_25.pdf", inicioMs: Date.now() };
store.put(rec);
```

Recarregar a página com a conversa aberta.

- [ ] **Step 4: Ler a evidência**

O `use-reconectar-auditoria` vai buscar a auditoria pronta e chamar `saveResult` seguido de `marcarAuditoriaPendente(null)`.

Esperado se a corrida for real: a última linha `[persist]` **não** contém `"auditoria-teste"` na lista de artefatos, embora o bilhete apareça como `null`. Ou seja, o flush que limpou o bilhete gravou uma lista de resultados sem o parecer.

Confirmar em seguida que o disco ficou truncado: recarregar a página de novo e verificar que o palco volta vazio.

- [ ] **Step 5: Registrar o resultado na spec**

Acrescentar ao fim de `docs/superpowers/specs/2026-08-17-parecer-que-some-design.md` uma seção `## 10. Reprodução` com: o que foi feito, a saída do `[persist]` colada, e o veredito — **confirmada** ou **refutada**.

Se **refutada**: PARE o plano e reporte. As tasks seguintes assumem a causa (a) e não fazem sentido sem ela.

- [ ] **Step 6: Reverter a instrumentação e commitar só a evidência**

```bash
git checkout -- modules/nexo/state/conversation-store.tsx
git add docs/superpowers/specs/2026-08-17-parecer-que-some-design.md
git commit -m "spec: a corrida do snapshot, reproduzida sem gastar token"
```

---

### Task 2: Peça 1 — o snapshot deixa de mentir para o flush

É a raiz. Depois desta task o defeito para de acontecer; as tasks 3 e 4 existem para o que já se perdeu e para as falhas que sobrarem.

**Files:**
- Modify: `modules/nexo/lib/results.ts`
- Modify: `modules/nexo/state/conversation-store.tsx:710-753` (`saveResult`)
- Test: `scripts/test-nexo-session.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `aplicarResultado<T extends { artifactId: string }>(results: T[], saved: T): T[]` — devolve a lista com `saved` substituindo o de mesmo `artifactId`, ou acrescentado ao fim se não houver. Ordem original preservada.

- [ ] **Step 1: Write the failing test**

Acrescentar a `scripts/test-nexo-session.ts` (seguindo o `test(...)` que o arquivo já define):

```ts
import { aplicarResultado } from "../modules/nexo/lib/results.ts";

test("aplicarResultado acrescenta o que ainda não existe", () => {
  const antes = [{ artifactId: "capa" }];
  const depois = aplicarResultado(antes, { artifactId: "auditoria" });
  assert.deepEqual(depois.map((r) => r.artifactId), ["capa", "auditoria"]);
});

test("aplicarResultado SUBSTITUI no lugar, sem reordenar", () => {
  const antes = [{ artifactId: "capa" }, { artifactId: "auditoria" }, { artifactId: "ld" }];
  const depois = aplicarResultado(antes, { artifactId: "auditoria", novo: true } as never);
  assert.deepEqual(depois.map((r) => r.artifactId), ["capa", "auditoria", "ld"]);
  assert.equal((depois[1] as { novo?: boolean }).novo, true);
});

test("aplicarResultado não muta a lista recebida", () => {
  const antes = [{ artifactId: "capa" }];
  aplicarResultado(antes, { artifactId: "auditoria" });
  assert.equal(antes.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-nexo-session.ts; echo "exit=$?"`
Expected: FALHA — `aplicarResultado` não existe (`exit=1`).

- [ ] **Step 3: Write minimal implementation**

Em `modules/nexo/lib/results.ts`, ao lado de `removerResultado`:

```ts
/**
 * Põe UM artefato na lista: substitui o de mesmo id NO LUGAR, ou acrescenta ao
 * fim. Devolve lista nova — a de entrada não é tocada.
 *
 * Vive aqui, e não inline no store, porque é a transformação que a corrida do
 * snapshot fazia pela metade: o `setResults` a aplicava ao estado do React e o
 * `snapshotRef` — que é o que de fato vai para o disco — ficava com a lista
 * anterior. Uma função só, chamada nos dois lugares, é o que impede as duas
 * cópias de discordarem de novo.
 */
export function aplicarResultado<T extends { artifactId: string }>(
  results: T[],
  saved: T,
): T[] {
  const i = results.findIndex((r) => r.artifactId === saved.artifactId);
  if (i === -1) return [...results, saved];
  const next = [...results];
  next[i] = saved;
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-nexo-session.ts && echo OK`
Expected: `OK`.

- [ ] **Step 5: Usar a função nos dois lados do `saveResult`**

Em `modules/nexo/state/conversation-store.tsx`, trocar o fim de `saveResult` (o bloco `setResults(...)` seguido de `schedulePersist()`) por:

```ts
      /*
       * O SNAPSHOT É REMENDADO AQUI, SINCRONAMENTE — e é este o conserto.
       *
       * `snapshotRef` só acompanha o estado depois do render (ver o effect que
       * o sincroniza). Quem chama `saveResult` costuma dar um `flushPersist`
       * logo em seguida, no mesmo microtask: o `finally` da auditoria limpa o
       * bilhete, e o `saveResult` de artefato sem arquivo (`files: []`) nem
       * chega a ceder o controle. O flush lia então a lista ANTERIOR e ainda
       * cancelava, com `clearTimeout`, o debounce que gravaria o parecer — o
       * trabalho pago sumia do disco E do servidor.
       *
       * `salvarMemorial` e `marcarAuditoriaPendente` já remendavam o campo
       * DELES pelo mesmo motivo. Remendar um campo só deixava `results` velho.
       */
      setResults((prev) => {
        // Regerar o mesmo artefato → revoga os URLs antigos antes de trocar (#4).
        prev.find((r) => r.artifactId === saved.artifactId)
          ?.files.forEach((f) => URL.revokeObjectURL(f.url));
        return aplicarResultado(prev, saved);
      });
      snapshotRef.current = {
        ...snapshotRef.current,
        results: aplicarResultado(snapshotRef.current.results, saved),
      };
      /*
       * FLUSH, não debounce: artefato pago não espera 500ms para existir no
       * disco. O debounce continua certo para digitação; não para um parecer.
       */
      flushPersist();
```

Acrescentar `flushPersist` às dependências do `useCallback` (hoje é `[schedulePersist]`; passa a ser `[flushPersist]`), e o import de `aplicarResultado` ao lado do de `removerResultado`.

- [ ] **Step 6: Verificar que nada mais quebrou**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-nexo-session.ts && echo OK
```
Expected: `OK`.

- [ ] **Step 7: Provar na tela, pelo mesmo caminho da Task 1**

Repetir os Steps 1-4 da Task 1 (bilhete plantado, sem instrumentação). Esperado agora: ao recarregar, **o parecer está no palco**.

Medir também o risco 2 da spec: gerar um volume com vários artefatos em sequência e confirmar que a troca de debounce por flush não deixou a montagem perceptivelmente mais lenta. Se deixou, reportar antes de seguir.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/lib/results.ts modules/nexo/state/conversation-store.tsx scripts/test-nexo-session.ts
git commit -m "parecer: o snapshot deixa de mentir para o flush"
```

---

### Task 3: Peça 2a — a abertura escolhe a cópia por data, não por presença

**Files:**
- Create: `modules/nexo/lib/copia-mais-nova.ts`
- Create: `scripts/test-copia-mais-nova.ts`
- Modify: `modules/nexo/state/conversation-store.tsx:827` (dentro de `restoreConversation`)
- Modify: `package.json` (script `test:copia-mais-nova`)

**Interfaces:**
- Consumes: nada.
- Produces: `escolherCopia(disco: ComData | null, remoto: ComData | null): "disco" | "servidor" | "nenhuma"`, com `type ComData = { updatedAt: number }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-copia-mais-nova.ts`:

```ts
/**
 * QUAL CÓPIA ABRIR — disco ou servidor.
 *
 * A abertura escolhia por PRESENÇA: o disco tinha algo, então o disco vencia.
 * Uma gravação que falhou deixa no disco uma versão velha, e ela eclipsava a
 * cópia boa do servidor — a conversa voltava com as mensagens e sem o parecer.
 *
 *   node scripts/test-copia-mais-nova.ts   (== npm run test:copia-mais-nova)
 */
import assert from "node:assert/strict";

import { escolherCopia } from "../modules/nexo/lib/copia-mais-nova.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

test("servidor mais novo vence — é o caso que o defeito criou", () => {
  assert.equal(escolherCopia({ updatedAt: 100 }, { updatedAt: 200 }), "servidor");
});

test("disco mais novo vence — trabalho offline não é atropelado", () => {
  assert.equal(escolherCopia({ updatedAt: 300 }, { updatedAt: 200 }), "disco");
});

test("empate resolve para o disco, como em fundirListas", () => {
  assert.equal(escolherCopia({ updatedAt: 200 }, { updatedAt: 200 }), "disco");
});

test("sem remoto — inclusive quando a lista remota ainda não carregou", () => {
  assert.equal(escolherCopia({ updatedAt: 100 }, null), "disco");
});

test("só no servidor: outra máquina", () => {
  assert.equal(escolherCopia(null, { updatedAt: 100 }), "servidor");
});

test("nenhuma das duas", () => {
  assert.equal(escolherCopia(null, null), "nenhuma");
});

console.log(`\n${passed} teste(s) de escolha de cópia OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-copia-mais-nova.ts; echo "exit=$?"`
Expected: FALHA — módulo não existe (`exit=1`).

- [ ] **Step 3: Write minimal implementation**

Create `modules/nexo/lib/copia-mais-nova.ts`:

```ts
/**
 * QUAL CÓPIA DA CONVERSA ABRIR.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru.
 *
 * A abertura escolhia por presença — `getConversation` e, só se não houvesse
 * nada, o servidor. O disco continua sendo preferido, e por uma razão que não
 * mudou: é ele que tem os BYTES dos artefatos. O que muda é o critério do
 * desempate, que passa a ser a data — o mesmo que `fundirListas` já usa na
 * listagem, e que o comentário da abertura já dizia ser o certo ("é resolvida
 * na lista, por `updatedAt`, não aqui").
 */

type ComData = { updatedAt: number };

export function escolherCopia(
  disco: ComData | null,
  remoto: ComData | null,
): "disco" | "servidor" | "nenhuma" {
  if (!disco && !remoto) return "nenhuma";
  if (!disco) return "servidor";
  if (!remoto) return "disco";
  /*
   * Empate resolve para o DISCO, como em `fundirListas`: é o que a pessoa tem
   * na frente, e é onde moram os bytes. Trocar por uma cópia sem artefato para
   * ganhar zero milissegundo de frescor seria uma perda disfarçada de correção.
   */
  return remoto.updatedAt > disco.updatedAt ? "servidor" : "disco";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-copia-mais-nova.ts && echo OK`
Expected: `OK`.

- [ ] **Step 5: Registrar o script no package.json**

Em `package.json`, ao lado de `"test:elegibilidade"`:

```json
    "test:copia-mais-nova": "node scripts/test-copia-mais-nova.ts",
```

- [ ] **Step 6: Ligar na abertura da conversa**

Em `modules/nexo/state/conversation-store.tsx`, substituir o bloco que hoje é `let rec = await getConversation(id); if (!rec) { rec = await lerDoServidor(id); ... }` por:

```ts
      const doDisco = await getConversation(id);
      /*
       * A lista remota JÁ está em memória (`remotasRef`, atualizada na
       * montagem) — comparar não custa requisição nenhuma. A busca só acontece
       * quando o servidor é de fato mais novo.
       *
       * Se a lista ainda não carregou, `remoto` é `undefined` e a escolha cai
       * no disco: a abertura NÃO espera a rede. Bloquear toda abertura por um
       * caso raro trocaria uma perda rara por lentidão constante — e a
       * recuperação por `auditId` (peça 2b) cobre o furo sem depender da lista.
       */
      const remoto = remotasRef.current.find((c) => c.id === id) ?? null;
      let rec = doDisco;
      if (escolherCopia(doDisco, remoto) === "servidor") {
        const doServidor = await lerDoServidor(id);
        if (doServidor) {
          rec = doServidor;
          // Desce para este disco: senão toda reabertura pagaria a rede de novo
          // e um F5 offline a perderia.
          await putConversation(doServidor).catch(() => {});
        }
      }
      if (!rec) return null;
```

Acrescentar o import de `escolherCopia`.

- [ ] **Step 7: Verificar**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-copia-mais-nova.ts && echo OK
```
Expected: `OK`.

Abrir o Nexo e confirmar que conversas normais continuam abrindo com os artefatos e os bytes — este passo mexe no caminho de abertura de TODA conversa, e uma regressão aqui é pior que o defeito original.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/lib/copia-mais-nova.ts scripts/test-copia-mais-nova.ts package.json modules/nexo/state/conversation-store.tsx
git commit -m "parecer: a abertura escolhe a copia por data, nao por presenca"
```

---

### Task 4: Peça 2b — o parecer volta pelo `auditId`

É a única camada que recupera o que **já** se perdeu, porque `persistCompletedAudit` grava o parecer no Postgres pelo backend, por fora da corrida.

A lista de exclusões deliberadas entra nesta mesma task de propósito: entregar a recuperação sem ela seria entregar um defeito — o parecer que a pessoa apagou voltaria na próxima abertura, para sempre.

**Files:**
- Create: `modules/nexo/lib/parecer-a-recuperar.ts`
- Create: `scripts/test-parecer-a-recuperar.ts`
- Modify: `modules/nexo/lib/nexo-db.ts` (campos `auditorias` e `artefatosApagados` em `StoredConversation`)
- Modify: `modules/nexo/state/conversation-store.tsx` (persistir os dois campos; `removeResult` registra; recuperar na abertura)
- Modify: `modules/nexo/components/ConfirmationCard.tsx:2260` (registrar a auditoria ao COMEÇAR)
- Modify: `package.json` (script `test:parecer-a-recuperar`)

**Interfaces:**
- Consumes: nada dos módulos anteriores.
- Produces: `parecerARecuperar(rec: RegistroParaRecuperar): AuditoriaRegistrada | null`, com
  `type AuditoriaRegistrada = { auditId: string; artifactId: string }` e
  `type RegistroParaRecuperar = { results: { artifactId: string; kind: string }[]; auditorias?: AuditoriaRegistrada[]; artefatosApagados?: string[] }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-parecer-a-recuperar.ts`:

```ts
/**
 * O QUE FALTA RECUPERAR do servidor, depois de restaurar a conversa.
 *
 * O parecer é gravado no Postgres pelo BACKEND (`persistCompletedAudit`), por
 * fora da corrida do cliente. Então mesmo quando a conversa volta truncada, o
 * trabalho pago existe — falta saber POR QUAL id pedi-lo, e ter o cuidado de
 * não ressuscitar o que a pessoa apagou de propósito.
 *
 *   node scripts/test-parecer-a-recuperar.ts   (== npm run test:parecer-a-recuperar)
 */
import assert from "node:assert/strict";

import {
  parecerARecuperar,
  type RegistroParaRecuperar,
} from "../modules/nexo/lib/parecer-a-recuperar.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const REGISTRADA = { auditId: "a-1", artifactId: "auditoria:1" };

test("auditoria registrada e artefato ausente → recupera", () => {
  const rec: RegistroParaRecuperar = { results: [], auditorias: [REGISTRADA] };
  assert.deepEqual(parecerARecuperar(rec), REGISTRADA);
});

test("o parecer já está lá → nada a fazer", () => {
  const rec: RegistroParaRecuperar = {
    results: [{ artifactId: "auditoria:1", kind: "auditoria" }],
    auditorias: [REGISTRADA],
  };
  assert.equal(parecerARecuperar(rec), null);
});

test("APAGAR CONTINUA SENDO APAGAR — não ressuscita o excluído", () => {
  const rec: RegistroParaRecuperar = {
    results: [],
    auditorias: [REGISTRADA],
    artefatosApagados: ["auditoria:1"],
  };
  assert.equal(parecerARecuperar(rec), null);
});

test("conversa antiga, sem o campo — não quebra e não inventa", () => {
  assert.equal(parecerARecuperar({ results: [] }), null);
});

test("duas auditorias, uma faltando → devolve a que falta", () => {
  const outra = { auditId: "a-2", artifactId: "auditoria:2" };
  const rec: RegistroParaRecuperar = {
    results: [{ artifactId: "auditoria:1", kind: "auditoria" }],
    auditorias: [REGISTRADA, outra],
  };
  assert.deepEqual(parecerARecuperar(rec), outra);
});

test("artefato de outro tipo com o mesmo id não conta como parecer", () => {
  const rec: RegistroParaRecuperar = {
    results: [{ artifactId: "auditoria:1", kind: "capa" }],
    auditorias: [REGISTRADA],
  };
  assert.deepEqual(parecerARecuperar(rec), REGISTRADA);
});

console.log(`\n${passed} teste(s) de parecer a recuperar OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-parecer-a-recuperar.ts; echo "exit=$?"`
Expected: FALHA — módulo não existe (`exit=1`).

- [ ] **Step 3: Write minimal implementation**

Create `modules/nexo/lib/parecer-a-recuperar.ts`:

```ts
/**
 * QUAL PARECER PEDIR DE VOLTA AO SERVIDOR.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru.
 *
 * A auditoria é registrada na conversa quando COMEÇA, não quando termina — é o
 * que a mantém fora do caminho da corrida que apagava o parecer. Se, depois de
 * restaurar, o artefato dela não está na lista, o trabalho pago existe no
 * Postgres e pode ser buscado.
 */

export type AuditoriaRegistrada = { auditId: string; artifactId: string };

export type RegistroParaRecuperar = {
  results: { artifactId: string; kind: string }[];
  auditorias?: AuditoriaRegistrada[];
  /** Artefatos que o usuário apagou DE PROPÓSITO. */
  artefatosApagados?: string[];
};

export function parecerARecuperar(
  rec: RegistroParaRecuperar,
): AuditoriaRegistrada | null {
  const apagados = new Set(rec.artefatosApagados ?? []);
  const presentes = new Set(
    rec.results.filter((r) => r.kind === "auditoria").map((r) => r.artifactId),
  );
  for (const a of rec.auditorias ?? []) {
    if (presentes.has(a.artifactId)) continue;
    /*
     * Apagar precisa continuar sendo apagar. Sem esta linha, o parecer que a
     * pessoa excluiu voltaria em TODA abertura — e um produto que desfaz a
     * exclusão do usuário é pior que um que perde o arquivo, porque o primeiro
     * faz isso para sempre.
     */
    if (apagados.has(a.artifactId)) continue;
    return a;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-parecer-a-recuperar.ts && echo OK`
Expected: `OK`.

- [ ] **Step 5: Registrar o script no package.json**

```json
    "test:parecer-a-recuperar": "node scripts/test-parecer-a-recuperar.ts",
```

- [ ] **Step 6: Abrir espaço no registro da conversa**

Em `modules/nexo/lib/nexo-db.ts`, dentro de `StoredConversation`, ao lado de `achadosResolvidos`:

```ts
  /**
   * As auditorias DISPARADAS nesta conversa, registradas quando COMEÇAM.
   *
   * Existe porque o `auditId` só vivia dentro do `payload` do artefato — o
   * mesmo artefato que se perdia. Registrar na largada põe o id fora do caminho
   * da falha: mesmo que o parecer não chegue ao disco, dá para pedi-lo de volta
   * ao servidor, que o gravou por conta própria.
   *
   * Opcional, como `ajustes`: registro é schemaless, ausente = nenhuma.
   */
  auditorias?: { auditId: string; artifactId: string }[];
  /**
   * Artefatos que o usuário apagou DE PROPÓSITO.
   *
   * Sem esta lista, a recuperação pelo `auditId` traria de volta, em toda
   * abertura, o parecer que ele mandou sumir.
   *
   * Opcional, como `ajustes`: ausente = nada apagado.
   */
  artefatosApagados?: string[];
```

- [ ] **Step 7: Persistir os dois campos**

Em `modules/nexo/state/conversation-store.tsx`:

1. Dois estados novos, ao lado de `achadosResolvidos`:

```ts
  const [auditorias, setAuditorias] = useState<{ auditId: string; artifactId: string }[]>([]);
  const [artefatosApagados, setArtefatosApagados] = useState<string[]>([]);
```

2. Ambos entram no `snapshotRef` inicial e no effect que o sincroniza (mesma lista dos outros campos).

3. Em `persistNow`, ao lado de `achadosResolvidos`:

```ts
      ...(s.auditorias.length > 0 ? { auditorias: s.auditorias } : {}),
      ...(s.artefatosApagados.length > 0 ? { artefatosApagados: s.artefatosApagados } : {}),
```

4. Na restauração, ao lado de `setAjustes(rec.ajustes ?? {})`:

```ts
      setAuditorias(rec.auditorias ?? []);
      setArtefatosApagados(rec.artefatosApagados ?? []);
```

5. Um registrador novo, exposto no contexto (tipo e valor), com gravação imediata pelo mesmo motivo do bilhete:

```ts
  const registrarAuditoria = useCallback(
    (auditId: string, artifactId: string) => {
      const nova = { auditId, artifactId };
      const proximas = snapshotRef.current.auditorias.some((a) => a.auditId === auditId)
        ? snapshotRef.current.auditorias
        : [...snapshotRef.current.auditorias, nova];
      setAuditorias(proximas);
      // Como o bilhete: o snapshot só acompanha o estado depois do render, e
      // esta gravação precisa valer AGORA — é ela que sobrevive à falha.
      snapshotRef.current = { ...snapshotRef.current, auditorias: proximas };
      flushPersist();
    },
    [flushPersist],
  );
```

6. `removeResult` passa a registrar a exclusão, no mesmo padrão:

```ts
      const apagados = snapshotRef.current.artefatosApagados.includes(artifactId)
        ? snapshotRef.current.artefatosApagados
        : [...snapshotRef.current.artefatosApagados, artifactId];
      setArtefatosApagados(apagados);
      snapshotRef.current = { ...snapshotRef.current, artefatosApagados: apagados };
```

(manter o `schedulePersist()` que já existe no fim de `removeResult`)

- [ ] **Step 8: Registrar a auditoria quando ela começa**

Em `modules/nexo/components/ConfirmationCard.tsx`, logo depois do `marcarAuditoriaPendente({...})` da linha ~2260:

```ts
    /*
     * O id vai para a conversa AGORA, e fica.
     *
     * O bilhete é apagado no `finally`; este registro não. É ele que permite
     * pedir o parecer de volta ao servidor se a gravação do artefato falhar.
     */
    registrarAuditoria(auditId, id);
```

Acrescentar `registrarAuditoria` à desestruturação do `useConversation()` (linha ~2158).

- [ ] **Step 9: Recuperar na abertura**

Em `restoreConversation`, depois de o registro vencedor ser escolhido e os resultados reidratados, e **antes** do `return`:

```ts
      /*
       * A REDE POR BAIXO. Se o parecer não veio em nenhuma das duas cópias, ele
       * ainda existe no Postgres — o backend o grava por conta própria, sem
       * passar pela gravação do cliente. Buscar é barato e só acontece quando
       * de fato falta algo.
       */
      const faltando = parecerARecuperar({
        results: restored,
        auditorias: rec.auditorias,
        artefatosApagados: rec.artefatosApagados,
      });
      if (faltando) {
        const resposta = await consultarAuditoria(faltando.auditId).catch(() => null);
        if (resposta?.situacao === "pronta") {
          restored.push({
            artifactId: faltando.artifactId,
            kind: "auditoria",
            summary: `Auditoria — ${resposta.resultado.report.status_geral}`,
            files: [],
            payload: resposta.resultado,
            canvas: {
              label: "Auditoria",
              detail: `${resposta.resultado.report.status_geral} · ${resposta.resultado.report.total_incongruencias} achado(s)`,
            },
            generatedAt: Date.now(),
          });
        }
      }
```

Acrescentar os imports de `parecerARecuperar` e `consultarAuditoria` (este último de `../lib/audit`).

- [ ] **Step 10: Verificar**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-parecer-a-recuperar.ts && echo OK
```
Expected: `OK`.

- [ ] **Step 11: Provar na tela — o teste que dá valor a todo o plano**

Com o dev server no ar e uma auditoria já gravada no Postgres:

1. Abrir a conversa da auditoria e confirmar que o parecer aparece.
2. Simular a perda: no console, apagar o artefato de auditoria do registro no IndexedDB (mas **não** pelo botão de excluir da interface — isso é exclusão deliberada e deve ser respeitada).
3. Recarregar. **Esperado: o parecer volta.**
4. Agora apagar o artefato pelo botão da interface, recarregar, e confirmar que ele **não** volta.

O passo 4 é o que separa recuperação de teimosia.

- [ ] **Step 12: Commit**

```bash
git add modules/nexo/lib/parecer-a-recuperar.ts scripts/test-parecer-a-recuperar.ts package.json modules/nexo/lib/nexo-db.ts modules/nexo/state/conversation-store.tsx modules/nexo/components/ConfirmationCard.tsx
git commit -m "parecer: o auditId sobrevive a falha, e o parecer volta do servidor"
```

---

### Task 5: Peça 3 — as gravações param de falhar caladas

**Files:**
- Create: `modules/nexo/lib/aviso-de-gravacao.ts`
- Create: `scripts/test-aviso-de-gravacao.ts`
- Modify: `modules/nexo/state/conversation-store.tsx:474` (`putConversation`)
- Modify: `modules/nexo/components/NexoSidebar.tsx:909`
- Modify: `modules/nexo/components/NexoWorkspace.tsx:493,512,779`
- Modify: `package.json` (script `test:aviso-gravacao`)

**Interfaces:**
- Consumes: nada.
- Produces: `avisoDeGravacao(disco: "ok" | "falhou", servidor: "ok" | "desligada" | "falhou"): NivelDoAviso`, com `type NivelDoAviso = "nenhum" | "so-disco" | "so-servidor" | "grave"`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-aviso-de-gravacao.ts`:

```ts
/**
 * QUÃO GRAVE É UMA FALHA DE GRAVAÇÃO.
 *
 * Alarme só onde o próximo clique pode custar trabalho. Aviso que aparece à toa
 * é aviso que se aprende a ignorar — e aí ele não serve para o dia em que
 * importa.
 *
 *   node scripts/test-aviso-de-gravacao.ts   (== npm run test:aviso-gravacao)
 */
import assert from "node:assert/strict";

import { avisoDeGravacao } from "../modules/nexo/lib/aviso-de-gravacao.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

test("os dois gravaram → silêncio", () => {
  assert.equal(avisoDeGravacao("ok", "ok"), "nenhum");
});

test("servidor desligado não é falha — o Nexo sempre funcionou assim", () => {
  assert.equal(avisoDeGravacao("ok", "desligada"), "nenhum");
});

test("só o servidor falhou → o aviso que já existe", () => {
  assert.equal(avisoDeGravacao("ok", "falhou"), "so-disco");
});

test("só o disco falhou → trabalho a salvo, aviso informativo", () => {
  assert.equal(avisoDeGravacao("falhou", "ok"), "so-servidor");
});

test("os DOIS falharam → grave", () => {
  assert.equal(avisoDeGravacao("falhou", "falhou"), "grave");
});

test("disco falhou e servidor desligado é GRAVE, não silêncio", () => {
  // Servidor desligado não é rede de segurança: se ele nunca grava, o trabalho
  // está só na aba. É o caso da instalação sem banco, e é o mais perigoso.
  assert.equal(avisoDeGravacao("falhou", "desligada"), "grave");
});

console.log(`\n${passed} teste(s) de aviso de gravação OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-aviso-de-gravacao.ts; echo "exit=$?"`
Expected: FALHA — módulo não existe (`exit=1`).

- [ ] **Step 3: Write minimal implementation**

Create `modules/nexo/lib/aviso-de-gravacao.ts`:

```ts
/**
 * QUÃO ALTO AVISAR quando uma gravação falha.
 *
 * SEM IMPORTS de runtime (nem alias `@/`): roda no node cru.
 *
 * O projeto já pagou caro pelo modo de falhar silencioso — `putConversation`
 * engolia a própria falha na linha seguinte ao comentário que a chamava de "a
 * gravação que vale no instante". Mas gritar em toda falha é o defeito oposto:
 * a maioria delas não põe trabalho nenhum em risco, porque a outra cópia
 * gravou.
 */

export type NivelDoAviso = "nenhum" | "so-disco" | "so-servidor" | "grave";

export function avisoDeGravacao(
  disco: "ok" | "falhou",
  servidor: "ok" | "desligada" | "falhou",
): NivelDoAviso {
  if (disco === "ok") {
    // O trabalho está nesta máquina. Só o servidor falhando é o aviso âmbar que
    // a barra lateral já mostra: "salvo aqui, não no servidor".
    return servidor === "falhou" ? "so-disco" : "nenhum";
  }
  /*
   * O disco falhou. O servidor só é rede de segurança quando de fato GRAVOU:
   * "desligada" significa que ele nunca grava, então o trabalho está só na aba
   * aberta — e fechá-la o perde. É o caso da instalação sem banco, e é o mais
   * perigoso justamente por parecer o normal.
   */
  return servidor === "ok" ? "so-servidor" : "grave";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-aviso-de-gravacao.ts && echo OK`
Expected: `OK`.

- [ ] **Step 5: Registrar o script no package.json**

```json
    "test:aviso-gravacao": "node scripts/test-aviso-de-gravacao.ts",
```

- [ ] **Step 6: O disco deixa de engolir a falha**

Em `modules/nexo/state/conversation-store.tsx`, um estado novo ao lado de `sincronizacao`:

```ts
  const [gravacaoLocal, setGravacaoLocal] = useState<"ok" | "falhou">("ok");
```

E em `persistNow`, substituir o bloco de gravação por:

```ts
    /*
     * O DISCO PRIMEIRO, SEMPRE — e agora ele CONTA quando falha.
     *
     * A linha anterior era `.catch(() => {})`, logo abaixo do comentário que
     * chama esta gravação de "a que vale no instante". Era o modo de falhar
     * que este projeto mais paga: parece que salvou.
     */
    putConversation(rec)
      .then(() => {
        setGravacaoLocal("ok");
        refreshList();
      })
      .catch(() => setGravacaoLocal("falhou"));

    gravarNoServidor(rec).then(setSincronizacao);
```

Expor `gravacaoLocal` no contexto (tipo e valor), ao lado de `sincronizacao`.

- [ ] **Step 7: Os dois avisos novos na barra lateral**

Em `modules/nexo/components/NexoSidebar.tsx`, o prop novo `gravacaoLocal` desce de `NexoWorkspace.tsx:1909` do mesmo jeito que `sincronizacao` (acrescentar aos dois lugares: a chamada e o tipo das props, linha ~143).

Substituir o bloco `{sincronizacao?.estado === "falhou" && (...)}` da linha 909 por:

```tsx
      {(() => {
        const nivel = avisoDeGravacao(
          gravacaoLocal ?? "ok",
          sincronizacao?.estado ?? "desligada",
        );
        if (nivel === "nenhum") return null;

        /*
         * GRAVE tem tratamento próprio: é o único caso em que o trabalho está
         * de fato em risco, e o único que pode custar um parecer pago.
         *
         * `--status-critical-tint` e NÃO `--status-critical` no fundo: o
         * `--nx-fill` translúcido dentro de `.nx-edge-*` deixa a cor da borda
         * atravessar o miolo, e foi assim que o admin renderizou coral sobre
         * coral em 1:1, com o teste passando verde (DESIGN.md §2).
         */
        if (nivel === "grave") {
          return (
            <div
              role="alert"
              className="nx-cut-6 flex items-start gap-2 border-0 bg-[var(--status-critical-tint)] px-2.5 py-2"
            >
              <TriangleAlert
                className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--status-critical)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="text-[11.5px] leading-snug text-foreground">
                Não foi possível salvar este trabalho.
                <span className="block text-muted-foreground">
                  Exporte o parecer antes de fechar esta aba.
                </span>
              </span>
            </div>
          );
        }

        // Os dois casos de meia-falha: âmbar, porque nada se perdeu. O texto diz
        // as duas coisas — o que está garantido e o que não está.
        return (
          <div
            role="status"
            className="nx-cut-6 flex items-start gap-2 border-0 bg-[var(--status-warning)]/5 px-2.5 py-2"
          >
            <CloudOff
              className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]"
              strokeWidth={1.5}
              aria-hidden
            />
            <span className="text-[11.5px] leading-snug text-muted-foreground">
              {nivel === "so-disco"
                ? "Salvo nesta máquina, mas não no servidor."
                : "Salvo no servidor, mas não neste computador."}
              <span className="block text-muted-foreground/70">
                {nivel === "so-disco"
                  ? (sincronizacao?.estado === "falhou" ? sincronizacao.motivo : "")
                  : "O trabalho está seguro. Este navegador pode estar sem espaço."}
              </span>
            </span>
          </div>
        );
      })()}
```

Acrescentar `TriangleAlert` ao import de `lucide-react` (o arquivo já importa `CloudOff` de lá) e o import de `avisoDeGravacao`.

- [ ] **Step 8: O memorial deixa de se perder calado**

Em `modules/nexo/components/NexoWorkspace.tsx`, as três chamadas `void conv.salvarMemorial(...)` (linhas 493, 512, 779) passam a tratar a rejeição. Nas duas que gravam um arquivo (493 e 779):

```ts
      conv.salvarMemorial(file).catch(() => {
        conv.appendMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Não consegui guardar o memorial neste navegador. A auditoria roda normalmente agora, mas se você sair e voltar vai precisar anexar o arquivo de novo.",
        });
      });
```

O `id: crypto.randomUUID()` é obrigatório — `appendMessage` recebe a mensagem inteira, e todas as chamadas vizinhas o passam (ver `NexoWorkspace.tsx:631`). O texto diz as duas coisas, o que está garantido e o que não está, como o aviso da barra lateral.

Na de limpar (`salvarMemorial(null)`, linha 512) basta o `.catch(() => {})` explícito — falhar ao esquecer um arquivo não custa trabalho, e o comentário deve dizer isso.

- [ ] **Step 9: Verificar**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-aviso-de-gravacao.ts && echo OK
```
Expected: `OK`.

- [ ] **Step 10: Abrir a tela e ver os três estados**

Forçar cada caso e OLHAR, não só compilar:

- `"so-disco"`: parar o servidor (ou desligar a rede nas devtools) e editar uma conversa.
- `"so-servidor"` e `"grave"`: no console, embrulhar `putConversation` para rejeitar.

Conferir contraste do estado grave contra o fundo — é exatamente onde o admin já falhou uma vez, com texto coral sobre fundo coral em 1:1.

- [ ] **Step 11: Rodar a suíte inteira**

```bash
for f in scripts/test-*.ts; do node "$f" >/dev/null 2>&1 || echo "FALHOU: $f"; done; echo "varredura concluida"
```
Expected: nenhuma linha `FALHOU`.

- [ ] **Step 12: Commit**

```bash
git add modules/nexo/lib/aviso-de-gravacao.ts scripts/test-aviso-de-gravacao.ts package.json modules/nexo/state/conversation-store.tsx modules/nexo/components/NexoSidebar.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "parecer: gravacao que falha passa a aparecer, graduada pelo risco"
```

---

## Cobertura da spec

| Seção da spec | Task |
|---|---|
| §2(a) corrida do snapshot | Task 1 (prova), Task 2 (conserto) |
| §2(b) `salvarMemorial` silencioso | Task 5, Step 8 |
| §2(c) `putConversation` engole a falha | Task 5, Step 6 |
| §2(d) o eclipse da cópia velha | Task 3 |
| §4 peça 1 | Task 2 |
| §4 peça 2a | Task 3 |
| §4 peça 2b + exclusões deliberadas | Task 4 |
| §4 peça 3 | Task 5 |
| §5 fluxo de abertura | Tasks 3 e 4 |
| §6 aviso graduado | Task 5 |
| §7 fora do escopo | nenhuma task — de propósito |
| §8 testes | um `scripts/test-*.ts` por módulo puro |
| §9 risco 1 (causa é dedução) | Task 1, com portão explícito de PARE |
| §9 risco 2 (flush no caminho do volume) | Task 2, Step 7 |
| §9 risco 3 (exclusões divergem) | Task 4, Step 11 passo 4 |
| §9 risco 4 (aviso demais) | Task 5, Step 10 |
