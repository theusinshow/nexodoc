# O feedback que ensina — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O falso positivo marcado por quem revisa volta rebaixado e carimbado na reauditoria do mesmo documento, sem nada disso passar pelo prompt do modelo.

**Architecture:** A auditoria roda idêntica — mesmo prompt, mesma descoberta. Depois de `sortAuditFindings`, um passo puro cruza os achados com os desfechos `FALSE_POSITIVE` já gravados para aquele projeto, casando por `impressaoDoAchado`. Quem casa é rebaixado (`tier: sugestao`) e ganha o campo `ja_julgado`; nada é removido. A chave do feedback deixa de ser `tipo | evidencia` (16% de reencontro) e passa a ser a impressão digital do documento (50%).

**Tech Stack:** TypeScript, Next.js 16 (App Router), Prisma + Postgres, node com `--experimental-strip-types` (scripts de teste em `scripts/*.ts` rodados por `node`).

## Global Constraints

- **Nada entra no prompt do modelo.** Nenhuma task pode adicionar texto a `getAuditorPrompt`, `learningContext` ou qualquer `input` de chamada de IA.
- **Nada é removido do parecer.** Achado que casa com um desfecho é rebaixado, nunca filtrado da lista.
- **A marca não cruza projeto.** O corte por `projectId` é feito na consulta ao banco, não depois.
- **Só `verdict = FALSE_POSITIVE` ensina.** `FIXED_IN_DOC` e `ACCEPTED_RISK` falam do trabalho, não da qualidade da auditoria.
- Módulos em `lib/` são **puros** quando possível: sem IO, sem `new Date()` implícito — o instante entra por parâmetro.
- Comentários e mensagens de commit em **português**, explicando o *porquê* medido, não o *o quê*.
- Todo teste novo entra como script em `scripts/` e ganha entrada em `package.json`, seguindo o padrão de `test:resumo-esforco`.

---

### Task 1: O núcleo puro que aplica os desfechos

**Files:**
- Create: `lib/desfecho-conhecido.ts`
- Modify: `lib/audit-report.ts` (adicionar `ja_julgado` ao tipo `AuditFinding`, junto dos outros campos opcionais, após `tier?: FindingTier;`)
- Test: `scripts/test-desfecho-conhecido.ts`
- Modify: `package.json` (script `test:desfecho-conhecido`)

**Interfaces:**
- Consumes: `AuditFinding` de `lib/audit-report.ts`; `impressaoDoAchado` de `lib/impressao-do-achado.ts`.
- Produces:
  - `type DesfechoConhecido = { impressao: string; desfecho: "FALSE_POSITIVE"; por: string; em: string; nota?: string }`
  - `function aplicarDesfechosConhecidos(findings: AuditFinding[], conhecidos: DesfechoConhecido[]): { findings: AuditFinding[]; marcados: number }`
  - Campo novo em `AuditFinding`: `ja_julgado?: { desfecho: "FALSE_POSITIVE"; por: string; em: string; nota?: string }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-desfecho-conhecido.ts`:

```ts
/**
 * O DESFECHO CONHECIDO REBAIXA, E NUNCA REMOVE.
 *
 * Medido em 18/08/2026: a chave antiga do feedback reencontrava o achado em 16%
 * das reauditorias do mesmo documento. Estes testes travam o comportamento da
 * chave nova — e travam, sobretudo, que nada saia da lista.
 *
 *   node scripts/test-desfecho-conhecido.ts  (== npm run test:desfecho-conhecido)
 */
import assert from "node:assert/strict";

import { impressaoDoAchado } from "../lib/impressao-do-achado.ts";
import {
  aplicarDesfechosConhecidos,
  type DesfechoConhecido,
} from "../lib/desfecho-conhecido.ts";

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

const achado = (p: Record<string, unknown>) => p as never;

/** O falso positivo real do 117_25: o nome da obra por extenso. */
const O_FALSO_POSITIVO = achado({
  id: "INC-010",
  arquivo: "117_25_md_geral_a.pdf",
  origem: "regra",
  tipo: "Nome de obra/unidade divergente no mesmo documento",
  pagina: "215",
  evidencia: "“UBS – Unidade Básica de Saúde Vila Manaus Porte 1, em Criciúma, SC”",
  conflito: "diverge da obra declarada",
  prioridade: "Alta",
  confianca: "alta",
  impacto: "critico_documental",
});

/** Achado legítimo, na mesma página, com outro trecho. */
const O_LEGITIMO = achado({
  id: "INC-011",
  arquivo: "117_25_md_geral_a.pdf",
  origem: "ia",
  tipo: "Unidade dimensional errada",
  pagina: "215",
  evidencia: "“espessura de 0,254 microns”",
  conflito: "unidade incompatível",
  prioridade: "Alta",
  confianca: "alta",
  impacto: "tecnico_contratual",
});

const marcado: DesfechoConhecido = {
  impressao: impressaoDoAchado(O_FALSO_POSITIVO),
  desfecho: "FALSE_POSITIVE",
  por: "matheusmendes077@gmail.com",
  em: "2026-08-18T12:00:00.000Z",
  nota: "É o nome correto da obra, por extenso.",
};

test("o achado marcado é rebaixado e carimbado", () => {
  const { findings, marcados } = aplicarDesfechosConhecidos(
    [O_FALSO_POSITIVO, O_LEGITIMO],
    [marcado],
  );
  assert.equal(marcados, 1);
  const alvo = findings.find((f) => f.id === "INC-010")!;
  assert.equal(alvo.tier, "sugestao");
  assert.equal(alvo.confianca, "baixa");
  assert.equal(alvo.impacto, "revisao_editorial");
  assert.equal(alvo.ja_julgado?.desfecho, "FALSE_POSITIVE");
  assert.equal(alvo.ja_julgado?.por, "matheusmendes077@gmail.com");
  assert.match(alvo.ja_julgado?.nota ?? "", /nome correto da obra/);
});

test("NADA é removido da lista", () => {
  /*
   * A guarda que vale mais que todas as outras. Suprimir seria esconder achado,
   * e um achado suprimido é invisível: se a supressão estiver errada, o parecer
   * afirma ausência de um defeito que ele deixou de procurar.
   */
  const { findings } = aplicarDesfechosConhecidos([O_FALSO_POSITIVO, O_LEGITIMO], [marcado]);
  assert.equal(findings.length, 2);
  assert.ok(findings.some((f) => f.id === "INC-010"));
});

test("o achado legítimo da mesma página passa intacto", () => {
  const { findings } = aplicarDesfechosConhecidos([O_FALSO_POSITIVO, O_LEGITIMO], [marcado]);
  const outro = findings.find((f) => f.id === "INC-011")!;
  assert.equal(outro.tier, undefined);
  assert.equal(outro.confianca, "alta");
  assert.equal(outro.ja_julgado, undefined);
});

test("sem desfecho conhecido, a lista volta idêntica", () => {
  const { findings, marcados } = aplicarDesfechosConhecidos([O_FALSO_POSITIVO], []);
  assert.equal(marcados, 0);
  assert.deepEqual(findings, [O_FALSO_POSITIVO]);
});

test("desfecho de OUTRO arquivo não alcança", () => {
  // `impressaoDoAchado` começa pelo nome do arquivo: um desfecho marcado no
  // memorial não pode alcançar o tomo estrutural do mesmo projeto.
  const doTomo: DesfechoConhecido = {
    ...marcado,
    impressao: impressaoDoAchado(
      achado({ ...O_FALSO_POSITIVO, arquivo: "117_25_est_tomo1.pdf" }),
    ),
  };
  const { marcados } = aplicarDesfechosConhecidos([O_FALSO_POSITIVO], [doTomo]);
  assert.equal(marcados, 0);
});

test("dois achados com a mesma impressão são ambos marcados", () => {
  // Não é o caso comum, mas marcar só o primeiro deixaria o segundo na lista
  // principal contradizendo o julgamento que já foi dado.
  const gemeo = achado({ ...O_FALSO_POSITIVO, id: "INC-020" });
  const { marcados } = aplicarDesfechosConhecidos([O_FALSO_POSITIVO, gemeo], [marcado]);
  assert.equal(marcados, 2);
});

console.log(`\n${passed} teste(s) de desfecho conhecido OK`);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test:desfecho-conhecido`
Expected: FALHA — `Cannot find module '../lib/desfecho-conhecido.ts'`. O script `package.json` ainda não existe, então antes disso adicione a entrada:

