# Identidade do projeto unificada — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** fazer a conversa do Nexo apontar para o `Project` do Postgres, e
fazer a prefeitura ser lida, gravada e corrigível — acabando com o balde "Sem
código no carimbo" e com os dois conceitos paralelos de "projeto".

**Arquitetura:** a identidade da conversa deixa de ser a string `folderKey`
derivada no navegador e passa a ser a chave estrangeira `NexoConversation.projectId`.
`Project` ganha `clientKey`, um slug estável do município que sobrevive a
correções de grafia. O vínculo passa a ser feito no **anexo** do memorial, não no
disparo da auditoria, e o núcleo de decisão sai puro para rodar em node cru.

**Stack:** Next.js 15 (App Router), React 19, Prisma 7 + Postgres (Neon),
TypeScript, Playwright para provas de navegador. Testes puros rodam em **node
cru** via type-stripping (`node scripts/x.ts`), sem framework de teste.

**Spec:** `docs/superpowers/specs/2026-09-01-identidade-do-projeto-design.md`

## Restrições globais

- **pt-BR em tudo que é visível e em todo comentário de código.** É a língua do
  produto e do repositório.
- **Núcleo puro não importa o alias `@/`.** Com ele o arquivo deixa de rodar sob
  o type-stripping do node cru e o teste morre junto (ver o cabeçalho de
  `server/nexo/conversa-remota.ts`). Em `scripts/*.ts` importe por caminho
  relativo com extensão `.ts`.
- **Commit direto na `main`.** Não criar branch nem PR.
- **`git add` com caminhos explícitos, nunca `git add -A`.** Confira com
  `git diff --cached --stat` antes de commitar: caminho inexistente derruba o
  `git add` inteiro em silêncio.
- **Nenhuma tarefa gasta token de IA.** Todas as provas semeiam o banco ou o
  IndexedDB.
- **Não inventar cor nem token novo.** A escala de cor por prefeitura é o
  sub-projeto 4; `DESIGN.md:283` cobra portão (`npm run prova:tokens`) para
  admitir cor nova.
- **Reiniciar o `next dev` antes de acreditar numa falha de portão.** O dev
  server velho dá falha consistente e falsa.

## Mapa dos arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `lib/cliente-do-projeto.ts` | Puro. Canonizar o cliente (`slugDoCliente`) e decidir o que gravar (`decidirCliente`). |
| `scripts/test-cliente-do-projeto.ts` | Teste em node cru do acima. |
| `scripts/prova-identidade-do-projeto.mjs` | Prova de banco: vínculo idempotente, preenchimento de cliente vazio, conflito de código. |
| `scripts/backfill-identidade-do-projeto.mjs` | Preenche `clientKey` e liga conversas antigas quando há auditoria registrada. |
| `scripts/shot-barra-enderecada.mjs` | Prova de navegador: o cartão mostra `063-26 · CRICIÚMA`, medido contra a janela. |
| `prisma/migrations/<ts>_identidade_do_projeto/migration.sql` | As duas colunas e seus índices. |

**Modificados**

| Arquivo | O quê |
|---|---|
| `lib/resolucao-de-projeto.ts` | Ganha `decidirTroca` (puro). |
| `scripts/test-resolucao-de-projeto.ts` | Casos de `decidirTroca`. |
| `prisma/schema.prisma` | `Project.clientKey`, `Project.nexoConversations`, `NexoConversation.projectId`. |
| `app/api/projects/por-centro-de-custo/route.ts` | Passa a usar `decidirCliente`; grava `clientKey`; registra divergência. |
| `server/nexo/conversa-remota.ts` | `projectId` no registro e no resumo. |
| `scripts/test-nexo-conversa-remota.ts` | Casos de `projectId`. |
| `app/api/nexo/conversas/route.ts` | Persiste e devolve `projectId`. |
| `app/api/nexo/conversas/resumo/route.ts` | `LEFT JOIN "Project"`; devolve código e cliente. |
| `modules/nexo/lib/nexo-db.ts` | `StoredConversation.projectId`. |
| `modules/nexo/state/conversation-store.tsx` | Estado `projectId`, `vincularProjeto`, persistência e restauração. |
| `modules/nexo/lib/projeto-da-auditoria.ts` | `vincularProjetoDaConversa`, chamada no anexo. |
| `modules/nexo/components/NexoWorkspace.tsx` | Dossiê → `corrigirIdentidade` → vínculo. |
| `modules/nexo/components/ConfirmationCard.tsx` | Lê o vínculo em vez de resolvê-lo. |
| `modules/nexo/lib/cartoes-de-projeto.ts` | Agrupa por `projectId`; rótulo "A endereçar". |
| `scripts/test-nexo-cartoes.ts` | Casos novos de agrupamento. |
| `modules/nexo/components/CartaoDeProjeto.tsx` | Rótulo "A endereçar". |
| `package.json` | Scripts `test:cliente` e `prova:identidade`. |

---

### Task 1: o cliente canônico (puro)

**Arquivos:**
- Criar: `lib/cliente-do-projeto.ts`
- Criar: `scripts/test-cliente-do-projeto.ts`
- Modificar: `package.json` (bloco `scripts`)

**Interfaces:**
- Consome: nada. É o núcleo, sem imports.
- Produz:
  - `slugDoCliente(valor: string | null | undefined): string`
  - `decidirCliente(args: { atual: string; atualKey: string; lido: string; municipioLido: string }): DecisaoDeCliente`
  - `type DecisaoDeCliente = { client: string; clientKey: string; preencheu: boolean; divergencia: { cadastrado: string; lido: string } | null }`

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-cliente-do-projeto.ts`:

```ts
/**
 * O CLIENTE CANÔNICO — slug estável e a decisão do que gravar. Puro → node cru.
 *
 *   node scripts/test-cliente-do-projeto.ts   (== npm run test:cliente)
 */
import assert from "node:assert/strict";

import { decidirCliente, slugDoCliente } from "../lib/cliente-do-projeto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("cliente do projeto\n");

test("três grafias do mesmo cliente dão a MESMA chave", () => {
  // É a razão de a chave existir: hoje isto seriam três grupos e três cores.
  assert.equal(slugDoCliente("CRICIÚMA"), "criciuma");
  assert.equal(slugDoCliente("Criciúma"), "criciuma");
  assert.equal(slugDoCliente("Prefeitura Municipal de Criciúma"), "criciuma");
});

test("a cedilha e o til sobrevivem à normalização", () => {
  assert.equal(slugDoCliente("IÇARA"), "icara");
  assert.equal(slugDoCliente("Prefeitura Municipal de São José"), "sao-jose");
  assert.equal(slugDoCliente("Chapecó"), "chapeco");
});

test("a UF não entra na chave", () => {
  // "Criciúma - SC" e "Criciúma" são o mesmo município.
  assert.equal(slugDoCliente("Criciúma - SC"), "criciuma");
  assert.equal(slugDoCliente("São José/SC"), "sao-jose");
});

test("vazio é vazio — nunca uma chave inventada", () => {
  assert.equal(slugDoCliente(""), "");
  assert.equal(slugDoCliente("   "), "");
  assert.equal(slugDoCliente(null), "");
  assert.equal(slugDoCliente(undefined), "");
  // Só palavras institucionais não identificam ninguém.
  assert.equal(slugDoCliente("Prefeitura Municipal"), "");
});

test("cliente VAZIO é preenchido pelo que foi lido", () => {
  /*
   * A inversão da regra escrita hoje em por-centro-de-custo/route.ts. O
   * cadastro de quem criou vale mais que a leitura de um PDF — mas VAZIO NÃO É
   * CADASTRO, e ninguém digita prefeitura em lugar nenhum hoje.
   */
  const d = decidirCliente({
    atual: "",
    atualKey: "",
    lido: "Prefeitura Municipal de Criciúma",
    municipioLido: "Criciúma",
  });
  assert.equal(d.client, "Prefeitura Municipal de Criciúma");
  assert.equal(d.clientKey, "criciuma");
  assert.equal(d.preencheu, true);
  assert.equal(d.divergencia, null);
});

test("cliente PREENCHIDO não é sobrescrito", () => {
  const d = decidirCliente({
    atual: "CRICIÚMA",
    atualKey: "criciuma",
    lido: "Prefeitura Municipal de Florianópolis",
    municipioLido: "Florianópolis",
  });
  assert.equal(d.client, "CRICIÚMA", "o cadastro vence a leitura");
  assert.equal(d.clientKey, "criciuma");
  assert.equal(d.preencheu, false);
  assert.deepEqual(d.divergencia, {
    cadastrado: "CRICIÚMA",
    lido: "Prefeitura Municipal de Florianópolis",
  });
});

test("ruído de grafia NÃO é divergência", () => {
  /*
   * Interromper a auditoria porque o PDF escreveu "Pref. Mun. de Criciúma" e o
   * cadastro diz "CRICIÚMA" seria atrito por ruído. A chave é que decide se é
   * o mesmo cliente.
   */
  const d = decidirCliente({
    atual: "CRICIÚMA",
    atualKey: "criciuma",
    lido: "Prefeitura Municipal de Criciúma",
    municipioLido: "Criciúma",
  });
  assert.equal(d.divergencia, null);
  assert.equal(d.preencheu, false);
});

test("chave em branco num cliente preenchido é recalculada", () => {
  // O estado que a migração deixa: `client` de antes, `clientKey` no default "".
  const d = decidirCliente({ atual: "IÇARA", atualKey: "", lido: "", municipioLido: "" });
  assert.equal(d.client, "IÇARA");
  assert.equal(d.clientKey, "icara");
  assert.equal(d.preencheu, false);
  assert.equal(d.divergencia, null);
});

