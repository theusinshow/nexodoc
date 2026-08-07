# Fatos do selo — Plano de Implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos
> usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** parar de perguntar título de capa, título de LD e data — os três
estão no carimbo e devem ser afirmados, visíveis e editáveis.

**Arquitetura:** os slots ganham `deriveFrom` alimentado por fatos que o chamador
injeta em `SlotFacts`. `requirements.ts` e `slot-resolver.ts` continuam FOLHAS
PURAS (só `import type`) — quem importa runtime é `slot-request.ts`, que já roda
`casarPrefeituraDoCarimbo` e `sugerirNumeroDeTomos` e injeta os resultados.

**Stack:** TypeScript, Next.js (App Router), testes em node cru com
type-stripping (`node scripts/test-*.ts`), `assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-07-fatos-do-selo-design.md`

## Restrições globais

- `server/nexo/agent/requirements.ts`, `slot-resolver.ts` e todo módulo novo
  marcado PURO: **apenas `import type`**. Zero import de runtime, zero `@/`, zero
  `new Date()`, zero `Math.random()`. Valores que dependem de IO/relógio chegam
  já computados pelo chamador.
- Comentários e mensagens em **pt-BR**, seguindo o tom dos arquivos vizinhos:
  explique POR QUE, não O QUE.
- Nenhuma chamada de IA nova. A data entra na chamada de visão que já roda por
  prancha.
- `nomeiaOrgao` e `GENERICOS` (`normalize.ts`) **não podem ser afrouxados** — o
  endereço da PROSUL (Florianópolis) está impresso nas pranchas de todo projeto.
- Toda tarefa termina com commit próprio.

---

### Tarefa 1: parser da data do carimbo

Módulo puro que transforma o que está escrito no selo em mês + ano. Isolado
porque é a única peça com formatos imprevisíveis, e é onde o teste paga.

**Arquivos:**
- Criar: `server/nexo/data-do-selo.ts`
- Criar: `scripts/test-nexo-data-do-selo.ts`
- Modificar: `package.json` (script `test:nexo:data-do-selo`)

**Interfaces:**
- Consome: nada (folha pura)
- Produz: `parseDataDoSelo(texto: string | null | undefined): { mes: number; ano: number } | null`
  e `dataDominante(textos: (string | null | undefined)[]): { mes: number; ano: number; folhas: number; divergentes: number } | null`

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-nexo-data-do-selo.ts`:

```ts
/**
 * Trava o parser da DATA DO CARIMBO. Os formatos vêm dos projetos reais em
 * `docs/samples` — carimbo não tem padrão, e cada escritório escreve de um jeito.
 *
 *   node scripts/test-nexo-data-do-selo.ts   (== npm run test:nexo:data-do-selo)
 */
import assert from "node:assert/strict";

import { parseDataDoSelo, dataDominante } from "../server/nexo/data-do-selo.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exitCode = 1;
  }
}

test("mês por extenso com ano cheio", () => {
  assert.deepEqual(parseDataDoSelo("JUNHO/2026"), { mes: 6, ano: 2026 });
});

test("mês abreviado com ano de dois dígitos", () => {
  assert.deepEqual(parseDataDoSelo("JUN/26"), { mes: 6, ano: 2026 });
});

test("mês numérico", () => {
  assert.deepEqual(parseDataDoSelo("06/2026"), { mes: 6, ano: 2026 });
});

test("data completa: o dia é descartado", () => {
  assert.deepEqual(parseDataDoSelo("12/06/2026"), { mes: 6, ano: 2026 });
});

test("acento faltando (fonte CAD quebrada) ainda casa", () => {
  assert.deepEqual(parseDataDoSelo("MARCO/2026"), { mes: 3, ano: 2026 });
});

test("lixo em volta não atrapalha", () => {
  assert.deepEqual(parseDataDoSelo("DATA: AGOSTO/2026"), { mes: 8, ano: 2026 });
});

test("mês inválido devolve null", () => {
  assert.equal(parseDataDoSelo("13/2026"), null);
});

test("vazio, nulo e sem data devolvem null", () => {
  assert.equal(parseDataDoSelo(""), null);
  assert.equal(parseDataDoSelo(null), null);
  assert.equal(parseDataDoSelo("ESCALA 1:50"), null);
});

test("dominante: maioria vence e conta os divergentes", () => {
  const r = dataDominante(["JUNHO/2026", "JUNHO/2026", "JULHO/2026"]);
  assert.deepEqual(r, { mes: 6, ano: 2026, folhas: 2, divergentes: 1 });
});