```json
"test:desfecho-conhecido": "node scripts/test-desfecho-conhecido.ts",
```

- [ ] **Step 3: Adicionar `ja_julgado` ao tipo**

Em `lib/audit-report.ts`, logo depois da linha `tier?: FindingTier;`:

```ts
  /**
   * Quem revisa já julgou este achado, numa auditoria anterior do mesmo
   * documento, e disse que ele é falso positivo.
   *
   * O achado NÃO some — ele volta rebaixado e com o carimbo. Suprimir seria
   * esconder achado, e um achado suprimido é invisível: se a supressão estiver
   * errada, ninguém descobre, e o parecer passa a afirmar ausência de um defeito
   * que ele deixou de procurar.
   *
   * `por` e `em` existem para que a marca seja contestável: quem discorda sabe
   * com quem falar.
   */
  ja_julgado?: {
    desfecho: "FALSE_POSITIVE";
    por: string;
    em: string;
    nota?: string;
  };
```

- [ ] **Step 4: Escrever o módulo**

Criar `lib/desfecho-conhecido.ts`:

```ts
/**
 * O QUE QUEM REVISA JÁ JULGOU, APLICADO DEPOIS DA AUDITORIA.
 *
 * A descoberta roda idêntica — mesmo prompt, mesmos achados. Isto é
 * pós-processamento, e é de propósito: o modelo nunca é informado de nada, e por
 * isso não pode se confundir com uma instrução que não recebeu.
 *
 * O achado que casa com um `FALSE_POSITIVE` já marcado sai rebaixado para a
 * camada recolhível, com quem marcou e quando. Não sai da lista.
 *
 * Só `FALSE_POSITIVE` entra aqui. `FIXED_IN_DOC` e `ACCEPTED_RISK` dizem
 * respeito ao TRABALHO ("já corrigi"), não à qualidade da auditoria — é a mesma
 * separação que [[desfecho-do-achado.ts]] guarda, e misturá-las contaminaria o
 * benchmark com achados que ninguém disse serem falsos.
 *
 * PURO: recebe os achados e os desfechos, devolve os achados. Sem IO.
 */
import type { AuditFinding } from "./audit-report.ts";
import { impressaoDoAchado } from "./impressao-do-achado.ts";

export type DesfechoConhecido = {
  /** `impressaoDoAchado` calculada no momento em que a marcação foi feita. */
  impressao: string;
  desfecho: "FALSE_POSITIVE";
  /** E-mail de quem marcou. A marca precisa ser contestável. */
  por: string;
  /** ISO. */
  em: string;
  nota?: string;
};

export function aplicarDesfechosConhecidos(
  findings: AuditFinding[],
  conhecidos: DesfechoConhecido[],
): { findings: AuditFinding[]; marcados: number } {
  if (conhecidos.length === 0) {
    return { findings, marcados: 0 };
  }

  const porImpressao = new Map<string, DesfechoConhecido>();
  for (const c of conhecidos) {
    if (c.desfecho !== "FALSE_POSITIVE") continue;
    // O primeiro vence: duas marcações do mesmo achado são a mesma decisão.
    if (!porImpressao.has(c.impressao)) porImpressao.set(c.impressao, c);
  }

  let marcados = 0;
  const saida = findings.map((finding) => {
    const conhecido = porImpressao.get(impressaoDoAchado(finding));
    if (!conhecido) return finding;

    marcados++;
    return {
      ...finding,
      tier: "sugestao" as const,
      confianca: "baixa" as const,
      impacto: "revisao_editorial" as const,
      ja_julgado: {
        desfecho: conhecido.desfecho,
        por: conhecido.por,
        em: conhecido.em,
        ...(conhecido.nota ? { nota: conhecido.nota } : {}),
      },
    };
  });

  return { findings: saida, marcados };
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm run test:desfecho-conhecido`
Expected: `6 teste(s) de desfecho conhecido OK`