test("nada lido e nada cadastrado não inventa nada", () => {
  const d = decidirCliente({ atual: "", atualKey: "", lido: "", municipioLido: "" });
  assert.equal(d.client, "");
  assert.equal(d.clientKey, "");
  assert.equal(d.preencheu, false);
  assert.equal(d.divergencia, null);
});

test("o município vence o órgão ao formar a chave", () => {
  /*
   * O órgão pode ser uma secretaria com nome longo ("Secretaria de
   * Desenvolvimento Sustentável e Obras Estruturantes"). O município é o que
   * identifica o cliente.
   */
  const d = decidirCliente({
    atual: "",
    atualKey: "",
    lido: "Secretaria de Obras de Chapecó",
    municipioLido: "Chapecó",
  });
  assert.equal(d.clientKey, "chapeco");
});

console.log(`\n${passed} passaram`);
```

- [ ] **Passo 2: rodar o teste e ver falhar**

```bash
node scripts/test-cliente-do-projeto.ts
```

Esperado: FALHA com `Cannot find module '.../lib/cliente-do-projeto.ts'`.

- [ ] **Passo 3: escrever a implementação mínima**

Criar `lib/cliente-do-projeto.ts`:

```ts
/**
 * O CLIENTE DO PROJETO — a chave estável e a decisão do que gravar.
 *
 * `Project.client` é texto que humano lê e edita: "CRICIÚMA", "Criciúma",
 * "Prefeitura Municipal de Criciúma" são a MESMA prefeitura escritas por três
 * pessoas. Agrupar o histórico ou pintar uma cor por esse texto daria três
 * grupos e três cores para um cliente só.
 *
 * `clientKey` é o slug do MUNICÍPIO, e ele não muda quando alguém corrige a
 * grafia — é isso que o torna utilizável como chave de agrupamento e de cor.
 *
 * NÃO é o id do template de capa (`pmcriciuma`): IÇARA não tem template, e
 * amarrar a identidade do cliente à existência de um modelo de capa deixaria
 * projetos reais sem chave. O template aponta para o município, não o inverso.
 *
 * PURO e sem imports → roda em node cru (`npm run test:cliente`).
 */

/**
 * Palavras que TODA prefeitura tem no nome e por isso não distinguem nenhuma.
 *
 * É a mesma lista de `GENERICOS` em `server/nexo/agent/normalize.ts`, e pela
 * mesma razão: sem ela "prefeitura" seria token de todas. Duplicada de propósito
 * — aquele arquivo importa tipos do agente, e este precisa rodar em node cru.
 */
const GENERICOS = new Set([
  "prefeitura",
  "pref",
  "municipal",
  "municipio",
  "governo",
  "estado",
  "secretaria",
  "padrao",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

/**
 * As unidades da federação. "Criciúma - SC" e "Criciúma" são o mesmo município,
 * e sem esta lista virariam duas chaves.
 *
 * A lista é fechada e de duas letras: cortar QUALQUER token de duas letras
 * comeria o "sé" de nomes legítimos.
 */
const UFS = new Set([
  "ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt",
  "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to",
]);

/** Minúsculas, sem acento — a base da comparação. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/**
 * `"Prefeitura Municipal de São José"` → `"sao-jose"`.
 *
 * Devolve `""` quando não sobra nada que identifique um município — e vazio é
 * desfecho legítimo, não falha: um projeto sem cliente é um projeto sem cliente,
 * e inventar uma chave o faria agrupar com quem não é dele.
 *
 * A ENTRADA IDEAL É O MUNICÍPIO. Passar um órgão de nome longo ("Secretaria de
 * Desenvolvimento Sustentável e Obras Estruturantes") produz uma chave longa e
 * determinística, não um erro — e ela é corrigível em `/projetos`, que é onde a
 * decisão de gente vence.
 */
export function slugDoCliente(valor: string | null | undefined): string {
  const tokens = normalizar(valor ?? "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !GENERICOS.has(t) && !UFS.has(t));

  return tokens.join("-");
}

export type DecisaoDeCliente = {
  /** O texto a gravar em `client`. Igual ao atual quando não se preenche. */
  client: string;
  /** O slug a gravar em `clientKey`. Nunca fica vazio se há `client`. */
  clientKey: string;
  /** Preencheu um campo que estava em branco. */
  preencheu: boolean;
  /** Cadastro e leitura discordam. Vira `ProjectEvent`, nunca uma pergunta. */
  divergencia: { cadastrado: string; lido: string } | null;
};

/**
 * O QUE GRAVAR no cliente do projeto, dadas as quatro situações do desenho.
 *
 * A regra que muda de comportamento é a segunda: cliente VAZIO passa a ser
 * preenchido pelo que a classificação leu. O comentário de
 * `por-centro-de-custo/route.ts` diz que "o cadastro de quem o criou vale mais
 * do que a leitura de um PDF qualquer", e continua certo — mas **vazio não é
 * cadastro**, e hoje ninguém digita prefeitura em lugar nenhum do produto.
 */
export function decidirCliente(args: {
  atual: string;
  atualKey: string;
  lido: string;
  municipioLido: string;
}): DecisaoDeCliente {
  const atual = (args.atual ?? "").trim();
  const lido = (args.lido ?? "").trim();
  /* A chave sai do MUNICÍPIO quando ele existe: o órgão pode ser uma secretaria
   * de nome longo, e o município é o que identifica o cliente. */
  const chaveLida = slugDoCliente(args.municipioLido || lido);

  if (!atual) {
    /* Preencher o branco. Não desrespeita decisão nenhuma — não havia decisão. */
    return {
      client: lido,
      clientKey: lido ? chaveLida : "",
      preencheu: Boolean(lido),
      divergencia: null,
    };
  }

  /* O cadastro fica. A chave é recalculada quando está em branco — é o estado
   * que a migração deixa nos projetos que já existiam. */
  const chaveAtual = (args.atualKey ?? "").trim() || slugDoCliente(atual);

  /* Sem leitura não há com o que divergir. */
  if (!lido) {
    return { client: atual, clientKey: chaveAtual, preencheu: false, divergencia: null };
  }

  /* A CHAVE é quem decide se é o mesmo cliente. "Pref. Mun. de Criciúma" e
   * "CRICIÚMA" dão a mesma chave, e alarmar sobre isso seria ruído de grafia. */
  const mesmo = chaveLida !== "" && chaveLida === chaveAtual;

  return {
    client: atual,
    clientKey: chaveAtual,
    preencheu: false,
    divergencia: mesmo ? null : { cadastrado: atual, lido },
  };
}
```

- [ ] **Passo 4: rodar o teste e ver passar**

```bash
node scripts/test-cliente-do-projeto.ts
```

Esperado: 10 linhas `ok` e `10 passaram`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, dentro de `"scripts"`, ao lado de `"test:resolucao"`:

```json
"test:cliente": "node scripts/test-cliente-do-projeto.ts",
```

Rodar `npm run test:cliente` e confirmar a mesma saída.

- [ ] **Passo 6: commit**

```bash
git add lib/cliente-do-projeto.ts scripts/test-cliente-do-projeto.ts package.json
git diff --cached --stat
git commit -m "a prefeitura ganha uma chave que sobrevive à grafia"
```

---

### Task 2: quando o código lido troca o projeto da conversa

**Arquivos:**
- Modificar: `lib/resolucao-de-projeto.ts`
- Modificar: `scripts/test-resolucao-de-projeto.ts`

**Interfaces:**
- Consome: `normalizarCentroDeCusto` do próprio arquivo.
- Produz: `decidirTroca(args: { codigoAtual: string | null | undefined; codigoLido: string | null | undefined }): { acao: "manter" | "vincular" | "conflito" }`

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar ao fim de `scripts/test-resolucao-de-projeto.ts`, **antes** da linha
final que imprime o total:

```ts
test("sem código vinculado, o lido vincula", () => {
  assert.deepEqual(decidirTroca({ codigoAtual: null, codigoLido: "099-25" }), {
    acao: "vincular",
  });
  assert.deepEqual(decidirTroca({ codigoAtual: "", codigoLido: "099-25" }), {
    acao: "vincular",
  });
});

test("o MESMO código, escrito diferente, mantém o vínculo", () => {
  // Reanexar o mesmo memorial depois de um F5 não pode remexer no vínculo.
  assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "099/25" }), {
    acao: "manter",
  });
  assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "CC 099.25" }), {
    acao: "manter",
  });
});

test("código DIFERENTE é conflito — nunca troca em silêncio", () => {
  /*
   * Dois memoriais de projetos diferentes na mesma conversa é erro de quem
   * anexou, não decisão a executar. Trocar caladamente levaria os achados do
   * primeiro para a fila do segundo, e o erro só apareceria dias depois.
   */
  assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "063-26" }), {
    acao: "conflito",
  });
});

test("não ler código não desfaz o vínculo que existe", () => {
  // Um segundo anexo ilegível não pode apagar o endereço já conquistado.
  assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: null }), {
    acao: "manter",
  });
  assert.deepEqual(decidirTroca({ codigoAtual: "099-25", codigoLido: "  " }), {
    acao: "manter",
  });
});