test("dominante: empate NÃO é maioria", () => {
  assert.equal(dataDominante(["JUNHO/2026", "JULHO/2026"]), null);
});

test("dominante: ignora as folhas ilegíveis", () => {
  const r = dataDominante(["AGOSTO/2026", null, "ESCALA 1:50"]);
  assert.deepEqual(r, { mes: 8, ano: 2026, folhas: 1, divergentes: 0 });
});

test("dominante sem nenhuma data devolve null", () => {
  assert.equal(dataDominante([null, ""]), null);
});

console.log(`\n${passed} teste(s) ok.`);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-nexo-data-do-selo.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module ... data-do-selo.ts`).

- [ ] **Passo 3: implementar**

Criar `server/nexo/data-do-selo.ts`:

```ts
/**
 * A DATA que o carimbo traz, normalizada para mês + ano.
 *
 * Carimbo não tem padrão: os projetos reais trazem "JUNHO/2026", "JUN/26",
 * "06/2026" e "12/06/2026", e o texto chega junto com o rótulo ("DATA: ...").
 * O dia é descartado — a capa imprime mês/ano.
 *
 * Acento é opcional de propósito: o texto de algumas pranchas vem de fonte sem
 * mapa de caracteres, e "MARÇO" chega como "MARCO". Recusar aí seria descartar
 * a folha por um defeito de fonte.
 *
 * PURO: sem imports e sem relógio, para rodar em node cru
 * (`scripts/test-nexo-data-do-selo.ts`). O ano de dois dígitos vira 20NN, que é
 * o único século em que este software é usado.
 */

/** Nome do mês → número. Sem acento: o chamador normaliza antes de consultar. */
const MESES: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12,
};