- [ ] **Step 6: Conferir tipos**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E 'desfecho-conhecido|audit-report'`
Expected: nenhuma linha.

- [ ] **Step 7: Commit**

```bash
git add lib/desfecho-conhecido.ts lib/audit-report.ts scripts/test-desfecho-conhecido.ts package.json
git commit -m "feedback: o achado ja julgado volta rebaixado, e nao some

Nucleo puro do aprendizado por feedback. O achado que casa com um
FALSE_POSITIVE ja marcado sai rebaixado para a camada recolhivel, com quem
marcou e quando — e continua na lista.

Suprimir seria esconder achado, e achado suprimido e invisivel: se a supressao
estiver errada, o parecer passa a afirmar ausencia de um defeito que ele deixou
de procurar. E a mesma doutrina que o projeto pagou em 12/08/2026.

So FALSE_POSITIVE entra. FIXED_IN_DOC e ACCEPTED_RISK falam do TRABALHO, nao da
qualidade da auditoria — misturar contaminaria o benchmark."
```

---

### Task 2: A chave que o feedback grava

**Files:**
- Modify: `app/api/audits/[id]/feedback/route.ts` (bloco `const data = {...}`, hoje em `:240-255`)
- Modify: `lib/diff-de-pareceres.ts:61-63` (`chaveEntreVersoes` passa a delegar)
- Test: `scripts/test-chave-entre-versoes.ts`
- Modify: `package.json` (script `test:chave-entre-versoes`)

**Interfaces:**
- Consumes: `impressaoDoAchado` de `lib/impressao-do-achado.ts`; `AuditFinding`.
- Produces: `chaveEntreVersoes(finding: AuditFinding): string` passa a devolver exatamente `impressaoDoAchado(finding)`. A coluna `AuditFeedback.fingerprint` passa a ser preenchida com esse valor.

**Contexto que o implementador não tem:** a coluna `fingerprint` existe no schema desde antes, documentada como "a identidade do achado ENTRE VERSÕES", e **nada nunca a gravou**. Esta task é a primeira a preenchê-la.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-chave-entre-versoes.ts`:

```ts
/**
 * A CHAVE ENTRE VERSÕES NÃO PODE DEPENDER DA REDAÇÃO DO MODELO.
 *
 * Ela era `tipo | evidencia[0:120]`, e `tipo` é texto livre que o modelo
 * reescreve a cada corrida. Medido nas três corridas Deep do 117_25 em
 * 18/08/2026: reencontrava o achado em 16% das reauditorias do MESMO documento.
 *
 *   node scripts/test-chave-entre-versoes.ts  (== npm run test:chave-entre-versoes)
 */
import assert from "node:assert/strict";

import { chaveEntreVersoes } from "../lib/diff-de-pareceres.ts";
import { impressaoDoAchado } from "../lib/impressao-do-achado.ts";

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

const achado = (p: Record<string, unknown>) => p as never;

test("o mesmo defeito com o tipo reescrito dá a mesma chave", () => {
  /*
   * Caso real: entre as corridas 1 e 2 do 117_25 o modelo trocou
   * "Unidade de seção de condutor errada" por "Unidade de seção incorreta".
   * Mesma página, mesma transcrição.
   */
  const antes = achado({
    arquivo: "117_25_md_geral_a.pdf",
    tipo: "Unidade de seção de condutor errada",
    pagina: "113",
    evidencia: "“Ramal de ligação aéreo: Alumínio multiplexado de # 35m²”",
  });
  const depois = achado({
    arquivo: "117_25_md_geral_a.pdf",
    tipo: "Unidade de seção incorreta",
    pagina: "113",
    evidencia: "“Ramal de ligação aéreo: Alumínio multiplexado de # 35m²”",
  });
  assert.equal(chaveEntreVersoes(antes), chaveEntreVersoes(depois));
});

test("a chave é exatamente a impressão do achado", () => {
  // Uma fonte só. Duas chaves para o mesmo conceito divergiriam com o tempo.
  const f = achado({
    arquivo: "m.pdf",
    tipo: "X",
    pagina: "92",
    evidencia: "“UBS Paraíso – Porte 1”",
  });
  assert.equal(chaveEntreVersoes(f), impressaoDoAchado(f));
});

test("defeitos diferentes na mesma página continuam com chaves diferentes", () => {
  const externa = achado({
    arquivo: "m.pdf",
    tipo: "Premissa climática",
    pagina: "159-202",
    evidencia: 'Página 159: “Temperatura de bulbo seco (TBS): 32,0°C”.',
  });
  const interna = achado({
    arquivo: "m.pdf",
    tipo: "Premissa interna",
    pagina: "159-202",
    evidencia: 'Página 159: “Temperatura de bulbo seco (TBS): 24°C”.',
  });
  assert.notEqual(chaveEntreVersoes(externa), chaveEntreVersoes(interna));
});

console.log(`\n${passed} teste(s) de chave entre versões OK`);
```

Adicionar em `package.json`:

```json
"test:chave-entre-versoes": "node scripts/test-chave-entre-versoes.ts",
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test:chave-entre-versoes`
Expected: FALHA no primeiro teste — as chaves diferem, porque `tipo` entra nelas.

- [ ] **Step 3: Fazer `chaveEntreVersoes` delegar**

Em `lib/diff-de-pareceres.ts`, substituir o corpo da função (linhas 61-63):

```ts
export function chaveEntreVersoes(finding: AuditFinding): string {
  /*
   * DELEGA, e não duplica.
   *
   * Era `tipo | evidencia[0:120]`, e `tipo` é redação livre: entre duas corridas
   * do MESMO documento o modelo troca "Unidade de seção de condutor errada" por
   * "Unidade de seção incorreta" sem nada ter mudado no memorial. Medido em
   * 18/08/2026 nas três corridas do 117_25 — a chave antiga reencontrava 16% dos
   * achados, e a impressão do achado reencontra 50%, sem fundir nenhum par.
   *
   * Duas chaves para o mesmo conceito divergem com o tempo. Esta existe para o
   * diff entre pareceres e a coluna `AuditFeedback.fingerprint` usa a mesma —
   * são a mesma pergunta: "é o mesmo achado de antes?".
   */
  return impressaoDoAchado(finding);
}
```

E adicionar o import no topo do arquivo, junto dos demais:

```ts
import { impressaoDoAchado } from "./impressao-do-achado.ts";
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test:chave-entre-versoes`
Expected: `3 teste(s) de chave entre versões OK`

- [ ] **Step 5: Gravar o fingerprint no POST do feedback**

Em `app/api/audits/[id]/feedback/route.ts`, antes do bloco `const data = {`, inserir:

```ts
  /*
   * A IMPRESSÃO É CALCULADA NO SERVIDOR, lendo o parecer.
   *
   * O corpo da requisição traz `findingId`, `findingLabel` e `page`, mas não a
   * evidência — e é a evidência que ancora a chave. Calcular aqui também impede
   * que o cliente mande uma chave errada, de propósito ou por bug de tela.
   *
   * A coluna existe desde antes e nunca foi preenchida: sem ela, o feedback não
   * tinha como reencontrar o achado na reauditoria, e o aprendizado se perdia
   * inteiro sem nada no log dizendo isso.
   */
  const auditParaImpressao = await getPrisma().audit.findUnique({
    where: { id },
    select: { report: true },
  });
  const incongruencias =
    ((auditParaImpressao?.report as Record<string, unknown> | null)
      ?.incongruencias as AuditFinding[] | undefined) ?? [];
  const achadoDoParecer = findingId
    ? incongruencias.find((f) => String(f.id) === findingId)
    : undefined;
  const fingerprint = achadoDoParecer ? impressaoDoAchado(achadoDoParecer) : null;
```

E, dentro de `const data = {`, logo depois de `page: ...`:

```ts
    fingerprint,
```

Imports a adicionar no topo do arquivo:

```ts
import type { AuditFinding } from "@/lib/audit-report";
import { impressaoDoAchado } from "@/lib/impressao-do-achado";
```

- [ ] **Step 6: Conferir tipos**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E 'feedback/route|diff-de-pareceres'`
Expected: nenhuma linha.

- [ ] **Step 7: Rodar a suíte que toca o diff**

Run: `npm run test:audit && npm run test:impressao-achado`
Expected: ambos OK. Se `test:audit` reclamar do diff, o motivo é real e precisa ser lido — a chave mudou de significado.

- [ ] **Step 8: Commit**

```bash
git add lib/diff-de-pareceres.ts "app/api/audits/[id]/feedback/route.ts" scripts/test-chave-entre-versoes.ts package.json
git commit -m "feedback: a chave para de depender da redacao do modelo

`chaveEntreVersoes` era `tipo | evidencia`, e `tipo` e texto livre que o modelo
reescreve a cada corrida. Medido nas tres corridas Deep do 117_25: reencontrava
o achado em 16% das reauditorias do MESMO documento. Passa a delegar para
`impressaoDoAchado`, que mede 50% sem fundir nenhum par.

A coluna `AuditFeedback.fingerprint` existia desde antes, documentada como a
identidade do achado entre versoes, e NADA nunca a gravou. Agora e preenchida —
no servidor, lendo o parecer, porque o corpo da requisicao nao traz a evidencia
e porque o cliente nao deve poder mandar chave errada."
```

---

### Task 3: A auditoria aplica o que já foi julgado

**Files:**
- Create: `lib/desfechos-do-projeto.ts`
- Modify: `app/api/audit/route.ts` (bloco de montagem de `findings`, hoje em `:4001-4030`, logo após `semNotasDeConsolidacao`)
- Test: `scripts/test-desfechos-do-projeto.ts`
- Modify: `package.json` (script `test:desfechos-projeto`)

**Interfaces:**
- Consumes: `DesfechoConhecido` da Task 1; Prisma client de `lib/db`.
- Produces: `async function lerDesfechosDoProjeto(args: { projectId: string | null; prisma: PrismaLike }): Promise<DesfechoConhecido[]>`, onde `PrismaLike` é o mínimo que a função usa — declarado no próprio módulo para o teste poder passar um dublê sem banco.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-desfechos-do-projeto.ts`:

```ts
/**
 * O DESFECHO NÃO CRUZA PROJETO, E AUDITORIA SEM PROJETO NÃO LÊ NADA.
 *
 * Falso positivo marcado costuma ser sintoma de REGRA errada, e regra errada se
 * conserta na regra. Propagar a supressão pelo escritório trataria o sintoma e
 * deixaria a causa viva — calada — em todos os outros projetos.
 *
 *   node scripts/test-desfechos-do-projeto.ts  (== npm run test:desfechos-projeto)
 */
import assert from "node:assert/strict";

import { lerDesfechosDoProjeto } from "../lib/desfechos-do-projeto.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** Dublê: guarda o `where` recebido e devolve linhas fixas. */
function prismaFalso(linhas: unknown[]) {
  const chamadas: unknown[] = [];
  return {
    chamadas,
    auditFeedback: {
      findMany: async (args: unknown) => {
        chamadas.push(args);
        return linhas;
      },
    },
    user: {
      findMany: async () => [{ id: "u1", email: "matheus@x.com" }],
    },
  };
}

await test("filtra por projeto NA CONSULTA, e só FALSE_POSITIVE", async () => {
  const prisma = prismaFalso([]);
  await lerDesfechosDoProjeto({ projectId: "proj-1", prisma: prisma as never });
  const where = (prisma.chamadas[0] as { where: Record<string, unknown> }).where;
  assert.equal(where.verdict, "FALSE_POSITIVE");
  assert.deepEqual(where.audit, { projectId: "proj-1" });
});

await test("auditoria sem projeto não consulta o banco", async () => {
  // Sem projeto não há linhagem, e casar por chave solta atravessaria obras.
  const prisma = prismaFalso([{ fingerprint: "x" }]);
  const r = await lerDesfechosDoProjeto({ projectId: null, prisma: prisma as never });
  assert.deepEqual(r, []);
  assert.equal(prisma.chamadas.length, 0, "não pode nem chegar a consultar");
});

await test("linha sem fingerprint é descartada", async () => {
  // As marcações gravadas antes de 18/08/2026 não têm a coluna preenchida.
  const prisma = prismaFalso([
    { fingerprint: null, note: "antiga", createdAt: new Date(), resolvedById: null },
    {
      fingerprint: "m.pdf|215|ubsunidadebasicad|1",
      note: "é o nome por extenso",
      createdAt: new Date("2026-08-18T12:00:00Z"),
      resolvedById: "u1",
    },
  ]);
  const r = await lerDesfechosDoProjeto({ projectId: "p", prisma: prisma as never });
  assert.equal(r.length, 1);
  assert.equal(r[0].impressao, "m.pdf|215|ubsunidadebasicad|1");
  assert.equal(r[0].por, "matheus@x.com");
  assert.equal(r[0].desfecho, "FALSE_POSITIVE");
  assert.match(r[0].nota ?? "", /nome por extenso/);
});

await test("sem e-mail de quem marcou, a marca ainda vale", async () => {
  // A marca precisa ser contestável, mas perder o autor não pode perder o dado.
  const prisma = prismaFalso([
    { fingerprint: "abc", note: null, createdAt: new Date("2026-08-18T12:00:00Z"), resolvedById: null },
  ]);
  const r = await lerDesfechosDoProjeto({ projectId: "p", prisma: prisma as never });
  assert.equal(r.length, 1);
  assert.ok(r[0].por.length > 0);
});

console.log(`\n${passed} teste(s) de desfechos do projeto OK`);
```

Adicionar em `package.json`:

```json
"test:desfechos-projeto": "node scripts/test-desfechos-do-projeto.ts",
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm run test:desfechos-projeto`
Expected: FALHA — `Cannot find module '../lib/desfechos-do-projeto.ts'`.

- [ ] **Step 3: Escrever o módulo**

Criar `lib/desfechos-do-projeto.ts`:

```ts
/**
 * OS DESFECHOS QUE VALEM PARA ESTA AUDITORIA.
 *
 * O corte por projeto é feito NA CONSULTA, e não depois: o dado de outro projeto
 * nunca chega a ser carregado. Falso positivo marcado costuma ser sintoma de
 * REGRA errada, e regra errada se conserta na regra — propagar a supressão pelo
 * escritório trataria o sintoma e deixaria a causa viva, calada, nos outros
 * projetos. Foi assim que os quatro falsos positivos de identidade do 113-22
 * sobreviveram até 18/08/2026.
 *
 * Projeto é o pré-filtro; o ARQUIVO é o corte fino, e quem o faz é a própria
 * `impressaoDoAchado`, que começa pelo nome do arquivo.
 */
import type { DesfechoConhecido } from "./desfecho-conhecido.ts";

/** O mínimo que esta função usa do Prisma, para o teste poder dublar. */
type PrismaLike = {
  auditFeedback: {
    findMany: (args: unknown) => Promise<
      {
        fingerprint: string | null;
        note: string | null;
        createdAt: Date;
        resolvedById: string | null;
      }[]
    >;
  };
  user: {
    findMany: (args: unknown) => Promise<{ id: string; email: string }[]>;
  };
};

/** Quantas marcações carregar. Teto largo: são poucas por projeto. */
const TETO = 500;

export async function lerDesfechosDoProjeto(args: {
  projectId: string | null;
  prisma: PrismaLike;
}): Promise<DesfechoConhecido[]> {
  /*
   * Sem projeto não há linhagem. Casar por chave solta atravessaria obras
   * diferentes — exatamente o que a decisão de alcance recusa.
   */
  if (!args.projectId) return [];

  const linhas = await args.prisma.auditFeedback.findMany({
    where: {
      verdict: "FALSE_POSITIVE",
      audit: { projectId: args.projectId },
    },
    select: {
      fingerprint: true,
      note: true,
      createdAt: true,
      resolvedById: true,
    },
    orderBy: { createdAt: "desc" },
    take: TETO,
  });

  /*
   * QUEM MARCOU vem numa segunda consulta, e não num `include`.
   *
   * `AuditFeedback` não tem relação com `User` — só o id solto em
   * `resolvedById`, que a rota preenche com `actor.userId` justamente no caminho
   * do desfecho, que é o nosso. Sem relação declarada não há `include`, e
   * inventar uma exigiria migração para ganhar um nome de pessoa.
   */
  const ids = [...new Set(linhas.map((l) => l.resolvedById).filter(Boolean))] as string[];
  const usuarios =
    ids.length > 0
      ? await args.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })
      : [];
  const emailPorId = new Map(usuarios.map((u) => [u.id, u.email]));

  return linhas
    /*
     * Marcação gravada antes de 18/08/2026 não tem a coluna preenchida. Ela não
     * é recalculável — o parecer da época pode ter sumido — e fica órfã. Nada é
     * apagado; ela apenas para de casar, que já era o comportamento em 84% dos
     * casos.
     */
    .filter((l) => Boolean(l.fingerprint))
    .map((l) => ({
      impressao: l.fingerprint as string,
      desfecho: "FALSE_POSITIVE" as const,
      por: (l.resolvedById ? emailPorId.get(l.resolvedById) : undefined) ?? "(autor não registrado)",
      em: l.createdAt.toISOString(),
      ...(l.note ? { nota: l.note } : {}),
    }));
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm run test:desfechos-projeto`
Expected: `4 teste(s) de desfechos do projeto OK`