test("sem nada dos dois lados, não há o que fazer", () => {
  assert.deepEqual(decidirTroca({ codigoAtual: null, codigoLido: null }), {
    acao: "manter",
  });
});
```

E acrescentar `decidirTroca` ao `import` no topo do arquivo, junto das funções
que ele já importa de `../lib/resolucao-de-projeto.ts`.

- [ ] **Passo 2: rodar o teste e ver falhar**

```bash
npm run test:resolucao
```

Esperado: FALHA com `decidirTroca is not a function` (ou erro de importação).

- [ ] **Passo 3: escrever a implementação mínima**

Acrescentar ao fim de `lib/resolucao-de-projeto.ts`:

```ts
/**
 * O CÓDIGO LIDO AGORA MUDA O PROJETO DA CONVERSA?
 *
 * O anexo pode ser refeito: um F5, uma reclassificação, um segundo memorial na
 * mesma conversa. Três desfechos, e o terceiro é o que dá o desenho:
 *
 *  · `manter`   — mesmo código, ou nada novo legível. Nada a fazer;
 *  · `vincular` — a conversa ainda não tinha endereço e agora tem;
 *  · `conflito` — o documento novo é de OUTRO projeto. Quem decide é gente.
 *
 * `conflito` não troca o vínculo. Trocar em silêncio levaria os achados do
 * primeiro memorial para a fila do segundo, e o erro só apareceria dias depois,
 * quando alguém recebesse uma pendência que não é dele — o mesmo modo de falhar
 * que o docblock deste arquivo já descreve.
 *
 * Puro: a comparação passa pela MESMA `normalizarCentroDeCusto` do resto do
 * arquivo, senão "099/25" e "099-25" seriam projetos diferentes.
 */
export function decidirTroca(args: {
  codigoAtual: string | null | undefined;
  codigoLido: string | null | undefined;
}): { acao: "manter" | "vincular" | "conflito" } {
  const atual = normalizarCentroDeCusto(args.codigoAtual ?? "");
  const lido = normalizarCentroDeCusto(args.codigoLido ?? "");

  // Um anexo ilegível não desfaz o endereço já conquistado.
  if (!lido) return { acao: "manter" };
  if (!atual) return { acao: "vincular" };

  return { acao: atual === lido ? "manter" : "conflito" };
}
```

- [ ] **Passo 4: rodar o teste e ver passar**

```bash
npm run test:resolucao
```

Esperado: todos os casos antigos mais os cinco novos, todos `ok`.

- [ ] **Passo 5: commit**

```bash
git add lib/resolucao-de-projeto.ts scripts/test-resolucao-de-projeto.ts
git diff --cached --stat
git commit -m "reanexar o mesmo memorial não remexe no vínculo; outro projeto não troca calado"
```

---

### Task 3: as duas colunas

**Arquivos:**
- Modificar: `prisma/schema.prisma`
- Criar: `prisma/migrations/<timestamp>_identidade_do_projeto/migration.sql` (gerado)

**Interfaces:**
- Consome: nada.
- Produz: `Project.clientKey: String @default("")`, `NexoConversation.projectId: String?`
  com relação `NexoConversation.project` → `Project.nexoConversations`.

- [ ] **Passo 1: declarar as colunas no schema**

Em `prisma/schema.prisma`, no `model Project`, logo abaixo de `client`:

```prisma
  /// A CHAVE ESTÁVEL do cliente — `criciuma`, `icara`, `chapeco`.
  ///
  /// `client` é texto que humano lê e edita: "CRICIÚMA", "Criciúma" e
  /// "Prefeitura Municipal de Criciúma" são a MESMA prefeitura. Agrupar o
  /// histórico ou pintar uma cor por esse texto daria três grupos para um
  /// cliente só, e a chave é o que não muda quando alguém corrige a grafia.
  ///
  /// Derivada por `lib/cliente-do-projeto.ts`, nunca digitada. Vazia é estado
  /// legítimo: projeto sem cliente é projeto sem cliente, e inventar chave o
  /// faria agrupar com quem não é dele.
  clientKey      String             @default("")
```

Ainda no `model Project`, junto das outras relações (depois de `aiTasks`):

```prisma
  nexoConversations NexoConversation[]
```

E no `model Project`, junto dos outros `@@index`:

```prisma
  @@index([organizationId, clientKey])
```

No `model NexoConversation`, logo abaixo de `folderKey`:

```prisma
  /// O ENDEREÇO da conversa — o `Project` a que ela pertence.
  ///
  /// `folderKey` era a identidade, e era uma string derivada no navegador: a
  /// barra lateral agrupava por ela enquanto a home e a fila agrupavam por
  /// chave estrangeira. Dois conceitos de "projeto" que não conversavam, e o
  /// sintoma era todo memorial auditado caindo em "Sem código no carimbo".
  ///
  /// `folderKey` continua existindo como cache de EXIBIÇÃO; a identidade é
  /// esta coluna.
  ///
  /// NULO É LEGÍTIMO — é a conversa "a endereçar": memorial sem código legível,
  /// ou conversa que ainda não recebeu documento nenhum.
  ///
  /// `SetNull` como no `Audit`: apagar o projeto não pode apagar a conversa,
  /// que guarda o trabalho de quem a escreveu.
  projectId         String?
  project           Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
```

E o índice, junto do que já existe:

```prisma
  @@index([projectId, updatedAt])
```

- [ ] **Passo 2: gerar a migração**

```bash
npm run db:migrate:dev -- --name identidade_do_projeto
```

Esperado: cria `prisma/migrations/<timestamp>_identidade_do_projeto/migration.sql`
e aplica no `nexodoc_dev`. Se o comando pendurar com `P1002`, a migração está
travada no pooler: rode `npm run db:destravar` e repita.

- [ ] **Passo 3: conferir o SQL gerado**

```bash
cat prisma/migrations/*_identidade_do_projeto/migration.sql
```

Esperado — quatro comandos, e **nenhum** `DROP`:

```sql
ALTER TABLE "Project" ADD COLUMN "clientKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NexoConversation" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Project_organizationId_clientKey_idx" ON "Project"("organizationId", "clientKey");
CREATE INDEX "NexoConversation_projectId_updatedAt_idx" ON "NexoConversation"("projectId", "updatedAt");
ALTER TABLE "NexoConversation" ADD CONSTRAINT "NexoConversation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Se aparecer qualquer `DROP TABLE` ou `DROP COLUMN`, **pare**: é sinal de que o
schema local divergiu do banco. Não aplique.

- [ ] **Passo 3b: regenerar o client do Prisma**

```bash
npm run db:generate
```

**Não pule.** `prisma migrate dev` altera o BANCO, e o client tipado que o Node
importa continua sendo o de antes. Sem isto, a prova da Task 4 quebra com
`Unknown argument 'clientKey'. Did you mean 'client'?` — uma mensagem que aponta
para o código quando o problema é o client desatualizado.

- [ ] **Passo 4: provar que as colunas existem e nada quebrou**

```bash
node --import ./scripts/lib/resolver-de-imports.mjs -e "
import('./lib/db.ts').then(async ({ getPrisma }) => {
  const p = getPrisma();
  const projs = await p.project.findMany({ select: { code: true, client: true, clientKey: true } });
  console.log(projs);
  const n = await p.nexoConversation.count({ where: { projectId: null } });
  console.log('conversas sem projeto:', n);
});
"
```

Esperado: os quatro projetos com `clientKey: ''` (ainda vazio — o preenchimento é
a Task 10), e `conversas sem projeto: 72`.

- [ ] **Passo 5: commit**

```bash
git add prisma/schema.prisma prisma/migrations
git diff --cached --stat
git commit -m "a conversa ganha endereço e o cliente ganha chave: as duas colunas"
```

---

### Task 4: a prefeitura passa a ser gravada

**Arquivos:**
- Modificar: `app/api/projects/por-centro-de-custo/route.ts`
- Criar: `scripts/prova-identidade-do-projeto.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: `decidirCliente` de `lib/cliente-do-projeto.ts` (Task 1);
  `createProjectEvent` de `lib/project-store.ts`.
- Produz: a rota passa a aceitar `municipio` no corpo e devolve
  `{ project: { id, code, client, clientKey } }`.

- [ ] **Passo 1: escrever a prova que falha**

Criar `scripts/prova-identidade-do-projeto.mjs`:

```js
// A IDENTIDADE DO PROJETO, provada contra o banco de verdade.
//
//   node scripts/prova-identidade-do-projeto.mjs   (== npm run prova:identidade)
//
// Três perguntas que só o banco responde:
//   1. cliente VAZIO é preenchido pelo que a classificação leu?
//   2. rodar duas vezes duplica projeto ou sobrescreve cadastro?
//   3. cliente DIFERENTE vira divergência registrada, e não sobrescrita?
//
// SEM IA e SEM NAVEGADOR: o que se testa é a gravação, não o motor.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { decidirCliente } = await import("../lib/cliente-do-projeto.ts");

const prisma = getPrisma();
const ORG = "org-prosul";
const CODE = "777-99";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// Limpa o resto de uma corrida anterior — a prova tem que poder rodar duas vezes.
await prisma.projectEvent.deleteMany({ where: { project: { organizationId: ORG, code: CODE } } });
await prisma.project.deleteMany({ where: { organizationId: ORG, code: CODE } });

// 1. Nasce SEM cliente, como nascem os projetos criados à mão hoje.
const criado = await prisma.project.create({
  data: {
    organizationId: ORG,
    code: CODE,
    name: "Projeto da prova",
    client: "",
    clientKey: "",
    ownerEmail: "prova@nexodoc.local",
  },
  select: { id: true, client: true, clientKey: true },
});
check("nasce com cliente vazio", criado.client === "" && criado.clientKey === "");

// 2. A classificação leu a prefeitura. O vazio tem que ser preenchido.
const primeira = decidirCliente({
  atual: criado.client,
  atualKey: criado.clientKey,
  lido: "Prefeitura Municipal de Criciúma",
  municipioLido: "Criciúma",
});
check("a decisão manda preencher", primeira.preencheu === true, JSON.stringify(primeira));

await prisma.project.update({
  where: { id: criado.id },
  data: { client: primeira.client, clientKey: primeira.clientKey },
});

const depois = await prisma.project.findUniqueOrThrow({
  where: { id: criado.id },
  select: { client: true, clientKey: true },
});
check(
  "a prefeitura ficou gravada",
  depois.client === "Prefeitura Municipal de Criciúma" && depois.clientKey === "criciuma",
  JSON.stringify(depois),
);

// 3. Segunda passada com a MESMA prefeitura: não preenche de novo, não diverge.
const segunda = decidirCliente({
  atual: depois.client,
  atualKey: depois.clientKey,
  lido: "CRICIÚMA",
  municipioLido: "Criciúma",
});
check(
  "reprocessar não mexe em nada",
  segunda.preencheu === false && segunda.divergencia === null && segunda.client === depois.client,
  JSON.stringify(segunda),
);

// 4. Prefeitura DIFERENTE: divergência, e o cadastro fica de pé.
const terceira = decidirCliente({
  atual: depois.client,
  atualKey: depois.clientKey,
  lido: "Prefeitura Municipal de Florianópolis",
  municipioLido: "Florianópolis",
});
check(
  "cliente diferente não sobrescreve",
  terceira.client === "Prefeitura Municipal de Criciúma",
  JSON.stringify(terceira),
);
check("cliente diferente vira divergência", terceira.divergencia !== null);

// 5. Um projeto só. O `upsert` da rota não pode ter criado um paralelo.
const quantos = await prisma.project.count({ where: { organizationId: ORG, code: CODE } });
check("existe UM projeto para o código", quantos === 1, `achei ${quantos}`);

await prisma.projectEvent.deleteMany({ where: { projectId: criado.id } });
await prisma.project.delete({ where: { id: criado.id } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/prova-identidade-do-projeto.mjs
```

Esperado: FALHA. Ou o `clientKey` não existe (Task 3 não aplicada), ou
`decidirCliente` não é encontrado.

Se a Task 3 já foi aplicada e a Task 1 também, esta prova **passa** já neste
passo — ela testa o núcleo puro contra o banco. Nesse caso siga para o Passo 3:
o que ainda falta é a **rota** usar esse núcleo.

- [ ] **Passo 3: fazer a rota usar a decisão**

Em `app/api/projects/por-centro-de-custo/route.ts`, acrescentar aos imports:

```ts
import { decidirCliente } from "@/lib/cliente-do-projeto";
import { createProjectEvent } from "@/lib/project-store";
```

Trocar a leitura do corpo para aceitar também o município:

```ts
    const corpo = (await request.json().catch(() => null)) as {
      code?: unknown;
      client?: unknown;
      name?: unknown;
      municipio?: unknown;
    } | null;

    const code = normalizarCentroDeCusto(typeof corpo?.code === "string" ? corpo.code : "");
    const client = typeof corpo?.client === "string" ? corpo.client.trim().slice(0, 200) : "";
    const nome = typeof corpo?.name === "string" ? corpo.name.trim().slice(0, 200) : "";
    /* O município forma a CHAVE; o órgão forma o texto. Ver `decidirCliente`. */
    const municipio =
      typeof corpo?.municipio === "string" ? corpo.municipio.trim().slice(0, 200) : "";
