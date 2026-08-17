# Reuso da auditoria — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar o motor de reuso que já existe em `lib/audit-reuso.ts`, para que reauditar um memorial releia só os capítulos que mudaram e herde os achados dos que não mudaram.

**Architecture:** `/api/audit` passa a receber `auditIdAnterior`, carregar o parecer anterior, comparar impressões digitais e chamar `planejarReuso` — tudo antes de gastar um token. A leitura por blocos fica restrita a `plano.capitulosParaLer` e a leitura global recebe o texto dos capítulos mudados mais os resumos (`runtime.sintese`) dos inalterados. A versão do auditor deixa de ser constante à mão e vira um hash da configuração real.

**Tech Stack:** TypeScript, Next.js 16 (App Router), Prisma, `node:crypto`. Testes em node cru (type-stripping), `node:assert/strict`, sem bundler.

## Global Constraints

- **Testes rodam com node cru:** import por caminho **relativo com extensão `.ts`**; **nunca** alias `@/` em runtime dentro de módulo que um `scripts/test-*.ts` importe. `import type` é apagado no strip.
- **Idioma:** código e comentários em pt-BR, seguindo o padrão do repositório.
- **`lib/audit-reuso.ts` é PURO:** sem IO, sem `process.env`, sem import de valor com `@/`. É o que permite testá-lo sem token.
- **Nada de token nos testes automatizados.** A prova com modelo é manual e separada.
- **Verificar por exit code, nunca pela última linha:** os `scripts/test-*.ts` imprimem "N teste(s) passaram" mesmo com falhas. Use `node scripts/x.ts; echo $?` ou `&&`.
- **Spec:** `docs/superpowers/specs/2026-08-17-reuso-da-auditoria-design.md`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/versao-do-auditor.ts` | **novo.** Deriva o hash da configuração do auditor. Puro: recebe os valores, não os busca. |
| `lib/audit-reuso.ts` | modificado. `planejarReuso` passa a receber `versaoAtual` em vez de ler constante. |
| `lib/audit-report.ts` | modificado. `versao_auditor` vira `string`; `herdado_de` no achado. |
| `lib/elegibilidade-da-base.ts` | **novo.** Decide se um parecer anterior serve de base. Puro. |
| `app/api/audit/route.ts` | modificado. Orquestra: carrega base, planeja, restringe passadas, funde. |
| `modules/nexo/lib/audit.ts` | modificado. Envia `auditIdAnterior`. |
| `components/audit-result.tsx` | modificado. Faixa de reauditoria + selo no cartão. |
| `scripts/test-versao-do-auditor.ts` | **novo.** |
| `scripts/test-elegibilidade-da-base.ts` | **novo.** |
| `scripts/test-audit-reuso.ts` | modificado. Cobre `versaoAtual` e o merge. |

A decisão de decomposição: `versao-do-auditor.ts` e `elegibilidade-da-base.ts` nascem separados de `audit-reuso.ts` porque respondem perguntas diferentes — *"o auditor é o mesmo?"* e *"esta base presta?"* contra *"o que reler?"*. `route.ts` já tem 3.900 linhas e é o pior lugar do repositório para plantar domínio novo.

---

### Task 1: A versão do auditor, derivada

**Files:**
- Create: `lib/versao-do-auditor.ts`
- Test: `scripts/test-versao-do-auditor.ts`
- Modify: `package.json` (script `test:versao-auditor`)

**Interfaces:**
- Consumes: nada.
- Produces: `versaoDoAuditor(config: ConfiguracaoDoAuditor): string` — hash de 12 caracteres. `type ConfiguracaoDoAuditor = { prompt: string; modeloGlobal: string; modeloBloco: string; modeloValidacao: string; esforco: string; tamanhoDoBloco: number }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-versao-do-auditor.ts`:

```ts
/**
 * A VERSÃO DO AUDITOR é derivada, não digitada.
 *
 * Era `VERSAO_AUDITOR = 1`, uma constante que alguém precisava lembrar de subir
 * ao mexer no prompt ou no modelo. Em 17/08/2026 o modelo dos blocos mudou de
 * `sol` para `terra` e o agrupamento de 28k para 10k sem ninguém subir nada —
 * achado herdado seria de um auditor que não existe mais.
 *
 *   node scripts/test-versao-do-auditor.ts
 */
import assert from "node:assert/strict";

import { versaoDoAuditor, type ConfiguracaoDoAuditor } from "../lib/versao-do-auditor.ts";

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

const BASE: ConfiguracaoDoAuditor = {
  prompt: "Você audita memoriais descritivos. Peque pelo excesso.",
  modeloGlobal: "gpt-5.6-sol",
  modeloBloco: "gpt-5.6-terra",
  modeloValidacao: "gpt-5.6-sol",
  esforco: "medium",
  tamanhoDoBloco: 10000,
};

test("mesma configuração, mesma versão", () => {
  assert.equal(versaoDoAuditor(BASE), versaoDoAuditor({ ...BASE }));
});

test("versão é curta e estável no formato", () => {
  const v = versaoDoAuditor(BASE);
  assert.match(v, /^[0-9a-f]{12}$/);
});

test("uma vírgula no prompt já invalida", () => {
  const outro = versaoDoAuditor({ ...BASE, prompt: `${BASE.prompt},` });
  assert.notEqual(outro, versaoDoAuditor(BASE));
});

test("trocar o modelo do BLOCO invalida — o caso de 17/08", () => {
  const outro = versaoDoAuditor({ ...BASE, modeloBloco: "gpt-5.6-sol" });
  assert.notEqual(outro, versaoDoAuditor(BASE));
});

test("cada campo, sozinho, invalida", () => {
  const mudancas: Partial<ConfiguracaoDoAuditor>[] = [
    { modeloGlobal: "x" },
    { modeloValidacao: "x" },
    { esforco: "high" },
    { tamanhoDoBloco: 28000 },
  ];
  for (const m of mudancas) {
    assert.notEqual(
      versaoDoAuditor({ ...BASE, ...m }),
      versaoDoAuditor(BASE),
      `mudar ${Object.keys(m)[0]} deveria mudar a versão`,
    );
  }
});

test("a ordem dos campos não muda a versão", () => {
  // O hash sai de uma serialização com chaves ORDENADAS — senão a versão
  // dependeria da ordem em que o objeto foi montado, e um refactor inocente
  // invalidaria o reuso de todos os memoriais do escritório.
  const invertido: ConfiguracaoDoAuditor = {
    tamanhoDoBloco: BASE.tamanhoDoBloco,
    esforco: BASE.esforco,
    modeloValidacao: BASE.modeloValidacao,
    modeloBloco: BASE.modeloBloco,
    modeloGlobal: BASE.modeloGlobal,
    prompt: BASE.prompt,
  };
  assert.equal(versaoDoAuditor(invertido), versaoDoAuditor(BASE));
});