/** Minúsculas sem acento — "MARÇO" e "MARCO" têm de chegar na mesma chave. */
function norm(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function anoCheio(n: number): number | null {
  if (n >= 1900 && n <= 2999) return n;
  if (n >= 0 && n <= 99) return 2000 + n;
  return null;
}

export function parseDataDoSelo(
  texto: string | null | undefined,
): { mes: number; ano: number } | null {
  const t = norm((texto ?? "").trim());
  if (!t) return null;

  // 1) Mês por extenso ou abreviado, seguido do ano em qualquer separador.
  const porNome = t.match(/([a-z]{3,9})\s*[\/\-. ]\s*(\d{2,4})/);
  if (porNome) {
    const mes = MESES[porNome[1]];
    const ano = anoCheio(Number(porNome[2]));
    if (mes && ano) return { mes, ano };
  }

  /*
   * 2) Só números. Com três grupos o primeiro é o DIA e é descartado; com dois,
   * o primeiro é o mês. Ancorar no ÚLTIMO par (mês, ano) resolve os dois casos
   * sem precisar saber de antemão quantos grupos vieram.
   */
  const porNumero = t.match(/(\d{1,2})\s*[\/\-.]\s*(\d{2,4})(?!\s*[\/\-.]\s*\d)/);
  if (porNumero) {
    const mes = Number(porNumero[1]);
    const ano = anoCheio(Number(porNumero[2]));
    if (mes >= 1 && mes <= 12 && ano) return { mes, ano };
  }

  return null;
}

/**
 * A data DOMINANTE de um conjunto de folhas.
 *
 * Uma folha com a data mal lida não pode arrastar o volume; e empate não é
 * maioria — sem vencedor, devolve null e o slot volta a ser perguntável, em vez
 * de o software escolher no cara ou coroa qual data vai na capa.
 */
export function dataDominante(
  textos: (string | null | undefined)[],
): { mes: number; ano: number; folhas: number; divergentes: number } | null {
  const contagem = new Map<string, { mes: number; ano: number; n: number }>();
  let lidas = 0;

  for (const t of textos) {
    const d = parseDataDoSelo(t);
    if (!d) continue;
    lidas++;
    const chave = `${d.ano}-${d.mes}`;
    const atual = contagem.get(chave);
    if (atual) atual.n++;
    else contagem.set(chave, { mes: d.mes, ano: d.ano, n: 1 });
  }

  let melhor: { mes: number; ano: number; n: number } | null = null;
  let empatado = false;
  for (const v of contagem.values()) {
    if (!melhor || v.n > melhor.n) {
      melhor = v;
      empatado = false;
    } else if (v.n === melhor.n) {
      empatado = true;
    }
  }

  if (!melhor || empatado) return null;
  return {
    mes: melhor.mes,
    ano: melhor.ano,
    folhas: melhor.n,
    divergentes: lidas - melhor.n,
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node scripts/test-nexo-data-do-selo.ts
```

Esperado: `12 teste(s) ok.` e saída sem `FALHOU`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, junto dos outros `test:nexo:*`:

```json
"test:nexo:data-do-selo": "node scripts/test-nexo-data-do-selo.ts",
```

- [ ] **Passo 6: commit**

```bash
git add server/nexo/data-do-selo.ts scripts/test-nexo-data-do-selo.ts package.json
git commit -m "data do selo: parser puro de mes/ano do carimbo"
```

---

### Tarefa 2: ler a data no extract-stamp e propagá-la

O campo existe no carimbo e é descartado hoje: `DATA` está na lista de rótulos
que não podem contaminar o CONTEÚDO, e nunca virou campo próprio.

**Arquivos:**
- Modificar: `app/api/ld/extract-stamp/route.ts` (tipo `StampExtraction`, `extractionSchema`, `required`, `systemPrompt`)
- Modificar: `modules/nexo/lib/selo-render.ts` (interface `StampExtraction`, `seloNaoLido`)
- Modificar: `server/nexo/build-ld-proposal.ts` (interface `SeloForLd`)

**Interfaces:**
- Consome: nada da Tarefa 1 (só carrega o texto cru adiante)
- Produz: `SeloForLd.data: string | null` — o texto do campo DATA como impresso,
  sem normalizar. Quem interpreta é `parseDataDoSelo` (Tarefa 1).

- [ ] **Passo 1: acrescentar o campo ao contrato da rota**

Em `app/api/ld/extract-stamp/route.ts`, no tipo `StampExtraction`, depois de
`tituloSecao`:

```ts
  data: string | null;
```

Em `extractionSchema.properties`, depois de `tituloSecao`:

```ts
    data: {
      type: ["string", "null"],
      description:
        "Valor do campo DATA do carimbo, exatamente como impresso (ex.: JUNHO/2026, JUN/26, 06/2026). null se não aparecer.",
    },
```

Em `extractionSchema.required`, acrescentar `"data"` antes de `"confianca"`.

- [ ] **Passo 2: pedir a data no prompt**

Em `systemPrompt`, na lista "Extraia do selo da prancha:", acrescentar a linha:

```
- DATA
```

E, depois da linha que fala do campo CONTEÚDO, acrescentar:

```
O campo DATA é a data de emissão da prancha, no carimbo. Copie como está impresso, sem reescrever. Não confunda com ESCALA nem com REVISÃO.
```

O rótulo `DATA` **continua** na lista de rótulos proibidos dentro do CONTEÚDO —
são coisas diferentes: ele não pode vazar para a descrição, mas agora tem campo
próprio.

- [ ] **Passo 3: propagar no cliente**

Em `modules/nexo/lib/selo-render.ts`, na interface `StampExtraction`, depois de
`tituloSecao`:

```ts
  data: string | null;
```

Em `seloNaoLido()`, acrescentar `data: null` junto dos demais campos nulos.

- [ ] **Passo 4: propagar no contrato do selo**

Em `server/nexo/build-ld-proposal.ts`, na interface `SeloForLd`, depois de
`tituloSecao`:

```ts
  /** Texto do campo DATA do carimbo, como impresso. Interpretado por `parseDataDoSelo`. */
  data: string | null;
```

- [ ] **Passo 5: verificar que o projeto compila**

```bash
npx tsc --noEmit
```

Esperado: sem saída (sucesso). Se algum construtor de `SeloForLd` reclamar de
propriedade faltando, acrescente `data: null` nele — é campo opcional na prática,
mas explícito no tipo para ninguém esquecer de propagá-lo.

- [ ] **Passo 6: rodar a bateria do Nexo que toca selo**

```bash
npm run test:nexo:check && npm run test:nexo:slots && npm run test:nexo:agent
```

Esperado: todos com `teste(s) ok.` e sem `FALHOU`.

- [ ] **Passo 7: commit**

```bash
git add app/api/ld/extract-stamp/route.ts modules/nexo/lib/selo-render.ts server/nexo/build-ld-proposal.ts
git commit -m "selo: ler o campo DATA do carimbo"
```

---

### Tarefa 3: os três slots deixam de perguntar

O coração da mudança. `SlotFacts` ganha os fatos já computados; os `deriveFrom`
passam a devolvê-los.

**Arquivos:**
- Modificar: `server/nexo/agent/requirements.ts` (`SlotFacts`, `mesSlot`, `anoSlot`, `tituloLdSlot`, `tituloCapaSlot`)
- Modificar: `server/nexo/agent/slot-request.ts` (montagem de `SlotFacts`)
- Modificar: `scripts/test-nexo-slots.ts` (fixtures + casos novos)

**Interfaces:**
- Consome: `dataDominante` (Tarefa 1); `SeloForLd.data` (Tarefa 2);
  `nomeNaCapa(code)` e `nomeNoDocumento(code)` de `server/nexo/disciplinas.ts`
- Produz: `SlotFacts.dataDoSelo?: { mes: number; ano: number; folhas: number; divergentes: number }`
  e `SlotFacts.titulos?: { capa: string; ld: string }`

- [ ] **Passo 1: escrever os testes que falham**

Em `scripts/test-nexo-slots.ts`, acrescentar antes do `console.log` final. Ajuste
o helper de fixture de `facts` que já existe no arquivo para aceitar os dois
campos novos (ele monta `SlotFacts`; acrescente `dataDoSelo` e `titulos` ao
`Partial` que ele espalha).

```ts
test("capa com data e título no selo não pergunta nada disso", () => {
  const f = facts({
    dataDoSelo: { mes: 8, ano: 2026, folhas: 24, divergentes: 0 },
    titulos: { capa: "PROJETO ESTRUTURAL", ld: "PROJETO DE ESTRUTURAS" },
  });
  const r = resolveSlots({
    taskKind: "capa",
    facts: f,
    slots: {} as Record<SlotId, SlotState>,
    requirements: ARTIFACT_REQUIREMENTS,
  });
  assert.equal(r.resolved.tituloCapa, "PROJETO ESTRUTURAL");
  assert.equal(r.resolved.mes, "8");
  assert.equal(r.resolved.ano, "2026");
});

test("LD deriva o título de documento, não o de capa", () => {
  const f = facts({
    titulos: { capa: "PROJETO ESTRUTURAL", ld: "PROJETO DE ESTRUTURAS" },
  });
  const r = resolveSlots({
    taskKind: "ld",
    facts: f,
    slots: {} as Record<SlotId, SlotState>,
    requirements: ARTIFACT_REQUIREMENTS,
  });
  assert.equal(r.resolved.tituloLd, "PROJETO DE ESTRUTURAS");
  assert.equal(r.pronto, true);
});

test("sem data no selo, mês e ano voltam à fila (a cicatriz do relógio)", () => {
  const f = facts({ titulos: { capa: "PROJETO ESTRUTURAL", ld: "X" } });
  const r = resolveSlots({
    taskKind: "capa",
    facts: f,
    slots: {} as Record<SlotId, SlotState>,
    requirements: ARTIFACT_REQUIREMENTS,
  });
  assert.equal(r.resolved.mes, undefined);
  assert.equal(r.resolved.ano, undefined);
});

test("o valor dito à mão vence o derivado do selo", () => {
  const f = facts({
    dataDoSelo: { mes: 8, ano: 2026, folhas: 24, divergentes: 0 },
    titulos: { capa: "PROJETO ESTRUTURAL", ld: "X" },
  });
  const r = resolveSlots({
    taskKind: "capa",
    facts: f,
    slots: { mes: { value: "3" } } as unknown as Record<SlotId, SlotState>,
    requirements: ARTIFACT_REQUIREMENTS,
  });
  assert.equal(r.resolved.mes, "3");
});
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-nexo-slots.ts
```

Esperado: os quatro casos novos falham (`resolved.tituloCapa` é `undefined`,
porque `deriveFrom` ainda devolve `null`). Os casos antigos que exigiam a
pergunta do título também vão falhar — é esperado: eles travam o comportamento
que estamos trocando. Ajuste-os no Passo 4.

- [ ] **Passo 3: acrescentar os fatos a `SlotFacts`**

Em `server/nexo/agent/requirements.ts`, dentro de `interface SlotFacts`:

```ts
  /**
   * A data que o CARIMBO traz, dominante entre as folhas — já computada pelo
   * chamador (`dataDominante`, de `data-do-selo.ts`). Ausente quando nenhuma
   * folha trouxe data legível ou quando houve EMPATE: nos dois casos o campo
   * volta a ser perguntável, em vez de a capa sair com uma data escolhida no
   * cara ou coroa.
   */
  dataDoSelo?: { mes: number; ano: number; folhas: number; divergentes: number };
  /**
   * Os títulos derivados da DISCIPLINA, já computados pelo chamador
   * (`nomeNaCapa`/`nomeNoDocumento`, de `disciplinas.ts`). Chegam injetados
   * porque este arquivo é folha pura e `disciplinas.ts` é import de runtime.
   */
  titulos?: { capa: string; ld: string };
```

- [ ] **Passo 4: ligar os `deriveFrom`**

Em `mesSlot`, trocar `deriveFrom: () => null` por:

```ts
    deriveFrom: (facts) =>
      facts.dataDoSelo ? String(facts.dataDoSelo.mes) : null,
```

Em `anoSlot`:

```ts
    deriveFrom: (facts) =>
      facts.dataDoSelo ? String(facts.dataDoSelo.ano) : null,
```

Em `tituloLdSlot`, trocar `deriveFrom: () => null` e `required: true` por:

```ts
  required: false,
  decision: false,
  perguntarSeFaltar: true,
  deriveFrom: (facts) => facts.titulos?.ld ?? null,
```

Em `tituloCapaSlot`, o mesmo com `facts.titulos?.capa`.

Atualize o comentário acima de `tituloCapaSlot`: ele hoje diz que o título é
decisão e "nunca auto-commitado". Substitua pela razão nova — o título vem do
léxico de disciplinas, é fato do projeto, e fica visível e editável no card. O
comentário antigo descreve um desenho que deixou de valer, e comentário
desatualizado é pior que nenhum.

Ajuste os casos antigos de `test-nexo-slots.ts` que exigiam a pergunta do título
para refletir o novo comportamento (derivado quando `titulos` existe, perguntável
quando não).

- [ ] **Passo 5: computar os fatos no chamador**

Em `server/nexo/agent/slot-request.ts`, acrescentar os imports de runtime (o
arquivo já os usa):

```ts
import { dataDominante } from "@/server/nexo/data-do-selo";
import { nomeNaCapa, nomeNoDocumento } from "@/server/nexo/disciplinas";
```

E, no objeto `facts`, junto de `templateMatch`:

```ts
    /*
     * A DATA e os TÍTULOS que o carimbo já respondeu.
     *
     * Computados aqui pelo mesmo motivo de `templateMatch`: `requirements.ts` é
     * folha pura e não pode importar runtime. O léxico de disciplinas é a fonte
     * única dos três nomes (capa, documento, tela) — derivar o título de outro
     * lugar faria a capa e a separatriz discordarem.
     */
    dataDoSelo: dataDominante(ctx.selos.map((s) => s.data)) ?? undefined,
    titulos: {
      capa: nomeNaCapa(ctx.disciplina) ?? "PROJETO",
      ld: nomeNoDocumento(ctx.disciplina) ?? "PROJETO",
    },
```

**Cuidado com o volume misto.** `PlanoDeGeracao.tsx:335` monta `tituloSugerido`
a partir dos BLOCOS — uma linha de `nomeNaCapa` por disciplina, juntas por `\n`
—, porque uma capa de volume misto lista as disciplinas todas. A derivação
acima usa uma disciplina só.

Isso não cria duas verdades porque as duas coincidem no caso de uma disciplina, e
no misto o card continua mandando: o `derivados.TITULO_CAPA` do frame vence o
fantasma do slot na hora de imprimir. **Não "corrija" isso duplicando a lógica de
blocos aqui** — o dia em que a regra do misto mudar, ela tem de mudar num lugar
só. Se o misto passar a sair errado, a correção é o slot deixar de derivar quando
`ctx.disciplina` estiver vazio (o caso do misto), não reimplementar a junção.

- [ ] **Passo 6: rodar os testes**

```bash
node scripts/test-nexo-slots.ts && npx tsc --noEmit
```

Esperado: `test-nexo-slots.ts` com todos ok, `tsc` sem saída.

- [ ] **Passo 7: rodar a bateria vizinha**

```bash
npm run test:nexo:agent && npm run test:nexo:decisoes && npm run test:nexo:disciplinas
```

Esperado: todos ok. Se `test:nexo:agent` falhar por proposta sem título, é sinal
de que o agente contava com o slot obrigatório — ajuste o fixture, não o slot.

- [ ] **Passo 8: commit**

```bash
git add server/nexo/agent/requirements.ts server/nexo/agent/slot-request.ts scripts/test-nexo-slots.ts
git commit -m "slots: titulo e data viram fato derivado do selo"
```

---

### Tarefa 4: marcar a divergência no card

**O card já afirma e já deixa editável.** `FrameDoDocumento` desenha o modelo ODT
e recebe `derivados` como texto FANTASMA nos campos editáveis
(`PlanoDeGeracao.tsx:558-577`): `TITULO_CAPA` já vem de `tituloSugerido`, que já
usa `nomeNaCapa`; `MES_ANO` já vem de `dataDaCapa`. Não há componente novo a
criar — o desenho "afirmar e deixar visível" já está construído, e com as
Tarefas 1-3 ele passa a ser alimentado pelo selo em vez de ficar vazio.

Falta uma só coisa: **dizer quando as folhas discordam**. Sem isso, a folha
intrusa entra no valor dominante sem ninguém ver.

**Arquivos:**
- Modificar: `modules/nexo/components/PlanoDeGeracao.tsx` (~linha 345, `dataDaCapa`)

**Interfaces:**
- Consome: `dataDominante` (Tarefa 1) sobre `selos`, que o componente já tem em escopo
- Produz: nenhuma interface nova

- [ ] **Passo 1: marcar a data divergente no fantasma**

Em `modules/nexo/components/PlanoDeGeracao.tsx`, importar `dataDominante`:

```ts
import { dataDominante } from "@/server/nexo/data-do-selo";
```

E, na IIFE de `dataDaCapa` (~linha 345), acrescentar a marca no fim — o valor não
muda, só ganha o aviso:

```ts
  const divergenciaDaData = dataDominante(selos.map((s) => s.data))?.divergentes ?? 0;
  const dataDaCapa = (() => {
    const mes = capa?.mes?.trim();
    const ano = capa?.ano?.trim();
    if (!mes && !ano) return "";
    const n = Number(mes);
    const nome = Number.isFinite(n) && n >= 1 && n <= 12 ? MESES_PT[n - 1] : mes;
    const base = [nome, ano].filter(Boolean).join("/");
    /*
     * A folha que discorda aparece AQUI, no fantasma do campo, e não num painel
     * à parte: é neste texto que a data vai sair impressa, e é onde quem confere
     * já está olhando. Sem a marca, a folha intrusa entra no valor dominante sem
     * ninguém ver — que é o custo de afirmar em vez de perguntar.
     */
    return divergenciaDaData > 0
      ? `${base} · ${divergenciaDaData} folha(s) com outra data`
      : base;
  })();
```

- [ ] **Passo 2: verificar que compila e o lint passa**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: `tsc` sem saída; lint sem erro.

- [ ] **Passo 3: provar no navegador**

Suba o app, abra o Nexo, anexe as pranchas de `docs/samples/084-25` e vá até o
card de geração.

Esperado, tudo ao mesmo tempo:
- a conversa **não** pergunta título de capa, título de LD nem data;
- o frame do documento mostra o título e a data vindos do selo, como texto
  fantasma nos campos;
- digitar por cima de qualquer um deles continua funcionando e vence o derivado.

Meça a caixa do card contra a janela, não apenas a presença no DOM — asserção de
DOM passa verde com o painel fora da tela.

- [ ] **Passo 4: commit**

```bash
git add modules/nexo/components/PlanoDeGeracao.tsx
git commit -m "card: avisar quando as folhas discordam da data"
```

---

## Verificação final

- [ ] Bateria completa do Nexo:

```bash
npm run test:nexo:data-do-selo && npm run test:nexo:slots && npm run test:nexo:check && npm run test:nexo:agent && npm run test:nexo:disciplinas
```

- [ ] Fluxo real de ponta a ponta com um projeto de `docs/samples`: anexar,
  ler os selos, chegar ao card. As três perguntas não aparecem; o bloco de fatos
  aparece; editar um fato muda o documento gerado.

- [ ] **Diagnóstico da prefeitura** (Peça 2 do spec — nenhuma mudança de código):
  se o slot `templateId` ainda for perguntado, verificar qual dos três casos
  ocorreu — `cliente` ausente em todas as folhas, `plausibleCount === 0`, ou
  `plausibleCount > 1`. Os três são comportamento correto; o que interessa é
  saber qual acontece com os projetos reais deste escritório.