```

Substituir o bloco do `upsert` inteiro (de `const project = await getPrisma().project.upsert(`
até o `return NextResponse.json({ project }, { status: 201 });`) por:

```ts
    const prisma = getPrisma();

    /*
     * PRIMEIRO LÊ, DEPOIS DECIDE.
     *
     * O `update: {}` de antes deixava o cliente em branco para sempre: projeto
     * criado sem prefeitura nunca ganhava uma, por mais memoriais daquele centro
     * de custo que passassem por ele. Agora a decisão é de `decidirCliente`, e
     * ela distingue as duas coisas que o `update: {}` confundia — sobrescrever
     * um cadastro (proibido) e preencher um branco (que é o único jeito de o
     * dado existir).
     */
    const existente = await prisma.project.findUnique({
      where: { organizationId_code: { organizationId: actor.organizationId, code } },
      select: { id: true, client: true, clientKey: true },
    });

    const decisao = decidirCliente({
      atual: existente?.client ?? "",
      atualKey: existente?.clientKey ?? "",
      lido: client,
      municipioLido: municipio,
    });

    /*
     * `upsert`, e não `create`: duas pessoas podem arrastar o mesmo memorial ao
     * mesmo tempo, e o unique `(organizationId, code)` transformaria a segunda
     * num erro de banco que a tela não saberia explicar.
     */
    const project = await prisma.project.upsert({
      where: { organizationId_code: { organizationId: actor.organizationId, code } },
      create: {
        organizationId: actor.organizationId,
        code,
        client: decisao.client,
        clientKey: decisao.clientKey,
        // Sem nome legível, o código serve: uma pasta chamada "099-25" é pior
        // que "Reforma da UBS", e muito melhor que uma sem nome nenhum.
        name: nome || code,
        ownerEmail: actor.email,
        ownerName: actor.name,
        createdById: actor.userId,
      },
      /*
       * Só o que a decisão autorizou. Quando ela manda manter, isto reescreve os
       * mesmos valores — e a chave em branco de um projeto anterior à migração é
       * recalculada de passagem, sem script nenhum.
       */
      update: { client: decisao.client, clientKey: decisao.clientKey },
      select: { id: true, code: true, client: true, clientKey: true },
    });

    /*
     * A DIVERGÊNCIA É REGISTRADA, NÃO PERGUNTADA.
     *
     * Interromper a auditoria porque o PDF escreveu "Pref. Mun. de Criciúma" e o
     * cadastro diz "Prefeitura Municipal de Criciúma" seria atrito por ruído de
     * grafia — e `decidirCliente` já descarta esse caso pela chave. O que chega
     * aqui são clientes de fato diferentes, e isso é coisa para alguém olhar na
     * tela do projeto, não no meio do trabalho.
     */
    if (decisao.divergencia) {
      await createProjectEvent(prisma, {
        projectId: project.id,
        actor: { id: actor.userId, email: actor.email, name: actor.name },
        type: "PROJECT_UPDATED",
        title: "Cliente do documento difere do cadastro",
        summary: `O cadastro diz "${decisao.divergencia.cadastrado}"; o documento trouxe "${decisao.divergencia.lido}".`,
        details: decisao.divergencia,
      });
    }

    return NextResponse.json({ project }, { status: 201 });
```

- [ ] **Passo 4: rodar a prova e ver passar**

```bash
node scripts/prova-identidade-do-projeto.mjs
```

Esperado: seis linhas `OK` e `prova passou`.

- [ ] **Passo 5: registrar o script e conferir o lint**

Em `package.json`, dentro de `"scripts"`:

```json
"prova:identidade": "node scripts/prova-identidade-do-projeto.mjs",
```

```bash
npm run lint
```

Esperado: sem erros nos arquivos tocados.

- [ ] **Passo 6: commit**

```bash
git add app/api/projects/por-centro-de-custo/route.ts scripts/prova-identidade-do-projeto.mjs package.json
git diff --cached --stat
git commit -m "vazio não é cadastro: o projeto sem cliente passa a ganhar a prefeitura lida"
```

---

### Task 5: o `projectId` atravessa a rede

**Arquivos:**
- Modificar: `server/nexo/conversa-remota.ts`
- Modificar: `scripts/test-nexo-conversa-remota.ts`
- Modificar: `app/api/nexo/conversas/route.ts`
- Modificar: `app/api/nexo/conversas/resumo/route.ts`
- Modificar: `modules/nexo/lib/cartoes-de-projeto.ts` (só a interface `ConversaResumida`)

**Interfaces:**
- Consome: as colunas da Task 3.
- Produz:
  - `ResumoDaConversa.projectId?: string` e `RegistroDaConversa.projectId?: string`
  - `ConversaResumida` ganha `projectId: string | null`, `projectCode: string`,
    `projectClient: string`

- [ ] **Passo 1: escrever o teste que falha**

Acrescentar a `scripts/test-nexo-conversa-remota.ts`, antes do total:

```ts
test("o projectId sobrevive à validação e ao resumo", () => {
  const corpo = {
    id: "c1",
    title: "Memorial",
    createdAt: 1,
    updatedAt: 2,
    projectId: "proj-063-26",
  };
  const v = validarRegistro(corpo);
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(resumoDoRegistro(v.registro).projectId, "proj-063-26");
});

test("projectId de tipo errado é recusado, não convertido", () => {
  // Vira coluna e chave estrangeira: um número aqui quebraria a gravação lá.
  const v = validarRegistro({ id: "c1", title: "t", createdAt: 1, updatedAt: 2, projectId: 7 });
  assert.equal(v.ok, false);
});

test("conversa a endereçar não inventa projectId", () => {
  const v = validarRegistro({ id: "c1", title: "t", createdAt: 1, updatedAt: 2 });
  assert.equal(v.ok, true);
  if (!v.ok) return;
  assert.equal(resumoDoRegistro(v.registro).projectId, undefined);
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npm run test:nexo:conversa-remota
```

Esperado: FALHA em "o projectId sobrevive" — `undefined !== 'proj-063-26'`.

- [ ] **Passo 3: implementar no núcleo**

Em `server/nexo/conversa-remota.ts`:

Na interface `ResumoDaConversa`, depois de `folderKey?: string;`:

```ts
  /**
   * O ENDEREÇO da conversa — o `Project` do Postgres.
   *
   * Diferente de `tipo`, este campo VEM da listagem do servidor: é coluna, não
   * mora dentro do JSON. `fundirListas` pode confiar no que o servidor disser.
   */
  projectId?: string;
```

Na interface `RegistroDaConversa`, depois de `folderKey?: string;`:

```ts
  projectId?: string;
```

Em `validarRegistro`, logo depois da checagem de `folderKey`:

```ts
  if (r.projectId !== undefined && typeof r.projectId !== "string") {
    return { ok: false, motivo: "projectId inválido" };
  }
```

Em `resumoDoRegistro`, depois da linha do `folderKey`:

```ts
    ...(r.projectId ? { projectId: r.projectId } : {}),
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npm run test:nexo:conversa-remota
```

Esperado: todos `ok`, incluindo os três novos.

- [ ] **Passo 5: persistir e devolver na rota das conversas**

Em `app/api/nexo/conversas/route.ts`:

No `select` do `GET`, depois de `folderKey: true,`:

```ts
        projectId: true,
```

No `map` que monta `conversas`, depois da linha do `folderKey`:

```ts
      ...(l.projectId ? { projectId: l.projectId } : {}),
```

No `PUT`, dentro do objeto `campos`, depois de `folderKey`:

```ts
      projectId: resumo.projectId ?? null,
```

- [ ] **Passo 6: juntar o projeto no resumo**

Em `app/api/nexo/conversas/resumo/route.ts`, no tipo `LinhaCrua`, depois de
`folderKey`:

```ts
  projectId: string | null;
  projectCode: string;
  projectClient: string;
```

Trocar a consulta por (mudam só o `SELECT` e o `FROM`):

```ts
    const linhas = await getPrisma().$queryRaw<LinhaCrua[]>`
      SELECT c.id, c.title, c."folderKey", c."projectId", c.tipo, c."updatedAt",
        c."auditoriaPendente",
        /*
         * O código e o cliente vêm do PROJETO, não de uma string derivada no
         * navegador. É por isso que renomear o cliente em /projetos passa a
         * refletir na barra sem migração e sem reprocessar nada.
         */
        COALESCE(p.code, '') AS "projectCode",
        COALESCE(p.client, '') AS "projectClient",
        CASE WHEN jsonb_typeof(c.data->'seloResults') = 'array'
             THEN jsonb_array_length(c.data->'seloResults') ELSE 0 END AS folhas,
        COALESCE((
          SELECT array_agg(DISTINCT r->>'kind')
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(c.data->'results') = 'array'
                      THEN c.data->'results' ELSE '[]'::jsonb END) r
          WHERE r->>'kind' IS NOT NULL
        ), ARRAY[]::text[]) AS kinds
      FROM "NexoConversation" c
      LEFT JOIN "Project" p ON p.id = c."projectId"
      WHERE c."userEmail" = ${g.userEmail}
      ORDER BY c."updatedAt" DESC
      LIMIT 300`;
```

E no `map`, depois de `folderKey: l.folderKey,`:

```ts
      projectId: l.projectId,
      projectCode: l.projectCode ?? "",
      projectClient: l.projectClient ?? "",
```

- [ ] **Passo 7: abrir espaço na interface do cartão**

Em `modules/nexo/lib/cartoes-de-projeto.ts`, na interface `ConversaResumida`,
depois de `folderKey: string | null;`:

```ts
  /** O `Project` a que a conversa pertence. Nulo = a endereçar. */
  projectId: string | null;
  /** `063-26`, lido do projeto. Vazio quando não há vínculo. */
  projectCode: string;
  /** `CRICIÚMA`, lido do projeto. Vazio quando não há vínculo ou cliente. */
  projectClient: string;
```

O consumo desses campos é a Task 9; aqui só o contrato entra, para o `tsc` da
rota fechar.

- [ ] **Passo 8: provar que o campo chega de ponta a ponta**

Com o `next dev` rodando (reinicie-o antes — o dev server velho dá falha falsa):

```bash
node --import ./scripts/lib/resolver-de-imports.mjs -e "
import('./lib/db.ts').then(async ({ getPrisma }) => {
  const p = getPrisma();
  const proj = await p.project.findFirst({ where: { code: '063-26' }, select: { id: true } });
  const conv = await p.nexoConversation.findFirst({ select: { id: true } });
  await p.nexoConversation.update({ where: { id: conv.id }, data: { projectId: proj.id } });
  const r = await p.\$queryRaw\`
    SELECT c.id, c.\"projectId\", COALESCE(p.code,'') AS code, COALESCE(p.client,'') AS client
    FROM \"NexoConversation\" c LEFT JOIN \"Project\" p ON p.id = c.\"projectId\"
    WHERE c.id = \${conv.id}\`;
  console.log(r);
  await p.nexoConversation.update({ where: { id: conv.id }, data: { projectId: null } });
});
"
```

Esperado: uma linha com `code: '063-26'` e `client: 'CRICIÚMA'`. O `update` final
desfaz a semeadura.

- [ ] **Passo 9: commit**

```bash
git add server/nexo/conversa-remota.ts scripts/test-nexo-conversa-remota.ts \
  app/api/nexo/conversas/route.ts app/api/nexo/conversas/resumo/route.ts \
  modules/nexo/lib/cartoes-de-projeto.ts
git diff --cached --stat
git commit -m "o endereço da conversa atravessa a rede e o código vem do projeto"
```

---

### Task 6: o store guarda o vínculo

**Arquivos:**
- Modificar: `modules/nexo/lib/nexo-db.ts`
- Modificar: `modules/nexo/state/conversation-store.tsx`

**Interfaces:**
- Consome: `RegistroDaConversa.projectId` (Task 5).
- Produz: no contexto do store — `projectId: string | null` e
  `vincularProjeto(id: string | null): void`.

- [ ] **Passo 1: declarar o campo no registro local**

Em `modules/nexo/lib/nexo-db.ts`, na interface `StoredConversation`, logo depois
de `folderKey?: string;`:

```ts
  /**
   * O `Project` do Postgres a que esta conversa pertence.
   *
   * `folderKey` era a identidade e virou cache de exibição: ele é uma string
   * derivada, e a barra lateral agrupava por ela enquanto a home agrupava por
   * chave estrangeira. Ausente = conversa "a endereçar", que é estado legítimo.
   *
   * Opcional, como `ajustes`: registro gravado antes deste campo não tem, e a
   * leitura cai em nulo. Sem migração de `DB_VERSION` — o registro é schemaless.
   */
  projectId?: string;
```

- [ ] **Passo 2: guardar e restaurar no store**

Em `modules/nexo/state/conversation-store.tsx`:

Junto dos outros `useState` (depois de `const [identidade, setIdentidade] = ...`):

```tsx
  /** O projeto desta conversa. Nulo = a endereçar. */
  const [projectId, setProjectId] = useState<string | null>(null);
```

No objeto do registro montado no persist, logo depois da linha do `folderKey`
(`...(folderKey ? { folderKey } : {}),`):

```tsx
      ...(s.projectId ? { projectId: s.projectId } : {}),
```

Na restauração (junto de `setIdentidade(rec.identidade ?? {})`):

```tsx
      setProjectId(rec.projectId ?? null);
```

Na limpeza da conversa nova (junto de `setIdentidade({})`):

```tsx
    setProjectId(null);
```

Acrescentar o callback, ao lado de `corrigirIdentidade`:

```tsx
  /*
   * O ENDEREÇO da conversa, decidido no ANEXO.
   *
   * Antes disto a pasta era derivada de uma string (`pastaDoProjeto`) e a
   * conversa de memorial nunca tinha uma: o dossiê morria num `useState` do
   * NexoWorkspace e nunca chegava aqui. O vínculo agora é a chave estrangeira,
   * e ela é gravada no instante em que a classificação lê o centro de custo.
   *
   * Aceita `null` de propósito: desvincular é uma ação legítima da tela quando
   * alguém percebe que anexou o memorial na conversa errada.
   */
  const vincularProjeto = useCallback(
    (id: string | null) => {
      setProjectId(id);
      schedulePersist();
    },
    [schedulePersist],
  );
```

Acrescentar `projectId` e `vincularProjeto` ao tipo do contexto (junto de
`corrigirIdentidade: (patch: Record<string, string>) => void;`):

```tsx
  projectId: string | null;
  vincularProjeto: (id: string | null) => void;
```

E aos dois objetos de valor do provider (as duas listas onde
`corrigirIdentidade` já aparece, por volta das linhas 1331 e 1376):

```tsx
      projectId,
      vincularProjeto,
```

Incluir `projectId` no snapshot que o persist lê (o objeto `s`), junto de
`identidade`.

- [ ] **Passo 3: conferir que compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros. Se acusar `projectId` faltando no snapshot do persist, é o
objeto `s` — acrescente `projectId` a ele.

- [ ] **Passo 4: commit**

```bash
git add modules/nexo/lib/nexo-db.ts modules/nexo/state/conversation-store.tsx
git diff --cached --stat
git commit -m "a conversa passa a guardar de que projeto ela é"
```

---

### Task 7: vincular no anexo

**Arquivos:**
- Modificar: `modules/nexo/lib/projeto-da-auditoria.ts`
- Modificar: `modules/nexo/components/ConfirmationCard.tsx:2316`

**Interfaces:**
- Consome: `decidirTroca` (Task 2), `vincularProjeto` do store (Task 6),
  `resolverProjetoDaAuditoria` (existente).
- Produz:
  - `type Vinculo = { tipo: "vinculado"; projeto: ProjetoConhecido } | { tipo: "manter" } | { tipo: "conflito"; atual: string; lido: string } | { tipo: "impasse"; resolvido: ProjetoResolvido }`
  - `vincularProjetoDaConversa(args: { codigoAtual: string | null; codigoLido: string | null; prefeitura?: string | null; obra?: string | null; municipio?: string | null; signal?: AbortSignal }): Promise<Vinculo>`

- [ ] **Passo 1: escrever a função de vínculo**

Primeiro, no **bloco de imports do topo** do arquivo, acrescentar `decidirTroca`
ao import que já traz `resolverProjeto` de `@/lib/resolucao-de-projeto`:

```ts
import {
  decidirTroca,
  resolverProjeto,
  type ProjetoConhecido,
  type ResolucaoDeProjeto,
} from "@/lib/resolucao-de-projeto";
```

Depois, ao **fim** de `modules/nexo/lib/projeto-da-auditoria.ts`:

```ts
export type Vinculo =
  | { tipo: "vinculado"; projeto: ProjetoConhecido }
  /** Nada mudou: mesmo código, ou nada novo legível. */
  | { tipo: "manter" }
  /** O documento novo é de OUTRO projeto. Quem decide é gente. */
  | { tipo: "conflito"; atual: string; lido: string }
  /** Não deu para endereçar. `fraseDoImpasse` explica o porquê. */
  | { tipo: "impasse"; resolvido: ProjetoResolvido };

/**
 * ENDEREÇAR A CONVERSA NO ANEXO — e não no disparo da auditoria.
 *
 * A resolução morava no `confirm()` do ConfirmationCard, junto com o disparo. A
 * barra lateral, porém, precisa saber a que projeto a conversa pertence ANTES
 * disso: no instante em que a conversa é gravada, e é essa defasagem que
 * produzia o "Sem código no carimbo" — no momento da gravação ninguém ainda
 * tinha decidido o projeto.
 *
 * NÃO BLOQUEIA O ANEXO. Memorial sem código legível devolve `impasse`, e a
 * conversa fica "A endereçar" com ação inline no cartão. Cobrar a decisão aqui
 * exigiria uma escolha de quem talvez só queira olhar o documento; o disparo da
 * auditoria continua cobrando, como já cobrava.
 */
export async function vincularProjetoDaConversa(args: {
  codigoAtual: string | null;
  codigoLido: string | null;
  prefeitura?: string | null;
  obra?: string | null;
  municipio?: string | null;
  signal?: AbortSignal;
}): Promise<Vinculo> {
  const { acao } = decidirTroca({
    codigoAtual: args.codigoAtual,
    codigoLido: args.codigoLido,
  });

  if (acao === "manter") return { tipo: "manter" };

  if (acao === "conflito") {
    /*
     * NÃO TROCA. Dois memoriais de projetos diferentes na mesma conversa é erro
     * de quem anexou; trocar em silêncio levaria os achados do primeiro para a
     * fila do segundo, e o erro só apareceria dias depois.
     */
    return {
      tipo: "conflito",
      atual: args.codigoAtual ?? "",
      lido: args.codigoLido ?? "",
    };
  }

  const resolvido = await resolverProjetoDaAuditoria(args.codigoLido, args.signal, {
    prefeitura: args.prefeitura,
    obra: args.obra,
    municipio: args.municipio,
  });

  if (resolvido.tipo === "achado") return { tipo: "vinculado", projeto: resolvido.projeto };

  return { tipo: "impasse", resolvido };
}
```

- [ ] **Passo 2: mandar o município junto ao criar a pasta**

Ainda em `modules/nexo/lib/projeto-da-auditoria.ts`, na assinatura de
`resolverProjetoDaAuditoria`, o terceiro parâmetro passa a aceitar município:

```ts
  identidade?: { prefeitura?: string | null; obra?: string | null; municipio?: string | null },
```

E no corpo da chamada a `/api/projects/por-centro-de-custo`, no `JSON.stringify`:

```ts
        body: JSON.stringify({
          code: resolucao.codigo,
          client: identidade?.prefeitura ?? "",
          name: identidade?.obra ?? "",
          /* Forma a CHAVE do cliente. O órgão pode ser uma secretaria de nome
           * longo; o município é o que identifica a prefeitura. */
          municipio: identidade?.municipio ?? "",
        }),
```

- [ ] **Passo 3: o disparo passa a LER o vínculo**

Em `modules/nexo/components/ConfirmationCard.tsx`, substituir o bloco que hoje
resolve o destino (a partir de `const destino = await resolverProjetoDaAuditoria(`,
por volta da linha 2316) por:

```tsx
    /*
     * O ENDEREÇO JÁ FOI DECIDIDO NO ANEXO.
     *
     * Este bloco resolvia o projeto aqui, e por isso a barra lateral não tinha
     * como saber a que projeto a conversa pertencia antes de alguém mandar
     * auditar. Agora ele apenas LÊ o vínculo — e só resolve quando não há um,
     * que é o caso do memorial sem código legível.
     */
    let projectId = conv.projectId;

    if (!projectId) {
      const destino = await resolverProjetoDaAuditoria(memorialFatos?.codigo, undefined, {
        prefeitura,
        obra,
        municipio,
      });

      if (destino.tipo !== "achado") {
        setError(fraseDoImpasse(destino));
        setBusy(false);
        return;
      }

      projectId = destino.projeto.id;
      conv.vincularProjeto(projectId);
    }
```

E, mais abaixo na mesma função, trocar `projectId: destino.projeto.id,` por:

```tsx
          projectId,
```

- [ ] **Passo 4: conferir que compila e que o lint passa**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: sem erros. Se o `tsc` reclamar que `conv` não existe no escopo do
`confirm()`, use o mesmo hook do store que o componente já consome (o objeto
devolvido por `useConversation()`).

- [ ] **Passo 5: commit**

```bash
git add modules/nexo/lib/projeto-da-auditoria.ts modules/nexo/components/ConfirmationCard.tsx
git diff --cached --stat
git commit -m "o endereço passa a ser decidido no anexo; o disparo só lê"
```

---

### Task 8: o dossiê chega ao store

**Arquivos:**
- Modificar: `modules/nexo/components/NexoWorkspace.tsx` (perto de
  `appendMemorialIntake`, linha ~774)

**Interfaces:**
- Consome: `corrigirIdentidade` e `vincularProjeto` do store,
  `vincularProjetoDaConversa` (Task 7).
- Produz: nada para tarefas seguintes; fecha o elo que faltava.

- [ ] **Passo 1: escrever o elo**

Em `modules/nexo/components/NexoWorkspace.tsx`, acrescentar aos imports:

```tsx
import { vincularProjetoDaConversa } from "../lib/projeto-da-auditoria";
```

Dentro de `appendMemorialIntake`, logo depois do cálculo de `detail` e antes do
`start()`:

```tsx
    /*
     * O ELO QUE FALTAVA.
     *
     * O dossiê morria neste componente: `corrigirIdentidade` só era chamado por
     * NexoCanvas e PlanoDeGeracao — os dois fluxos de VOLUME. Numa conversa só
     * de memorial a identidade ficava `{}`, a pasta saía "" e o cartão virava
     * "Sem código no carimbo". O código de derivação estava certo o tempo todo;
     * o dado nunca chegava nele.
     */
    const lido: Record<string, string> = {};
    if (dossie?.codigo) lido.codigo = dossie.codigo;
    if (dossie?.obra) lido.obra = dossie.obra;
    if (dossie?.orgao) lido.orgao = dossie.orgao;
    if (dossie?.municipio) lido.municipio = dossie.municipio;
    if (Object.keys(lido).length > 0) conv.corrigirIdentidade(lido);

    /*
     * O VÍNCULO, em segundo plano. Não bloqueia o anexo: quem arrastou o
     * memorial vê a resposta do agente na hora, e o endereço se resolve enquanto
     * ele lê. Falhar aqui deixa a conversa "A endereçar" — que é um estado
     * legítimo com ação inline, não um erro para interromper o trabalho.
     */
    void (async () => {
      try {
        const v = await vincularProjetoDaConversa({
          codigoAtual: conv.identidade?.codigo ?? null,
          codigoLido: dossie?.codigo ?? null,
          prefeitura: dossie?.orgao ?? null,
          obra: dossie?.obra ?? null,
          municipio: dossie?.municipio ?? null,
        });

        if (v.tipo === "vinculado") conv.vincularProjeto(v.projeto.id);

        if (v.tipo === "conflito") {
          conv.appendMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              `Este memorial é do ${v.lido}, e esta conversa é do ${v.atual}. ` +
              `Não vou trocar o projeto por conta própria — os achados que já ` +
              `estão aqui iriam para a fila do outro. Abra uma conversa nova ` +
              `para o ${v.lido}, ou me diga que era para trocar mesmo.`,
          });
        }
      } catch {
        /* Silêncio proposital: a conversa fica "A endereçar", e o disparo da
         * auditoria continua cobrando a decisão como sempre cobrou. */
      }
    })();
```

- [ ] **Passo 2: conferir que compila**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: sem erros. Se `conv` tiver outro nome neste componente, use o mesmo
identificador que as demais chamadas ao store usam ali.

- [ ] **Passo 3: provar à mão, no navegador**

Reinicie o `next dev`. Anexe um memorial com centro de custo legível e, no
console do navegador:

```js
const db = await new Promise((r) => { const q = indexedDB.open("nexo"); q.onsuccess = () => r(q.result); });
const tx = db.transaction("conversations", "readonly");
const all = await new Promise((r) => { const q = tx.objectStore("conversations").getAll(); q.onsuccess = () => r(q.result); });
console.log(all.map((c) => ({ id: c.id, projectId: c.projectId, ident: c.identidade })));
```

Esperado: a conversa do memorial com `projectId` preenchido e `identidade`
trazendo `codigo`, `obra`, `orgao` e `municipio`. Se `identidade` vier mas
`projectId` não, o vínculo falhou — veja a aba Network em
`/api/projects/por-centro-de-custo`.

- [ ] **Passo 4: commit**

```bash
git add modules/nexo/components/NexoWorkspace.tsx
git diff --cached --stat
git commit -m "o dossiê do memorial finalmente chega ao store"
```

---

### Task 9: a barra passa a agrupar por projeto

**Arquivos:**
- Modificar: `modules/nexo/lib/cartoes-de-projeto.ts`
- Modificar: `scripts/test-nexo-cartoes.ts`
- Modificar: `modules/nexo/components/CartaoDeProjeto.tsx:82-87`
- Modificar: `modules/nexo/components/ListaDeProjetos.tsx` (a mensagem vazia e o
  `trabalhandoEm`)

**Interfaces:**
- Consome: `ConversaResumida.projectId`/`projectCode`/`projectClient` (Task 5).
- Produz: `CartaoDeProjeto.chave` passa a ser o `projectId` (ou o `folderKey`
  legado, ou `""`); `CartaoDeProjeto.aEnderecar: boolean`.

- [ ] **Passo 1: escrever os testes que falham**

O arquivo já tem o ajudante `c(id, pasta, updatedAt, kinds, extra)` com
`extra: Partial<ConversaResumida>`. **Dê defaults aos campos novos nele** — é
uma edição só, e todos os casos que já existem continuam compilando. No corpo do
objeto devolvido por `c`, depois de `folderKey: pasta,`:

```ts
  projectId: null,
  projectCode: "",
  projectClient: "",
```

Depois acrescentar os casos, antes da linha do total:

```ts
test("memorial COM projeto não cai no balde de sem-endereço", () => {
  /*
   * É a queixa que abriu este trabalho: memorial auditado aparecia em "Sem
   * código no carimbo" — e memorial não tem carimbo.
   */
  const r = cartoesDeProjeto([
    c("a", null, 100, [], {
      projectId: "p1",
      projectCode: "063-26",
      projectClient: "CRICIÚMA",
      tipo: "auditoria",
    }),
  ]);
  assert.equal(r[0].chave, "p1");
  assert.equal(r[0].codigo, "063-26");
  assert.equal(r[0].cliente, "CRICIÚMA");
  assert.equal(r[0].aEnderecar, false);
});

test("volume e memorial do MESMO projeto caem no MESMO cartão", () => {
  // É a razão de o vínculo existir: reunir os dois trabalhos do projeto.
  const doProjeto = { projectId: "p1", projectCode: "063-26", projectClient: "CRICIÚMA" };
  const r = cartoesDeProjeto([
    c("a", null, 200, [], { ...doProjeto, tipo: "auditoria" }),
    c("b", null, 100, ["volume"], { ...doProjeto, tipo: "volume" }),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].conversas.length, 2);
});

test("conversa sem vínculo é 'a endereçar', e vai para o FIM", () => {
  const r = cartoesDeProjeto([
    c("sem", null, 999, []),
    c("com", null, 1, [], { projectId: "p1", projectCode: "063-26" }),
  ]);
  assert.equal(r.length, 2);
  assert.equal(r[0].chave, "p1", "o projeto endereçado vem primeiro, mesmo sendo mais velho");
  assert.equal(r[1].aEnderecar, true);
});

test("conversa LEGADA com folderKey e sem projeto continua agrupando", () => {
  /*
   * Não se perde o agrupamento de quem já tinha pasta. `folderKey` deixou de
   * ser a identidade, mas continua servindo de endereço enquanto o vínculo não
   * é feito — jogar essas conversas no balde seria uma regressão.
   */
  const r = cartoesDeProjeto([c("a", "084-25-CRICIUMA", 100, ["volume"])]);
  assert.equal(r[0].chave, "084-25-CRICIUMA");
  assert.equal(r[0].codigo, "084-25");
  assert.equal(r[0].cliente, "CRICIUMA");
  assert.equal(r[0].aEnderecar, false);
});

test("o projeto vence a pasta quando os dois existem", () => {
  // O cadastro é a fonte; a string derivada é cache de exibição.
  const r = cartoesDeProjeto([
    c("a", "084-25-CRICIUMA", 100, [], {
      projectId: "p9",
      projectCode: "084-25",
      projectClient: "Criciúma",
    }),
  ]);
  assert.equal(r[0].chave, "p9");
  assert.equal(r[0].cliente, "Criciúma", "o texto do cadastro, não o da pasta");
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
npm run test:nexo:cartoes
```

Esperado: FALHA — `aEnderecar` não existe e `chave` ainda sai do `folderKey`.

- [ ] **Passo 3: implementar o agrupamento**

Em `modules/nexo/lib/cartoes-de-projeto.ts`:

Na interface `CartaoDeProjeto`, trocar o comentário de `chave` e acrescentar o
campo novo:

```ts
  /**
   * A identidade do cartão: o `projectId`, ou o `folderKey` legado, ou `""`.
   *
   * Era só o `folderKey` — uma string derivada no navegador, enquanto a home
   * agrupava por chave estrangeira. Os dois conceitos discordavam, e o sintoma
   * era todo memorial auditado caindo num balde chamado "Sem código no carimbo".
   */
  chave: string;
  /** Sem vínculo com projeto nenhum — o cartão "A endereçar". */
  aEnderecar: boolean;
```

Acrescentar, ao lado de `partes`:

```ts
/**
 * O ENDEREÇO da conversa, na ordem de autoridade.
 *
 * O projeto do Postgres vence a pasta derivada: o cadastro é a fonte, e a string
 * é cache de exibição. O `folderKey` continua valendo para a conversa LEGADA que
 * tem pasta e ainda não foi vinculada — jogá-la no balde seria uma regressão.
 */
function enderecoDa(c: ConversaResumida): string {
  return (c.projectId ?? "").trim() || (c.folderKey ?? "").trim();
}
```

Trocar o laço de agrupamento (`const chave = (c.folderKey ?? "").trim();`) por:

```ts
    const chave = enderecoDa(c);
```

Dentro do laço que monta cada cartão, trocar
`const { codigo, cliente } = partes(chave);` por:

```ts
    /*
     * O código e o cliente saem do PROJETO quando há vínculo; da pasta quando é
     * conversa legada. É a mesma ordem de autoridade de `enderecoDa`.
     */
    const comProjeto = ordenado.find((c) => c.projectId);
    const { codigo, cliente } = comProjeto
      ? { codigo: comProjeto.projectCode, cliente: comProjeto.projectClient }
      : partes(chave);
```

Acrescentar `aEnderecar` ao objeto empurrado em `cartoes.push({ ... })`:

```ts
      aEnderecar: chave === "",
```

E trocar a partição final:

```ts
  const enderecados = cartoes.filter((c) => !c.aEnderecar);
  const aEnderecar = cartoes.filter((c) => c.aEnderecar);
  enderecados.sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  return [...enderecados, ...aEnderecar];
```

Atualizar também o docblock de `cartoesDeProjeto`, trocando "SEM CÓDIGO NO
CARIMBO vai para o fim" por:

```
 * A ENDEREÇAR vai para o fim, sempre. É onde caem as conversas que ainda não
 * têm projeto — as mais numerosas e as menos informativas. No topo, empurrariam
 * para baixo o projeto que a pessoa reconheceria.
```

- [ ] **Passo 4: rodar e ver passar**

```bash
npm run test:nexo:cartoes
```

Esperado: todos `ok`, incluindo os cinco novos.

- [ ] **Passo 5: trocar o rótulo na tela**

Em `modules/nexo/components/CartaoDeProjeto.tsx`, substituir as linhas 82-87 por:

```tsx
  /*
   * "A ENDEREÇAR", e não "Sem código no carimbo".
   *
   * Memorial não tem carimbo — o rótulo antigo era mentira de vocabulário, e
   * dizia à pessoa que o documento dela estava errado quando o que faltava era
   * o sistema ter ligado a conversa a um projeto.
   */
  const semCodigo = cartao.aEnderecar;
  const nome = semCodigo
    ? "A endereçar"
    : cartao.cliente
      ? `${cartao.codigo} · ${cartao.cliente}`
      : cartao.codigo;
```

Em `modules/nexo/components/ListaDeProjetos.tsx`, no `useMemo` de
`trabalhandoEm`, trocar `trabalhandoEm.chave !== ""` por:

```tsx
      {trabalhandoEm && !trabalhandoEm.aEnderecar && !query.trim() ? (
```

- [ ] **Passo 6: conferir que compila e que o lint passa**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Passo 7: commit**

```bash
git add modules/nexo/lib/cartoes-de-projeto.ts scripts/test-nexo-cartoes.ts \
  modules/nexo/components/CartaoDeProjeto.tsx modules/nexo/components/ListaDeProjetos.tsx
git diff --cached --stat
git commit -m "a barra vira lista de projetos de verdade: agrupa pelo cadastro, não por string"
```

---

### Task 10: o backfill e a prova de que aparece

**Arquivos:**
- Criar: `scripts/backfill-identidade-do-projeto.mjs`
- Criar: `scripts/shot-barra-enderecada.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: tudo das tarefas anteriores.
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: escrever o backfill**

Criar `scripts/backfill-identidade-do-projeto.mjs`:

```js
// O QUE DÁ PARA APROVEITAR DO QUE JÁ EXISTE — e só isso.
//
//   node scripts/backfill-identidade-do-projeto.mjs [--aplicar]
//
// Sem `--aplicar` só relata. Duas coisas, e nenhuma delas adivinha:
//
//   1. `Project.clientKey` — derivação determinística do `client` que já existe;
//   2. `NexoConversation.projectId` — ligado APENAS quando o JSON da conversa
//      registra uma auditoria, e essa auditoria tem projeto.
//
// NADA DE CASAMENTO POR SEMELHANÇA. É o erro que lib/resolucao-de-projeto.ts
// existe para evitar: "099-26" não vira "099-25" por ser parecido. Conversa sem
// evidência fica "A endereçar", que é o estado honesto dela.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { slugDoCliente } = await import("../lib/cliente-do-projeto.ts");

const APLICAR = process.argv.includes("--aplicar");
const prisma = getPrisma();

console.log(APLICAR ? "APLICANDO\n" : "ENSAIO — nada será gravado (use --aplicar)\n");

// 1. clientKey
const projetos = await prisma.project.findMany({
  select: { id: true, code: true, client: true, clientKey: true },
});
let chaves = 0;

for (const p of projetos) {
  const chave = slugDoCliente(p.client);
  if (!chave || chave === p.clientKey) continue;
  console.log(`  ${p.code}: clientKey "${p.clientKey}" -> "${chave}"  (${p.client})`);
  chaves += 1;
  if (APLICAR) {
    await prisma.project.update({ where: { id: p.id }, data: { clientKey: chave } });
  }
}
console.log(`\nclientKey: ${chaves} projeto(s)\n`);

// 2. projectId das conversas — só com evidência.
const conversas = await prisma.nexoConversation.findMany({
  where: { projectId: null },
  select: { id: true, title: true, data: true },
});
let ligadas = 0;
let semEvidencia = 0;

for (const c of conversas) {
  const registradas = Array.isArray(c.data?.auditorias) ? c.data.auditorias : [];
  const ids = registradas.map((a) => a?.auditId).filter((x) => typeof x === "string");

  if (ids.length === 0) {
    semEvidencia += 1;
    continue;
  }

  const audit = await prisma.audit.findFirst({
    where: { id: { in: ids }, projectId: { not: null } },
    select: { projectId: true, project: { select: { code: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (!audit?.projectId) {
    semEvidencia += 1;
    continue;
  }

  console.log(`  ${c.id.slice(0, 8)} "${c.title.slice(0, 30)}" -> ${audit.project?.code}`);
  ligadas += 1;
  if (APLICAR) {
    await prisma.nexoConversation.update({
      where: { id: c.id },
      data: { projectId: audit.projectId },
    });
  }
}

console.log(`\nconversas ligadas: ${ligadas}`);
console.log(`conversas que ficam "A endereçar": ${semEvidencia}`);
```

- [ ] **Passo 2: rodar o ensaio**

```bash
node scripts/backfill-identidade-do-projeto.mjs
```

Esperado, no `nexodoc_dev`: quatro `clientKey` a preencher (`criciuma`, `criciuma`,
`icara`, `outra`), `conversas ligadas: 0` e `conversas que ficam "A endereçar": 72`.
É exatamente o que a medição do spec previu.

- [ ] **Passo 3: aplicar**

```bash
node scripts/backfill-identidade-do-projeto.mjs --aplicar
node scripts/backfill-identidade-do-projeto.mjs
```

Esperado na segunda corrida: `clientKey: 0 projeto(s)` — é idempotente.

- [ ] **Passo 4: escrever a prova de navegador**

Criar `scripts/shot-barra-enderecada.mjs`:

```js
// O CARTÃO APARECE, E APARECE ENDEREÇADO.
//
//   node scripts/shot-barra-enderecada.mjs   (== npm run prova:barra)
//
// Semeia uma conversa de memorial JÁ VINCULADA ao 063-26 e prova que a barra
// mostra "063-26 · CRICIÚMA" — e não "A endereçar" nem "Sem código no carimbo".
//
// MEDE A CAIXA CONTRA A JANELA, não só a presença no DOM: asserção de DOM passa
// verde com o painel inteiro fora da tela.
//
// SEM IA: a conversa é semeada no banco, nenhum modelo é chamado.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const CONV_ID = "qa-barra-enderecada";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul", code: "063-26" },
  select: { id: true, code: true, client: true },
});
check("o 063-26 existe", Boolean(projeto), "rode npm run seed:dev");
if (!projeto) process.exit(1);

// O mesmo ator que a prova da fila usa. Exige `NEXODOC_DEV_AUTH=true`.
const EMAIL = "victor@prosul.com";
const agora = new Date();

await prisma.nexoConversation.upsert({
  where: { id: CONV_ID },
  create: {
    id: CONV_ID,
    userEmail: EMAIL,
    title: "Memorial",
    projectId: projeto.id,
    tipo: "auditoria",
    createdAt: agora,
    updatedAt: agora,
    data: {
      id: CONV_ID,
      title: "Memorial",
      createdAt: +agora,
      updatedAt: +agora,
      messages: [],
      seloResults: [],
      results: [],
    },
  },
  update: { projectId: projeto.id, updatedAt: agora },
});

const navegador = await chromium.launch();
// `baseURL` no CONTEXTO: é o que `entrarComo` espera, e é como a prova da fila
// encena cada identidade sem reiniciar o servidor.
const contexto = await navegador.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 900 },
});
const pagina = await contexto.newPage();
await entrarComo(pagina, EMAIL);
await pagina.goto("/nexo", { waitUntil: "networkidle" });

const alvo = pagina.getByText(`${projeto.code} · ${projeto.client}`).first();
await alvo.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

check("o cartão traz código e prefeitura", await alvo.count() > 0);
check(
  "não sobrou rótulo de sem-endereço",
  (await pagina.getByText("Sem código no carimbo").count()) === 0,
);

/*
 * A CAIXA CONTRA A JANELA. Um elemento pode estar no DOM, "visível" para o
 * Playwright e ainda assim fora da tela — foi assim que uma prova anterior
 * passou verde com o painel inteiro fora do enquadramento.
 */
const caixa = await alvo.boundingBox();
const janela = pagina.viewportSize();
check(
  "o cartão está DENTRO da janela",
  Boolean(caixa) &&
    caixa.x >= 0 &&
    caixa.y >= 0 &&
    caixa.x + caixa.width <= janela.width &&
    caixa.y + caixa.height <= janela.height,
  JSON.stringify({ caixa, janela }),
);
check("o cartão tem altura de verdade", Boolean(caixa) && caixa.height > 8);

await pagina.screenshot({ path: "prova-barra-enderecada.png" });
console.log("\nprova-barra-enderecada.png");

await navegador.close();
await prisma.nexoConversation.delete({ where: { id: CONV_ID } }).catch(() => {});

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 5: rodar a prova**

Com o `next dev` reiniciado e rodando:

```bash
node scripts/shot-barra-enderecada.mjs
```

Esperado: quatro `OK`, `prova-barra-enderecada.png` gravado e `prova passou`.
Abra o PNG e confira a olho que o cartão diz `063-26 · CRICIÚMA`.

- [ ] **Passo 6: registrar os scripts**

Em `package.json`:

```json
"prova:barra": "node scripts/shot-barra-enderecada.mjs",
"backfill:identidade": "node scripts/backfill-identidade-do-projeto.mjs",
```

- [ ] **Passo 7: rodar tudo o que este trabalho tocou**

```bash
npm run test:cliente && npm run test:resolucao && npm run test:nexo:cartoes \
  && npm run test:nexo:conversa-remota && npm run prova:identidade \
  && npm run prova:barra && npm run lint && npx tsc --noEmit
```

Esperado: tudo verde. Se algo falhar, **não** siga para o commit.

- [ ] **Passo 8: commit**

```bash
git add scripts/backfill-identidade-do-projeto.mjs scripts/shot-barra-enderecada.mjs package.json
git diff --cached --stat
git commit -m "o que dá para aproveitar do passado, e a prova de que o cartão aparece endereçado"
```

- [ ] **Passo 9: aplicar em produção**

O `prova-barra-enderecada.png` **não** entra no repositório — é artefato de
corrida. Confirme que ele não foi commitado:

```bash
git status --short | grep prova-barra
```

Depois do push, aplicar a migração e o backfill em produção:

```bash
npm run db:migrate
node scripts/backfill-identidade-do-projeto.mjs           # ensaio, contra produção
node scripts/backfill-identidade-do-projeto.mjs --aplicar
```

Se a migração pendurar com `P1002`, o pooler prendeu o advisory lock: rode
`npm run db:destravar` e repita.

---

## O que este plano deixa de propósito para depois

- **A cor por prefeitura.** `clientKey` fica pronta; a escala é o sub-projeto 4,
  e `DESIGN.md:283` cobra portão (`npm run prova:tokens`) para admitir cor nova.
- **A ação inline "escolher o projeto"** no cartão "A endereçar". O estado passa a
  existir e a ter nome honesto neste plano; a tela de escolha entra junto do
  redesenho da barra, no sub-projeto 4.
- **As 69 conversas vazias.** Vão ficar visíveis em "A endereçar". É o problema de
  conversas duplicadas, já tratado antes, e não se reabre aqui.
- **`folderKey`.** Continua sendo gravado como cache de exibição. Removê-lo é um
  ciclo à parte, depois que o vínculo estiver provado em produção.