test("nunca colide por concatenação ambígua", () => {
  // "ab" + "c" e "a" + "bc" não podem dar o mesmo hash.
  const a = versaoDoAuditor({ ...BASE, modeloGlobal: "ab", modeloBloco: "c" });
  const b = versaoDoAuditor({ ...BASE, modeloGlobal: "a", modeloBloco: "bc" });
  assert.notEqual(a, b);
});

console.log(`\n${passed} teste(s) de versão do auditor OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-versao-do-auditor.ts; echo "exit=$?"`
Expected: `ERR_MODULE_NOT_FOUND` — `lib/versao-do-auditor.ts` não existe. `exit=1`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/versao-do-auditor.ts`:

```ts
/**
 * QUAL AUDITOR produziu este parecer — derivado, nunca digitado.
 *
 * Era `VERSAO_AUDITOR = 1` em [[audit-reuso.ts]], uma constante que alguém
 * precisava lembrar de subir ao mexer no prompt ou no modelo. Em 17/08/2026 o
 * modelo dos blocos mudou de `sol` para `terra` e o agrupamento de 28k para 10k
 * sem ninguém subir nada — e achado herdado passaria a vir de um auditor que não
 * existe mais. Disciplina manual que já falhou uma vez não é guarda; é armadilha.
 *
 * É o mesmo padrão do cache de leitura de selo: a chave carrega a versão do
 * leitor, e mexer no leitor invalida o acerto sozinho.
 *
 * PURO e sem `@/`: quem busca modelo e prompt é a rota. Aqui só entra aritmética,
 * e é o que permite testá-lo em node cru.
 */
import { createHash } from "node:crypto";

export type ConfiguracaoDoAuditor = {
  /** O texto INTEIRO do prompt do auditor, não um rótulo dele. */
  prompt: string;
  modeloGlobal: string;
  modeloBloco: string;
  modeloValidacao: string;
  esforco: string;
  /** `CHUNK_GROUP_CHARS` — bloco maior muda o que o modelo acha. */
  tamanhoDoBloco: number;
};

/**
 * 12 caracteres do sha-256. Não é segredo nem identificador global: só precisa
 * distinguir configurações, e um prefixo desse tamanho torna colisão acidental
 * irrelevante para a quantidade de configurações que um escritório tem.
 *
 * A serialização é por CHAVE ORDENADA e com separador: `JSON.stringify` de um
 * objeto preserva a ordem de inserção, então montar o mesmo objeto noutra ordem
 * daria outro hash e invalidaria o reuso de todos os memoriais num refactor
 * inocente. O ` ` entre os campos impede que `"ab"+"c"` e `"a"+"bc"`
 * produzam a mesma entrada.
 */
export function versaoDoAuditor(config: ConfiguracaoDoAuditor): string {
  const entrada = (Object.keys(config) as (keyof ConfiguracaoDoAuditor)[])
    .sort()
    .map((chave) => `${chave}=${String(config[chave])}`)
    .join(" ");

  return createHash("sha256").update(entrada, "utf8").digest("hex").slice(0, 12);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-versao-do-auditor.ts; echo "exit=$?"`
Expected: 7 linhas `ok`, `7 teste(s) de versão do auditor OK`, `exit=0`.

- [ ] **Step 5: Register the npm script**

In `package.json`, add to `scripts` next to `"test:audit:reuso"`:

```json
"test:versao-auditor": "node scripts/test-versao-do-auditor.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/versao-do-auditor.ts scripts/test-versao-do-auditor.ts package.json
git commit -m "reuso: a versao do auditor deixa de ser constante a mao"
```

---

### Task 2: A base serve? — elegibilidade do parecer anterior

**Files:**
- Create: `lib/elegibilidade-da-base.ts`
- Test: `scripts/test-elegibilidade-da-base.ts`
- Modify: `package.json` (script `test:elegibilidade`)

**Interfaces:**
- Consumes: `ConfiguracaoDoAuditor` não; só tipos de `lib/audit-report.ts`.
- Produces:
  - `type BaseDaReauditoria = { auditId: string; status: string; report: AuditReport | null }`
  - `type Elegibilidade = { serve: true; impressao: CapituloImpresso[] } | { serve: false; motivo: MotivoDeRecusa }`
  - `type MotivoDeRecusa = "sem-base" | "nao-completou" | "analise-parcial" | "sem-impressao" | "versao-diferente" | "outro-arquivo"`
  - `avaliarBase(args: { base: BaseDaReauditoria | null; arquivo: string; versaoAtual: string }): Elegibilidade`
  - `fraseDaRecusa(motivo: MotivoDeRecusa): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-elegibilidade-da-base.ts`:

```ts
/**
 * QUANDO O PARECER ANTERIOR NÃO SERVE DE BASE.
 *
 * O portão que só apareceu no fim do brainstorm, e que a corrida de 17/08/2026
 * tornou concreto: aquela auditoria truncou 20 dos 25 blocos. Herdar dela
 * congelaria o buraco — cada reauditoria confirmaria o vazio da anterior, e a
 * cobertura nunca voltaria.
 *
 *   node scripts/test-elegibilidade-da-base.ts
 */
import assert from "node:assert/strict";

import { avaliarBase, fraseDaRecusa } from "../lib/elegibilidade-da-base.ts";
import type { AuditReport } from "../lib/audit-report.ts";

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

const VERSAO = "abc123def456";
const CAPITULOS = [
  { titulo: "1 - APRESENTACAO", startPage: 1, endPage: 4, chars: 900, hash: "h1" },
];

function relatorio(over: Partial<AuditReport["runtime"]> = {}): AuditReport {
  return {
    tipo_auditoria: "memorial",
    tipo_documento: "Memorial Descritivo",
    runtime: {
      versao_auditor: VERSAO,
      passadas_incompletas: [],
      impressao: [{ arquivo: "084_25_md.pdf", capitulos: CAPITULOS }],
      ...over,
    },
    obra: "x",
    codigo: "084_25",
    municipio: "Criciúma",
    data_documento: "",
    status_analise: "concluida",
    status_geral: "sem achados críticos",
    total_incongruencias: 0,
    arquivos_analisados: [],
    comparacoes: [],
    incongruencias: [],
    conclusao: "",
  } as unknown as AuditReport;
}

const base = (report: AuditReport | null, status = "COMPLETED") => ({
  auditId: "a1",
  status,
  report,
});

test("base boa serve, e devolve a impressão do arquivo", () => {
  const r = avaliarBase({
    base: base(relatorio()),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, true);
  if (r.serve) assert.deepEqual(r.impressao, CAPITULOS);
});

test("sem base não serve", () => {
  const r = avaliarBase({ base: null, arquivo: "x.pdf", versaoAtual: VERSAO });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "sem-base");
});

test("PARECER PARCIAL NÃO SERVE — o caso do 084_25", () => {
  /*
   * 20 blocos truncados naquela corrida. Herdar dela transformaria um acidente
   * numa lacuna permanente: os capítulos que nunca foram lidos seriam marcados
   * como já auditados para sempre.
   */
  const r = avaliarBase({
    base: base(
      relatorio({
        passadas_incompletas: [
          { passada: "Bloco de páginas 47-58", motivo: "incomplete_max_output_tokens" },
        ],
      }),
    ),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "analise-parcial");
});

test("auditoria que não completou não serve", () => {
  const r = avaliarBase({
    base: base(relatorio(), "FAILED"),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "nao-completou");
});

test("versão de auditor diferente não serve", () => {
  const r = avaliarBase({
    base: base(relatorio()),
    arquivo: "084_25_md.pdf",
    versaoAtual: "outra-versao",
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "versao-diferente");
});

test("parecer antigo com versão NUMÉRICA não serve", () => {
  // Todo parecer anterior a esta mudança gravou `versao_auditor: 1`. Um número
  // nunca casa com um hash — e não casar é o desfecho correto.
  const r = avaliarBase({
    base: base(relatorio({ versao_auditor: 1 as unknown as string })),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "versao-diferente");
});

test("sem impressão digital não serve", () => {
  const r = avaliarBase({
    base: base(relatorio({ impressao: undefined })),
    arquivo: "084_25_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "sem-impressao");
});

test("impressão de OUTRO arquivo não serve", () => {
  const r = avaliarBase({
    base: base(relatorio()),
    arquivo: "063_26_md.pdf",
    versaoAtual: VERSAO,
  });
  assert.equal(r.serve, false);
  if (!r.serve) assert.equal(r.motivo, "outro-arquivo");
});

test("toda recusa tem frase, e nenhuma diz 'erro'", () => {
  const motivos = [
    "sem-base",
    "nao-completou",
    "analise-parcial",
    "sem-impressao",
    "versao-diferente",
    "outro-arquivo",
  ] as const;
  for (const m of motivos) {
    const frase = fraseDaRecusa(m);
    assert.ok(frase.length > 10, `${m} sem frase`);
    assert.doesNotMatch(frase, /erro/i, `${m}: não houve erro, houve ausência de base`);
  }
});

console.log(`\n${passed} teste(s) de elegibilidade OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-elegibilidade-da-base.ts; echo "exit=$?"`
Expected: `ERR_MODULE_NOT_FOUND` para `lib/elegibilidade-da-base.ts`. `exit=1`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/elegibilidade-da-base.ts`:

```ts
/**
 * O PARECER ANTERIOR SERVE DE BASE PARA REUSO?
 *
 * Separado de [[audit-reuso.ts]] porque responde outra pergunta: aquele decide
 * O QUE RELER dado que a base presta; este decide SE ELA PRESTA.
 *
 * O portão que importa é `analise-parcial`. Em 17/08/2026 uma auditoria do
 * memorial 084_25 truncou 20 dos 25 blocos por estouro do teto de saída. Se o
 * reuso estivesse ligado, a reauditoria seguinte herdaria capítulos que nunca
 * foram lidos de verdade — e o buraco viraria permanente, porque cada corrida
 * confirmaria o vazio da anterior. Reuso amplifica a base: base furada, furo
 * maior.
 *
 * Recusar NÃO é erro. A auditoria roda inteira, como sempre rodou, e o parecer
 * diz por que não houve reuso.
 *
 * PURO: recebe o parecer já carregado. Quem fala com o banco é a rota.
 */
import type { AuditReport, CapituloImpresso } from "./audit-report.ts";

export type BaseDaReauditoria = {
  auditId: string;
  /** `status` da linha `Audit` — só "COMPLETED" afirma alguma coisa. */
  status: string;
  report: AuditReport | null;
};

export type MotivoDeRecusa =
  | "sem-base"
  | "nao-completou"
  | "analise-parcial"
  | "sem-impressao"
  | "versao-diferente"
  | "outro-arquivo";

export type Elegibilidade =
  | { serve: true; impressao: CapituloImpresso[] }
  | { serve: false; motivo: MotivoDeRecusa };

export function avaliarBase(args: {
  base: BaseDaReauditoria | null;
  /** Nome do arquivo QUE ESTÁ SENDO auditado agora. */
  arquivo: string;
  versaoAtual: string;
}): Elegibilidade {
  const { base, arquivo, versaoAtual } = args;

  if (!base || !base.report) {
    return { serve: false, motivo: "sem-base" };
  }

  if (base.status !== "COMPLETED") {
    return { serve: false, motivo: "nao-completou" };
  }

  const runtime = base.report.runtime;

  if ((runtime?.passadas_incompletas?.length ?? 0) > 0) {
    return { serve: false, motivo: "analise-parcial" };
  }

  /*
   * Comparação de STRING contra STRING. Parecer anterior a esta mudança gravou
   * o número 1; `String(1) !== hash` recusa sozinho, sem caso especial.
   */
  if (String(runtime?.versao_auditor ?? "") !== versaoAtual) {
    return { serve: false, motivo: "versao-diferente" };
  }

  if (!runtime?.impressao?.length) {
    return { serve: false, motivo: "sem-impressao" };
  }

  // `impressao` é POR ARQUIVO, e o nome é o único elo entre as duas corridas.
  const doArquivo = runtime.impressao.find((i) => i.arquivo === arquivo);

  if (!doArquivo?.capitulos?.length) {
    return { serve: false, motivo: "outro-arquivo" };
  }

  return { serve: true, impressao: doArquivo.capitulos };
}

/**
 * Por que não houve reuso, em linguagem de documento. Nenhuma frase diz "erro":
 * não houve erro nenhum — houve ausência de base comparável, e a auditoria
 * completa é o desfecho normal.
 */
export function fraseDaRecusa(motivo: MotivoDeRecusa): string {
  switch (motivo) {
    case "sem-base":
      return "Primeira auditoria deste memorial: não há parecer anterior para comparar.";
    case "nao-completou":
      return "A auditoria anterior não chegou ao fim, então não serve de referência.";
    case "analise-parcial":
      return "A auditoria anterior ficou parcial — parte do documento não foi lida. Este memorial foi lido inteiro de novo.";
    case "sem-impressao":
      return "O parecer anterior é de uma versão que ainda não guardava a impressão por capítulo.";
    case "versao-diferente":
      return "O auditor mudou desde o parecer anterior (prompt, modelo ou recorte), então o documento foi lido inteiro.";
    case "outro-arquivo":
      return "O parecer anterior é de outro arquivo; não há capítulos para comparar.";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-elegibilidade-da-base.ts; echo "exit=$?"`
Expected: 9 linhas `ok`, `9 teste(s) de elegibilidade OK`, `exit=0`.

- [ ] **Step 5: Register the npm script**

In `package.json`, add:

```json
"test:elegibilidade": "node scripts/test-elegibilidade-da-base.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/elegibilidade-da-base.ts scripts/test-elegibilidade-da-base.ts package.json
git commit -m "reuso: o portao da base, e por que parecer parcial nao serve"
```

---

### Task 3: `planejarReuso` recebe as duas versões

**Files:**
- Modify: `lib/audit-reuso.ts:98-173`
- Modify: `lib/audit-report.ts` (`versao_auditor?: number` → `string`; novo `herdado_de`)
- Test: `scripts/test-audit-reuso.ts`

**Interfaces:**
- Consumes: `versaoDoAuditor` (Task 1) — só no chamador, não aqui.
- Produces: `planejarReuso(args: { delta; capitulosAntes; achadosAntes; paginasAgora; versaoAnterior?: string; versaoAtual: string }): PlanoDeReuso` — mesma forma de retorno de hoje.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-audit-reuso.ts`, before the final `console.log`:

```ts
// --- As DUAS versões chegam por parâmetro (17/08/2026) ----------------------

test("versão diferente da atual: nada é herdado", () => {
  /*
   * `planejarReuso` lia a versão atual de uma constante do próprio módulo.
   * Derivá-la da configuração real (prompt + modelos + esforço + tamanho de
   * bloco) faria a função depender de `process.env` e do prompt — ela deixaria
   * de ser pura e o teste em node cru morreria junto. As duas pontas passam a
   * chegar por parâmetro.
   */
  const plano = planejarReuso({
    delta: { iguais: [CAP_A], alterados: [], novos: [], sumidos: [] },
    capitulosAntes: [CAP_A],
    achadosAntes: [ACHADO_EM_A],
    paginasAgora: PAGINAS,
    versaoAnterior: "aaaaaaaaaaaa",
    versaoAtual: "bbbbbbbbbbbb",
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.equal(plano.hashesHerdados.length, 0);
  assert.equal(plano.capitulosParaLer.length, 1, "o capítulo igual volta para leitura");
});

test("versão igual: herda", () => {
  const plano = planejarReuso({
    delta: { iguais: [CAP_A], alterados: [], novos: [], sumidos: [] },
    capitulosAntes: [CAP_A],
    achadosAntes: [ACHADO_EM_A],
    paginasAgora: PAGINAS,
    versaoAnterior: "aaaaaaaaaaaa",
    versaoAtual: "aaaaaaaaaaaa",
  });
  assert.equal(plano.achadosHerdados.length, 1);
});

test("versão anterior AUSENTE não herda", () => {
  // Parecer gravado antes de existir versão. `undefined !== hash` recusa.
  const plano = planejarReuso({
    delta: { iguais: [CAP_A], alterados: [], novos: [], sumidos: [] },
    capitulosAntes: [CAP_A],
    achadosAntes: [ACHADO_EM_A],
    paginasAgora: PAGINAS,
    versaoAtual: "aaaaaaaaaaaa",
  });
  assert.equal(plano.achadosHerdados.length, 0);
});
```

If `CAP_A`, `ACHADO_EM_A` or `PAGINAS` do not already exist in that file under those names, add them near the top of the file, after the imports:

```ts
const CAP_A = { titulo: "1 - APRESENTACAO", startPage: 1, endPage: 4, chars: 900, hash: "hA" };
const ACHADO_EM_A = {
  id: "INC-001",
  prioridade: "Alta" as const,
  pagina: "2",
  capitulo: "1 - APRESENTACAO",
  local: "texto",
  tipo: "Norma desatualizada",
  descricao: "d",
  evidencia: "e",
  termo_busca: "NBR 9050",
  conflito: "c",
  sugestao_correcao: "s",
  confianca: "alta" as const,
  origem: "ia" as const,
};
const PAGINAS = [
  { page: 1, text: "capa" },
  { page: 2, text: "trecho com NBR 9050 citada" },
  { page: 3, text: "mais texto" },
  { page: 4, text: "fim do capitulo" },
];
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-audit-reuso.ts; echo "exit=$?"`
Expected: `exit=1`. TypeScript não barra em node cru, mas `versaoAtual` é ignorado e o teste "versão diferente da atual" falha — `achadosHerdados.length` será `1` em vez de `0`, porque hoje a comparação é contra a constante `VERSAO_AUDITOR = 1` e `"aaaaaaaaaaaa" !== 1` já era verdade. Confirme que a linha `FALHOU  versão igual: herda` aparece: com a constante, `"aaaaaaaaaaaa" !== 1` recusa sempre e nada é herdado.

- [ ] **Step 3: Change the signature in `lib/audit-reuso.ts`**

Replace the `versaoAnterior?: number;` line inside `planejarReuso`'s args and the guard:

```ts
export function planejarReuso(args: {
  delta: DeltaDeCapitulos;
  capitulosAntes: readonly CapituloImpresso[];
  achadosAntes: readonly AuditFinding[];
  paginasAgora: readonly ExtractedPdfPage[];
  /**
   * A versão gravada NO PARECER ANTERIOR. `undefined` em parecer antigo, e
   * `undefined !== versaoAtual` recusa sozinho.
   */
  versaoAnterior?: string;
  /**
   * A versão de AGORA, derivada em [[versao-do-auditor.ts]].
   *
   * Chega por parâmetro, e não de uma constante deste módulo, porque derivá-la
   * exige o prompt e `process.env` — e este arquivo precisa continuar puro para
   * rodar em node cru sem token.
   */
  versaoAtual: string;
}): PlanoDeReuso {
  const mudados = [...args.delta.alterados.map((a) => a.agora), ...args.delta.novos];

  if (args.versaoAnterior !== args.versaoAtual) {
```

Then delete the now-unused constant:

```ts
export const VERSAO_AUDITOR = 1;
```

- [ ] **Step 4: Update `lib/audit-report.ts`**

Change `versao_auditor?: number;` to:

```ts
    /**
     * Qual auditor produziu este parecer — hash da configuração real desde
     * 17/08/2026 (ver [[versao-do-auditor.ts]]). Era um número subido à mão, e
     * a disciplina falhou na primeira oportunidade. Pareceres antigos gravaram
     * `1`; `String(1)` nunca casa com um hash, e não casar é o certo.
     */
    versao_auditor?: string;
```

And add to `AuditFinding`, after `tier?: FindingTier;`:

```ts
  /**
   * Este achado veio da auditoria ANTERIOR, de um capítulo byte a byte idêntico,
   * com a página reancorada. O parecer sustenta decisão de emitir projeto:
   * achado que não foi produzido nesta corrida precisa dizer isso.
   */
  herdado_de?: { auditId: string; quando: string };
```

- [ ] **Step 5: Fix the remaining import of the deleted constant**

`app/api/audit/route.ts:68` imports `VERSAO_AUDITOR`. Replace that import line with nothing for now and, at the single place it was used (`versao_auditor: VERSAO_AUDITOR` in the report), put a literal placeholder that Task 4 replaces:

```ts
      versao_auditor: versaoAtualDoAuditor,
```

Declare it just above the `const report: AuditReport = {` line:

```ts
    // Substituído pela derivação real na Task 4; aqui só para o build passar.
    const versaoAtualDoAuditor = "";
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
node scripts/test-audit-reuso.ts && node scripts/test-audit-consistency.ts && npx tsc --noEmit
echo "exit=$?"
```
Expected: os três verdes, `exit=0`. `tsc` sem saída.

- [ ] **Step 7: Commit**

```bash
git add lib/audit-reuso.ts lib/audit-report.ts scripts/test-audit-reuso.ts app/api/audit/route.ts
git commit -m "reuso: planejarReuso recebe as duas versoes e continua puro"
```

---

### Task 4: A rota carrega a base, planeja e restringe as passadas

**Files:**
- Modify: `app/api/audit/route.ts`
- Modify: `modules/nexo/lib/audit.ts`

**Interfaces:**
- Consumes: `versaoDoAuditor` (Task 1), `avaliarBase` / `fraseDaRecusa` (Task 2), `planejarReuso` (Task 3), `compararImpressoes` / `impressaoDosCapitulos` (existentes).
- Produces: comportamento; nenhum símbolo novo exportado.

- [ ] **Step 1: Send `auditIdAnterior` from the client**

In `modules/nexo/lib/audit.ts`, add to `MemorialAuditOpcoes`:

```ts
  /**
   * A auditoria ANTERIOR deste memorial nesta conversa. O servidor compara as
   * impressões digitais e relê só o que mudou. Ausente na primeira auditoria.
   */
  auditIdAnterior?: string;
```

And inside `runMemorialAudit`, next to the other `opcoes` appends:

```ts
  if (opcoes.auditIdAnterior) form.append("auditIdAnterior", opcoes.auditIdAnterior);
```

In `modules/nexo/components/ConfirmationCard.tsx`, in the `postAudit(...)` call inside `confirm()`, add to the options object (the one that already has `auditId` and `projectId`):

```ts
          auditIdAnterior: (auditoriaAnterior?.payload as MemorialAuditResult | undefined)?.auditId ?? undefined,
```

- [ ] **Step 2: Read the base and plan, in the route**

In `app/api/audit/route.ts`, after `const uploadedFiles = await Promise.all(...)` completes and before the `for (const file of uploadedFiles)` loop, insert:

```ts
    /*
     * O REUSO, decidido ANTES de gastar um token.
     *
     * O motor de decisão inteiro já existia em `lib/audit-reuso.ts` e nunca
     * tinha sido chamado: a rota importava dali só a constante de versão. Ver
     * `docs/superpowers/specs/2026-08-17-reuso-da-auditoria-design.md`.
     */
    const auditIdAnterior = String(formData.get("auditIdAnterior") ?? "").trim();
    const versaoAtualDoAuditor = versaoDoAuditor({
      prompt: getAuditorPrompt(auditMode),
      modeloGlobal: getPrimaryModelName(auditMode, analysisLevel, "global"),
      modeloBloco: getPrimaryModelName(auditMode, analysisLevel, "chunk"),
      modeloValidacao: getValidationModelName(auditMode, analysisLevel),
      esforco: getReasoningEffort(analysisLevel, auditMode),
      tamanhoDoBloco: CHUNK_GROUP_CHARS,
    });

    const arquivoPrincipal = uploadedFiles[0];
    const baseCarregada = auditIdAnterior
      ? await getPrisma()
          .audit.findFirst({
            where: { id: auditIdAnterior, projectId },
            select: { id: true, status: true, report: true, completedAt: true },
          })
          .catch(() => null)
      : null;

    const elegibilidade = avaliarBase({
      base: baseCarregada
        ? {
            auditId: baseCarregada.id,
            status: baseCarregada.status,
            report: baseCarregada.report as unknown as AuditReport | null,
          }
        : null,
      arquivo: arquivoPrincipal.file.name,
      versaoAtual: versaoAtualDoAuditor,
    });

    const relatorioBase = baseCarregada?.report as unknown as AuditReport | null;
    const capitulosAgora = impressaoDosCapitulos(chunkPdfByChapter(arquivoPrincipal.extracted));
    const delta = elegibilidade.serve
      ? compararImpressoes(elegibilidade.impressao, capitulosAgora)
      : null;

    /*
     * DOCUMENTO IDÊNTICO: recusa antes de gastar.
     *
     * Nada alterado, nada novo e o mesmo auditor — não há trabalho a fazer, e
     * cobrar uma auditoria para reconfirmar o parecer que já existe seria vender
     * o mesmo serviço duas vezes. O caso VIZINHO não é recusa: documento
     * idêntico com auditor DIFERENTE relê tudo, senão melhorar o prompt nunca
     * alcançaria memorial já auditado (e `avaliarBase` já barrou aquele caso
     * acima, com `versao-diferente`).
     */
    if (delta && delta.alterados.length === 0 && delta.novos.length === 0) {
      return withCors(
        NextResponse.json(
          {
            error: `O documento é idêntico ao que foi auditado em ${formatarData(baseCarregada?.completedAt)}. Não há o que auditar.`,
            identico: true,
            auditIdAnterior,
          },
          { status: 409 },
        ),
        request,
      );
    }

    const plano =
      delta && elegibilidade.serve && relatorioBase
        ? planejarReuso({
            delta,
            capitulosAntes: elegibilidade.impressao,
            achadosAntes: relatorioBase.incongruencias ?? [],
            paginasAgora: arquivoPrincipal.extracted.pages,
            versaoAnterior: relatorioBase.runtime?.versao_auditor,
            versaoAtual: versaoAtualDoAuditor,
          })
        : null;

    if (plano) {
      console.log(
        `[audit] reuso: ${plano.capitulosParaLer.length} capítulo(s) para reler, ` +
          `${plano.hashesHerdados.length} herdado(s), ${plano.achadosHerdados.length} achado(s) herdado(s)`,
      );
    } else {
      console.log(
        `[audit] sem reuso: ${elegibilidade.serve ? "delta indisponível" : fraseDaRecusa(elegibilidade.motivo)}`,
      );
    }
```

Add a small helper near the other formatters at the top of the file:

```ts
function formatarData(quando: Date | null | undefined) {
  return quando
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(quando)
    : "antes";
}
```

And add the imports at the top:

```ts
import { versaoDoAuditor } from "@/lib/versao-do-auditor";
import { avaliarBase, fraseDaRecusa } from "@/lib/elegibilidade-da-base";
import { planejarReuso } from "@/lib/audit-reuso";
import { compararImpressoes } from "@/lib/audit-fingerprint";
```

Delete the placeholder `const versaoAtualDoAuditor = "";` added in Task 3 Step 5.

- [ ] **Step 3: Restrict the block pass**

`deepAnalyzeFile` gains an optional argument. In its args type, add:

```ts
  /** Só estes capítulos vão ao modelo. `undefined` = todos (auditoria completa). */
  capitulosParaLer?: readonly { hash: string }[];
```

And where `chunks` is computed (the `const chunks = ...slice(0, chunkLimit);` line), replace with:

```ts
  const blocosDisponiveis = coberturaTotal
    ? agruparBlocosParaLeitura(capitulos, CHUNK_GROUP_CHARS)
    : capitulos;
  /*
   * O REUSO corta aqui, e não no `chunkLimit`: o teto é orçamento, o plano é
   * conhecimento. Um bloco agrupado é relido quando QUALQUER capítulo dele
   * mudou — o bloco é a unidade que vai ao modelo, e mandar meio bloco seria
   * mandar texto sem o contexto que o cerca.
   */
  const hashesParaLer = args.capitulosParaLer
    ? new Set(args.capitulosParaLer.map((c) => c.hash))
    : null;
  const blocosDoPlano = hashesParaLer
    ? blocosDisponiveis.filter((bloco) =>
        impressaoDosCapitulos([bloco]).some((c) => hashesParaLer.has(c.hash)) ||
        capitulos.some(
          (cap) =>
            hashesParaLer.has(impressaoDosCapitulos([cap])[0].hash) &&
            cap.startPage >= bloco.startPage &&
            cap.endPage <= bloco.endPage,
        ),
      )
    : blocosDisponiveis;
  const chunks = blocosDoPlano.slice(0, chunkLimit);
```

Pass it from the caller, inside the `for (const file of uploadedFiles)` loop:

```ts
        capitulosParaLer: plano?.capitulosParaLer,
```

- [ ] **Step 4: Merge the inherited findings and record the reuse**

Where `allFindings` is assembled — right after the `for (const file of uploadedFiles)` loop — add:

```ts
    /*
     * Os HERDADOS entram depois das passadas e ANTES da validação, mas ficam
     * fora dela: eles já foram validados na corrida que os produziu, e o texto
     * do capítulo não mudou. Revalidá-los custa dinheiro e pode virar o veredito
     * de um trecho idêntico.
     */
    const achadosHerdados = (plano?.achadosHerdados ?? []).map((f) => ({
      ...f,
      herdado_de: {
        auditId: auditIdAnterior,
        quando: formatarData(baseCarregada?.completedAt),
      },
    }));
```

Then, where `validatedFindings` is combined into the final list, append `achadosHerdados` to the array that becomes `findings`.

In the `report` object literal, inside `runtime`, add:

```ts
        versao_auditor: versaoAtualDoAuditor,
        ...(plano
          ? {
              reauditoria: {
                base_audit_id: auditIdAnterior,
                capitulos_lidos: plano.capitulosParaLer.length,
                capitulos_herdados: plano.hashesHerdados.length,
                achados_herdados: achadosHerdados.length,
                promovidos_sem_ancora: plano.promovidos.map((p) => p.titulo),
              },
            }
          : {}),
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && node scripts/test-audit-reuso.ts && node scripts/test-audit-consistency.ts
echo "exit=$?"
```
Expected: `exit=0`, `tsc` sem saída.

- [ ] **Step 6: Commit**

```bash
git add app/api/audit/route.ts modules/nexo/lib/audit.ts modules/nexo/components/ConfirmationCard.tsx
git commit -m "reuso: a rota carrega a base, planeja e rele so o que mudou"
```

---

### Task 5: A leitura global recebe resumo em vez de texto

**Files:**
- Modify: `lib/audit-validation-prompt.ts` (`buildDocumentContext`)
- Modify: `app/api/audit/route.ts` (`analyzeFileGloballyWithModel`)
- Test: `scripts/test-contexto-da-global.ts` (create)
- Modify: `package.json`

**Interfaces:**
- Consumes: `SinteseDoArquivo` de `lib/audit-report.ts`; `CapituloImpresso`.
- Produces: `buildDocumentContextComReuso(args: { capitulos: readonly { hash: string; titulo: string; texto: string }[]; hashesHerdados: ReadonlySet<string>; resumoPorHash: ReadonlyMap<string, string>; maxChars: number }): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-contexto-da-global.ts`:

```ts
/**
 * O CONTEXTO DA LEITURA GLOBAL numa reauditoria.
 *
 * Capítulo que não mudou vai como RESUMO, não como texto — é para isso que
 * `runtime.sintese` é gravado em todo parecer. Sem isso, a passada mais cara da
 * auditoria (US$ 1,19 medidos no 084_25) continuaria relendo o documento
 * inteiro e o reuso teria piso alto.
 *
 *   node scripts/test-contexto-da-global.ts
 */
import assert from "node:assert/strict";

import { buildDocumentContextComReuso } from "../lib/audit-validation-prompt.ts";

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

const CAPITULOS = [
  { hash: "h1", titulo: "1 - APRESENTACAO", texto: "TEXTO INTEGRAL DA APRESENTACAO" },
  { hash: "h2", titulo: "2 - PAREDES", texto: "TEXTO INTEGRAL DAS PAREDES" },
  { hash: "h3", titulo: "3 - ELETRICA", texto: "TEXTO INTEGRAL DA ELETRICA" },
];
const RESUMOS = new Map([
  ["h1", "Apresenta a obra e o municipio."],
  ["h3", "Descreve quadros e circuitos."],
]);

test("capítulo herdado entra como resumo; o mudado, como texto", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(["h1", "h3"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.ok(ctx.includes("TEXTO INTEGRAL DAS PAREDES"), "o capítulo mudado vai inteiro");
  assert.ok(!ctx.includes("TEXTO INTEGRAL DA APRESENTACAO"), "o herdado não vai inteiro");
  assert.ok(ctx.includes("Apresenta a obra e o municipio."), "o herdado vai resumido");
  assert.ok(ctx.includes("Descreve quadros e circuitos."));
});

test("o resumo diz que é resumo — o modelo precisa saber o que está lendo", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(["h1"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.match(ctx, /resumo|inalterado/i);
});

test("herdado SEM resumo gravado volta a ir como texto", () => {
  /*
   * Parecer antigo pode ter impressão e não ter síntese. Mandar o capítulo como
   * uma linha em branco seria esconder o conteúdo do modelo — o lado seguro é
   * gastar, não perder.
   */
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(["h2"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.ok(ctx.includes("TEXTO INTEGRAL DAS PAREDES"));
});

test("todos herdados ainda produz contexto útil, não vazio", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: [CAPITULOS[0], CAPITULOS[2]],
    hashesHerdados: new Set(["h1", "h3"]),
    resumoPorHash: RESUMOS,
    maxChars: 100000,
  });
  assert.ok(ctx.length > 20);
  assert.ok(ctx.includes("1 - APRESENTACAO"), "o título fica, para o modelo saber a estrutura");
});

test("respeita o teto de caracteres", () => {
  const ctx = buildDocumentContextComReuso({
    capitulos: CAPITULOS,
    hashesHerdados: new Set(),
    resumoPorHash: new Map(),
    maxChars: 50,
  });
  assert.ok(ctx.length <= 200, `contexto de ${ctx.length} chars estourou o teto`);
});

console.log(`\n${passed} teste(s) de contexto da global OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-contexto-da-global.ts; echo "exit=$?"`
Expected: erro de import — `buildDocumentContextComReuso` não existe. `exit=1`.

- [ ] **Step 3: Implement**

Append to `lib/audit-validation-prompt.ts`:

```ts
/**
 * O DOCUMENTO como a leitura global o vê numa REAUDITORIA.
 *
 * Capítulo que não mudou entra como uma LINHA de resumo; o que mudou entra
 * inteiro. É para isso que `runtime.sintese` é gravado em todo parecer — sem
 * ele, a passada mais cara da auditoria (US$ 1,19 medidos no 084_25 em
 * 17/08/2026) continuaria relendo o documento todo e o reuso teria piso alto.
 *
 * O TÍTULO do capítulo herdado fica sempre, mesmo resumido: é ele que deixa o
 * modelo enxergar a ESTRUTURA do documento e perceber que o capítulo novo
 * contradiz um que ficou parado. Um contexto só com os capítulos mudados leria
 * o delta como se fosse o documento.
 *
 * Herdado SEM resumo gravado volta a ir como texto integral: parecer antigo pode
 * ter impressão e não ter síntese, e mandar uma linha em branco esconderia o
 * conteúdo do modelo. O lado seguro é gastar, não perder.
 */
export function buildDocumentContextComReuso(args: {
  capitulos: readonly { hash: string; titulo: string; texto: string }[];
  hashesHerdados: ReadonlySet<string>;
  resumoPorHash: ReadonlyMap<string, string>;
  maxChars: number;
}): string {
  const partes = args.capitulos.map((cap) => {
    const resumo = args.resumoPorHash.get(cap.hash);

    if (args.hashesHerdados.has(cap.hash) && resumo) {
      return `--- ${cap.titulo} (inalterado desde a auditoria anterior; resumo) ---\n${resumo}`;
    }

    return `--- ${cap.titulo} ---\n${cap.texto}`;
  });

  const texto = partes.join("\n\n");

  return texto.length <= args.maxChars ? texto : `${texto.slice(0, args.maxChars)}\n[...]`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-contexto-da-global.ts; echo "exit=$?"`
Expected: 5 `ok`, `exit=0`.

- [ ] **Step 5: Wire it into the global pass**

In `app/api/audit/route.ts`, `analyzeFileGloballyWithModel` gains two optional args:

```ts
  /** Hashes dos capítulos que não mudaram. Ausente = leitura completa. */
  hashesHerdados?: ReadonlySet<string>;
  /** Resumo por hash, vindo de `runtime.sintese` do parecer anterior. */
  resumoPorHash?: ReadonlyMap<string, string>;
```

Where it builds the document context (`buildDocumentContext(args.extracted, args.analysisLevel)`), replace with:

```ts
  const contexto =
    args.hashesHerdados && args.hashesHerdados.size > 0
      ? buildDocumentContextComReuso({
          capitulos: chunkPdfByChapter(args.extracted).map((c) => ({
            hash: impressaoDosCapitulos([c])[0].hash,
            titulo: c.title,
            texto: c.text,
          })),
          hashesHerdados: args.hashesHerdados,
          resumoPorHash: args.resumoPorHash ?? new Map(),
          maxChars: getGlobalContextChars(args.analysisLevel),
        })
      : buildDocumentContext(args.extracted, args.analysisLevel);
```

At the call site inside `deepAnalyzeFile`, pass through from the plan (add the two fields to `deepAnalyzeFile`'s args type as well, forwarding them):

```ts
        hashesHerdados: args.hashesHerdados,
        resumoPorHash: args.resumoPorHash,
```

And from the route's `for (const file of uploadedFiles)` loop:

```ts
        hashesHerdados: plano ? new Set(plano.hashesHerdados) : undefined,
        resumoPorHash: new Map(
          (relatorioBase?.runtime?.sintese ?? [])
            .filter((s) => s.arquivo === file.file.name)
            .flatMap((s) => s.capitulos.map((c) => [c.hash, c.resumo] as const)),
        ),
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && node scripts/test-contexto-da-global.ts && node scripts/test-audit-consistency.ts
echo "exit=$?"
```
Expected: `exit=0`.

- [ ] **Step 7: Register the npm script and commit**

Add to `package.json`:

```json
"test:contexto-global": "node scripts/test-contexto-da-global.ts",
```

```bash
git add lib/audit-validation-prompt.ts app/api/audit/route.ts scripts/test-contexto-da-global.ts package.json
git commit -m "reuso: a leitura global le resumo do que nao mudou"
```

---

### Task 6: A tela declara o reuso

**Files:**
- Modify: `components/audit-result.tsx`
- Modify: `modules/nexo/components/ConfirmationCard.tsx` (tratar o 409 de documento idêntico)

**Interfaces:**
- Consumes: `report.runtime.reauditoria`, `finding.herdado_de`.
- Produces: nada exportado.

- [ ] **Step 1: Add the reaudit banner**

In `components/audit-result.tsx`, immediately above the findings list (next to where the verdict/summary is rendered), add:

```tsx
        {report.runtime?.reauditoria ? (
          /*
            O parecer sustenta decisão de emitir projeto. Achado que não foi
            produzido nesta corrida precisa dizer isso — esconder seria afirmar
            um trabalho que não houve, que é o mesmo defeito das auditorias
            parciais silenciosas.
          */
          <p className="text-xs text-muted-foreground">
            Reauditoria — {report.runtime.reauditoria.capitulos_lidos} capítulo(s) relido(s).{" "}
            {report.runtime.reauditoria.capitulos_herdados} idêntico(s) ao parecer anterior;{" "}
            {report.runtime.reauditoria.achados_herdados} achado(s) herdado(s).
            {report.runtime.reauditoria.promovidos_sem_ancora.length > 0
              ? ` ${report.runtime.reauditoria.promovidos_sem_ancora.length} capítulo(s) foram relidos por não ter sido possível reancorar os achados.`
              : ""}
          </p>
        ) : null}
```

- [ ] **Step 2: Add the seal on the inherited finding card**

In the same file, inside the finding card header where `Badge`/`Chip` elements already render (next to the confidence chip), add:

```tsx
                        {finding.herdado_de ? (
                          <Chip>herdado · {finding.herdado_de.quando}</Chip>
                        ) : null}
```

- [ ] **Step 3: Handle the "identical document" refusal**

In `modules/nexo/lib/audit.ts`, where the response is checked for `!res.ok`, add before the generic error:

```ts
  if (res.status === 409) {
    const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(corpo?.error ?? "O documento é idêntico ao já auditado.");
  }
```

The existing `catch` in `ConfirmationCard.confirm()` already calls `setError(err.message)`, so the sentence reaches the card with no further change.

- [ ] **Step 4: Verify visually without tokens**

```bash
npx tsc --noEmit && node scripts/prova-auditoria-ui.mjs
echo "exit=$?"
```
Expected: `exit=0`. The seeded proof exercises the parecer; the banner is absent because the seeded report has no `runtime.reauditoria`, which is the correct default.

- [ ] **Step 5: Commit**

```bash
git add components/audit-result.tsx modules/nexo/lib/audit.ts
git commit -m "reuso: a tela declara o que foi relido e o que foi herdado"
```

---

### Task 7: Prova com token, uma vez

**Files:**
- Create: `scripts/prova-reuso-real.md` (roteiro, não código)

**Interfaces:** nenhuma.

- [ ] **Step 1: Write the manual script**

Create `scripts/prova-reuso-real.md`:

```markdown
# Prova do reuso, com token — roda UMA vez

Os testes automatizados cobrem a decisão. Isto cobre o dinheiro.

**Antes:** `NEXODOC_AUDIT_COBERTURA_TOTAL` deve estar no mesmo valor nas duas
corridas — mudá-la entre elas troca a versão do auditor e invalida o reuso de
propósito (o que também é uma prova válida, mas de outra coisa).

1. Auditar um memorial pequeno (ex.: `113_22_md_geral_a.pdf`). Anotar o custo:

   ```
   node -e "..." # ver scripts/README ou repetir a consulta de AiUsageEvent
   ```

2. Abrir o PDF, alterar UM capítulo (uma frase basta) e salvar como arquivo
   com o MESMO nome.

3. Auditar de novo, na mesma conversa.

4. Conferir no parecer:
   - a faixa "Reauditoria — N capítulo(s) relido(s)";
   - o selo `herdado` em pelo menos um cartão;
   - o log `[audit] reuso: ...`.

5. Comparar o custo das duas corridas no `AiUsageEvent`. Esperado: a segunda
   custa uma fração da primeira, e a diferença sai de `audit-chunk` e
   `audit-global`.

6. Terceira corrida SEM alterar nada: deve **recusar** com "O documento é
   idêntico ao que foi auditado em DD/MM. Não há o que auditar." e custar
   **zero** — nenhum evento novo em `AiUsageEvent`.
```

- [ ] **Step 2: Commit**

```bash
git add scripts/prova-reuso-real.md
git commit -m "reuso: o roteiro da prova com token"
```

---

## Self-Review

**1. Spec coverage:**

| Seção da spec | Task |
|---|---|
| §3 fluxo (carregar base, delta, planejar, restringir) | 4 |
| §3.9 validação só dos novos | 4 (Step 4) |
| §4 versão derivada | 1, 3 |
| §5 elegibilidade da base | 2 |
| §6 documento idêntico | 4 (Step 2), 6 (Step 3) |
| §7 faixa e selo na tela | 6 |
| §8 superfície de mudança | 1–6 |
| §9 testes | 1, 2, 3, 5 (sem token), 7 (com token) |
| §10 riscos | 5 (resumo), 3 (reancoragem), 2 (base envenenada) |

Sem lacunas.

**2. Placeholder scan:** o único placeholder intencional é `const versaoAtualDoAuditor = ""` na Task 3 Step 5, criado para manter o build verde entre tasks e **removido explicitamente** na Task 4 Step 2. Nenhum "TBD".

**3. Type consistency:** `versaoDoAuditor` devolve `string` (Task 1) e é consumido como `versaoAtual: string` (Task 3) e `versaoAtual` em `avaliarBase` (Task 2). `versao_auditor` vira `string` em `lib/audit-report.ts` (Task 3 Step 4) e é lido como `String(...)` em `avaliarBase`, cobrindo parecer antigo com número. `herdado_de: { auditId, quando }` é definido na Task 3 Step 4, escrito na Task 4 Step 4 e lido na Task 6 Step 2 com os mesmos nomes. `plano.hashesHerdados` é `string[]` e vira `Set` na Task 5 Step 5.