- [ ] **Step 5: Ligar na rota da auditoria**

Em `app/api/audit/route.ts`, localizar o bloco que hoje começa em `const semEscrituracao = semNotasDeConsolidacao(`. **Depois** de `const findings = sortAuditFindings(...).map(...)` terminar (o `.map` que atribui `INC-xxx`), inserir:

```ts
    /*
     * O QUE QUEM REVISA JÁ JULGOU.
     *
     * Aplicado DEPOIS de tudo, e de propósito: a descoberta rodou idêntica, com
     * o mesmo prompt. O modelo nunca é informado de nada — e por isso não pode
     * se confundir com uma instrução que não recebeu.
     *
     * Nada é removido: o achado marcado volta rebaixado, com quem marcou e
     * quando. Ver [[desfecho-conhecido.ts]].
     */
    const desfechosConhecidos = isDatabaseConfigured()
      ? await lerDesfechosDoProjeto({ projectId, prisma: getPrisma() as unknown as Parameters<typeof lerDesfechosDoProjeto>[0]["prisma"] })
      : [];
    const comDesfecho = aplicarDesfechosConhecidos(findings, desfechosConhecidos);
    if (comDesfecho.marcados > 0) {
      console.log(
        `[audit] ${comDesfecho.marcados} achado(s) rebaixado(s) por julgamento anterior de quem revisa`,
      );
    }
```

E trocar, na montagem do relatório, `incongruencias: findings` por:

```ts
      incongruencias: comDesfecho.findings,
```

Imports a adicionar no topo, junto dos demais `@/lib/...`:

```ts
import { aplicarDesfechosConhecidos } from "@/lib/desfecho-conhecido";
import { lerDesfechosDoProjeto } from "@/lib/desfechos-do-projeto";
```

`getPrisma` e `isDatabaseConfigured` já são importados de `@/lib/db` neste arquivo.

- [ ] **Step 6: Conferir tipos e suíte**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E 'audit/route|desfecho'`
Expected: nenhuma linha.

Run: `npm run test:audit && npm run test:audit:metrics && npm run test:desfecho-conhecido && npm run test:desfechos-projeto`
Expected: todos OK.

- [ ] **Step 7: Commit**

```bash
git add lib/desfechos-do-projeto.ts scripts/test-desfechos-do-projeto.ts app/api/audit/route.ts package.json
git commit -m "feedback: a auditoria aplica o que quem revisa ja julgou

O passo entra DEPOIS de tudo — dedupe, filtros, ordenacao — e isso e o desenho,
nao um detalhe de implementacao: a descoberta roda identica, com o mesmo prompt,
e o modelo nunca e informado de nada. A IA nao pode se confundir com uma
instrucao que ela nao recebe.

O corte por projeto e feito NA CONSULTA. Auditoria sem projeto nao le desfecho
nenhum: sem projeto nao ha linhagem, e casar por chave solta atravessaria obras
diferentes.

Marcacao gravada antes desta versao nao tem fingerprint e fica orfa. Nada e
apagado; ela apenas para de casar, que ja era o comportamento em 84% dos casos."
```

---

### Task 4: A prova contra dado real

**Files:**
- Create: `scripts/prova-feedback-sobrevive.mjs`
- Modify: `package.json` (script `prova:feedback-sobrevive`)

**Interfaces:**
- Consumes: `impressaoDoAchado`; os três pareceres já versionados em `docs/benchmarks/117-25/`.
- Produces: nada importado por outras tasks. Sai com código 1 se a sobrevivência cair abaixo de 45%.

**Contexto:** os três pareceres são corridas Deep do MESMO documento, com o mesmo prompt, feitas em 18/08/2026. A diferença entre eles é só a variação do modelo — que é exatamente o que a chave precisa atravessar.

- [ ] **Step 1: Escrever a prova**

Criar `scripts/prova-feedback-sobrevive.mjs`:

```js
/**
 * QUANTO DO FEEDBACK SOBREVIVE À REAUDITORIA.
 *
 * Fixture prova a regra; isto prova o número. Os três pareceres do 117_25 são
 * corridas Deep do MESMO documento com o mesmo prompt — a diferença entre eles é
 * só a variação do modelo, que é o que a chave precisa atravessar.
 *
 * A chave antiga (`tipo | evidencia`) media 16%: quem revisasse marcaria dez
 * falsos positivos e oito voltariam sem marca, sem nada no log dizendo isso.
 *
 *   node scripts/prova-feedback-sobrevive.mjs
 */
import fs from "node:fs";

import { impressaoDoAchado } from "../lib/impressao-do-achado.ts";

const PISO = 45; // medido: 50%. A margem existe para acusar regressao sem disparar por ruido.

const parecer = (sufixo) =>
  JSON.parse(
    fs.readFileSync(`docs/benchmarks/117-25/parecer-nexodoc-2026-08-18${sufixo}.json`, "utf8"),
  ).report.incongruencias;

const A = parecer("");
const B = parecer("-corrida2");
const C = parecer("-corrida3");

const antiga = (f) =>
  `${String(f.tipo ?? "").toLowerCase()}|${String(f.evidencia ?? "").replace(/\s+/g, " ").slice(0, 120).toLowerCase()}`;

function sobrevivencia(chave) {
  const kB = new Set(B.map(chave));
  const kC = new Set(C.map(chave));
  const em2 = A.filter((f) => kB.has(chave(f))).length;
  const em3 = A.filter((f) => kB.has(chave(f)) && kC.has(chave(f))).length;
  return { em2, em3, pct2: Math.round((100 * em2) / A.length) };
}

const velha = sobrevivencia(antiga);
const nova = sobrevivencia(impressaoDoAchado);

console.log(`achados na corrida 1: ${A.length}\n`);
console.log(`chave ANTIGA (tipo | evidencia) .. ${velha.em2}/${A.length} = ${velha.pct2}%`);
console.log(`chave NOVA  (impressao) ......... ${nova.em2}/${A.length} = ${nova.pct2}%`);
console.log(`   nas tres corridas ............ ${nova.em3}/${A.length}`);

/* Colisao dentro de uma corrida: dois achados distintos que herdariam a mesma marca. */
const colisoes = A.length - new Set(A.map(impressaoDoAchado)).size;
console.log(`\nachados distintos com a mesma impressao: ${colisoes}`);

if (colisoes > 0) {
  console.error("\nFALHOU: a chave funde achados distintos — um julgamento marcaria o outro.");
  process.exit(1);
}

if (nova.pct2 < PISO) {
  console.error(`\nFALHOU: sobrevivencia ${nova.pct2}% abaixo do piso de ${PISO}%.`);
  process.exit(1);
}

console.log(`\nOK — ${nova.pct2}% sobrevivem, acima do piso de ${PISO}%, sem fundir nada.`);
```

Adicionar em `package.json`:

```json
"prova:feedback-sobrevive": "node scripts/prova-feedback-sobrevive.mjs",
```

- [ ] **Step 2: Rodar a prova**

Run: `npm run prova:feedback-sobrevive`
Expected:

```
chave ANTIGA (tipo | evidencia) .. 9/58 = 16%
chave NOVA  (impressao) ......... 29/58 = 50%
achados distintos com a mesma impressao: 0
OK — 50% sobrevivem, acima do piso de 45%, sem fundir nada.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/prova-feedback-sobrevive.mjs package.json
git commit -m "feedback: a prova de que a chave atravessa a variacao do modelo

Fixture prova a regra; isto prova o numero. Os tres pareceres do 117_25 sao
corridas Deep do MESMO documento com o mesmo prompt — a diferenca entre eles e
so a variacao do modelo, que e o que a chave precisa atravessar.

16% com a chave antiga, 50% com a nova, zero fusao. Falha abaixo de 45%: a
margem existe para acusar regressao sem disparar por ruido."
```

---

### Task 5: A severidade errada entra na fila

**Files:**
- Modify: `scripts/fila-de-regras-contestadas.ts` (após o agrupamento das contestações da validação)
- Test: nenhum novo — o script é um relatório de leitura, e a lógica que ele usa (agrupar por regra) já está exercitada.

**Interfaces:**
- Consumes: `AuditFeedback` com `verdict = WRONG_SEVERITY`; `Audit.report.incongruencias` para descobrir a origem e o tipo do achado marcado.
- Produces: nada importado.

**Contexto:** `WRONG_SEVERITY` não tem onde ancorar em achado de IA — o `tipo` muda a cada corrida. Em achado de **regra** ancora, porque a regra é determinística. Por isso só a origem regra entra, e a saída é um relatório, não um ajuste.

- [ ] **Step 1: Ler o arquivo antes de editar**

Run: `sed -n '1,40p' scripts/fila-de-regras-contestadas.ts`
O script hoje lê `runtime.regras_contestadas` das auditorias e agrupa por `tipo`.

- [ ] **Step 2: Acrescentar a leitura das marcações de severidade**

Depois do laço que preenche `porRegra`, e antes do `console.log` do total, inserir:

```ts
/*
 * A SEVERIDADE ERRADA ENTRA NA MESMA FILA, e pelo mesmo motivo: uma marcação
 * pode ser a pessoa errando; a mesma regra rebaixada muitas vezes é a régua
 * errada.
 *
 * Só achado de ORIGEM REGRA entra. Em achado de IA o `tipo` muda a cada corrida
 * e não há identidade estável para agregar — contar por ali somaria coisas
 * diferentes e o número mentiria.
 *
 * Nada é ajustado automaticamente. Três pessoas podem errar pelo mesmo motivo, e
 * uma régua que se move sozinha move-se também quando está errada. O conserto é
 * uma linha na regra.
 */
const severidadePorRegra = new Map<string, number>();

for (const a of audits) {
  const incongruencias = ((a.report as Record<string, unknown>)?.incongruencias ??
    []) as { id?: string; tipo?: string; origem?: string }[];
  const porId = new Map(incongruencias.map((f) => [String(f.id), f]));

  const marcacoes = await prisma.auditFeedback.findMany({
    where: { auditId: a.id, verdict: "WRONG_SEVERITY" },
    select: { findingId: true },
  });

  for (const m of marcacoes) {
    const achado = m.findingId ? porId.get(m.findingId) : undefined;
    if (!achado || achado.origem !== "regra" || !achado.tipo) continue;
    severidadePorRegra.set(achado.tipo, (severidadePorRegra.get(achado.tipo) ?? 0) + 1);
  }
}

if (severidadePorRegra.size > 0) {
  console.log("=".repeat(76));
  console.log("SEVERIDADE MARCADA COMO ERRADA (só achados de regra)");
  console.log("=".repeat(76));
  for (const [tipo, n] of [...severidadePorRegra].sort((x, y) => y[1] - x[1])) {
    console.log(`  ${String(n).padStart(3)}x  ${tipo}`);
  }
  console.log(
    "\n  Nada foi ajustado. O conserto e uma linha na regra — e ele so se justifica\n" +
      "  quando a mesma regra aparece varias vezes.\n",
  );
}
```

- [ ] **Step 3: Rodar o script**

Run: `npm run fila:regras-contestadas`
Expected: roda sem erro. A seção de severidade só aparece se houver marcação `WRONG_SEVERITY` sobre achado de regra — num banco sem essas marcações, ela não é impressa, e isso é o correto.

- [ ] **Step 4: Conferir tipos**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep fila-de-regras`
Expected: nenhuma linha.

- [ ] **Step 5: Commit**

```bash
git add scripts/fila-de-regras-contestadas.ts
git commit -m "feedback: a severidade marcada como errada entra na fila de revisao

Mesma fila das contestacoes da validacao, e pelo mesmo motivo: uma marcacao pode
ser a pessoa errando; a mesma regra rebaixada muitas vezes e a regua errada.

So achado de ORIGEM REGRA entra. Em achado de IA o `tipo` muda a cada corrida e
nao ha identidade estavel para agregar — contar por ali somaria coisas
diferentes e o numero mentiria.

Nada e ajustado sozinho. Tres pessoas podem errar pelo mesmo motivo, e uma regua
que se move sozinha move-se tambem quando esta errada."
```

---

### Task 6: A tela mostra o carimbo

**Files:**
- Modify: `modules/nexo/components/FindingCardNode.tsx` (o bloco `data.tier === "sugestao"` em `:74-77`, onde já se desenha o selo "Sugestão")
- Test: `scripts/prova-ja-julgado.mjs` (asserção de DOM não basta — ver Step 3)

**Interfaces:**
- Consumes: `AuditFinding.ja_julgado` da Task 1.
- Produces: nada importado.

**Contexto que o implementador não tem:** o projeto já aprendeu que asserção de DOM passa verde com o elemento fora da tela. A prova precisa medir a caixa contra a janela, não só a existência do nó. O molde está em `scripts/prova-visivel*.mjs` ou equivalente — procure com `grep -rln "getBoundingClientRect" scripts/`.

- [ ] **Step 1: Ler o card antes de editar**

Run: `sed -n '60,95p' modules/nexo/components/FindingCardNode.tsx`
O selo "Sugestão" já é desenhado quando `data.tier === "sugestao"`. O carimbo do
julgamento entra logo abaixo dele, porque explica **por que** aquele achado está
rebaixado — sem ele, o card vira um achado enfraquecido sem motivo.

- [ ] **Step 2: Renderizar o carimbo**

No card do achado, quando `finding.ja_julgado` existir, mostrar acima da descrição:

```tsx
{finding.ja_julgado ? (
  <p className="achado-ja-julgado">
    Você marcou como falso positivo em{" "}
    {new Date(finding.ja_julgado.em).toLocaleDateString("pt-BR")}
    {finding.ja_julgado.por ? ` · ${finding.ja_julgado.por}` : null}
    {finding.ja_julgado.nota ? ` — "${finding.ja_julgado.nota}"` : null}
  </p>
) : null}
```

O estilo segue o das demais marcas do card; não criar paleta nova.

- [ ] **Step 3: Provar que aparece na tela**

Criar `scripts/prova-ja-julgado.mjs` seguindo o molde do script de prova visual que você encontrou no Step 1 do contexto. A asserção tem de ser: o elemento existe **e** sua caixa (`getBoundingClientRect`) está dentro da janela, com largura e altura maiores que zero.

Semear o estado com um parecer que tenha um achado com `ja_julgado`, sem chamar o modelo — o molde de semeadura está em `scripts/shot-audit-reconexao.mjs`.

- [ ] **Step 4: Rodar a prova**

Run: `node scripts/prova-ja-julgado.mjs`
Expected: o carimbo aparece dentro da janela.

- [ ] **Step 5: Commit**

```bash
git add scripts/prova-ja-julgado.mjs
git commit -m "feedback: o carimbo do julgamento anterior aparece no card

O achado rebaixado precisa dizer POR QUE esta rebaixado, senao ele vira um
achado enfraquecido sem explicacao — e quem le o parecer perde a informacao de
que alguem ja decidiu aquilo.

A prova mede a caixa contra a janela, e nao so a existencia do no: este projeto
ja teve asseracao de DOM passando verde com o painel fora da tela."
```

---

## Ordem e dependências

- **Task 1** é a base: nada depende dela para existir, e tudo depende dela.
- **Task 2** pode ir em paralelo com a 1 — ela só precisa de `impressaoDoAchado`, que já existe.
- **Task 3** exige a 1 (o núcleo) e a 2 (a coluna preenchida).
- **Task 4** exige a 2 (a chave nova).
- **Task 5** e **Task 6** são independentes entre si e exigem a 1.

## Como saber que não estragou nada

Depois da Task 3, rodar a suíte inteira:

```bash
for t in test:audit test:audit:metrics test:audit-identity test:audit:reuso \
         test:impressao-achado test:nota-consolidacao test:resumo-esforco \
         test:falha-transitoria test:contestacao test:desfecho-conhecido \
         test:desfechos-projeto test:chave-entre-versoes; do
  printf "%-28s " "$t"; npm run "$t" --silent >/dev/null 2>&1 && echo OK || echo FALHOU
done
npm run varredura:deterministica | tail -3
npm run prova:feedback-sobrevive
```

A varredura tem de continuar em **23 achados nos 5 memoriais**: nenhuma task deste plano mexe na descoberta, e qualquer mudança nesse número é sinal de que alguma mexeu.
