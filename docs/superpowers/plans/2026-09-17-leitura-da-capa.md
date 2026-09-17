# Leitura da capa do memorial — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A página 1 (capa) do memorial passa a ser a fonte padrão de obra, prefeitura, secretaria, município, bairro, código e mês/ano, em todo modelo de prefeitura.

**Architecture:** Um leitor puro (`lib/leitura-da-capa.ts`) classifica cada linha da página 1 por papel e devolve os campos. `lib/audit-classify.ts` aplica a precedência (capa primeiro, cadeia antiga como fallback). `server/nexo/classify-documents.ts` leva os campos ao dossiê, e `NexoWorkspace.tsx` à mensagem do chat e à identidade da conversa.

**Tech Stack:** TypeScript, Next.js, pdfjs (extração), testes em node cru (`node scripts/test-*.ts`), jszip (só no teste dos modelos).

Spec: `docs/superpowers/specs/2026-09-17-leitura-da-capa-design.md` (com a seção Emendas).

## Global Constraints

- Nenhuma chamada de IA. Tudo determinístico.
- `lib/leitura-da-capa.ts` é PURO e sem imports `@/`: roda com `node scripts/test-leitura-da-capa.ts`.
- Campo ausente é `""`, nunca chute. Página 1 que não é capa → `null`.
- Órgão sai sempre como `PREFEITURA MUNICIPAL DE <CIDADE>` em maiúsculas.
- Obra, secretaria e bairro saem como impressos (sem `titleCase`); bairro com o prefixo `BAIRRO`.
- Código: o nome do arquivo manda; o da capa só entra sem código no nome; divergência vira sinal `código da capa (X) diverge do nome do arquivo (Y)`.
- Commits direto na main, com `git diff --cached --stat` antes; mensagem termina com `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- A bateria de puros exige `DATABASE_URL_BATERIA`, ausente nesta máquina: rodar os testes tocados um a um.

## Mapa de arquivos

| arquivo | papel |
|---|---|
| `lib/leitura-da-capa.ts` (novo) | `lerCapa`, `divergenciaDeCodigo` |
| `scripts/test-leitura-da-capa.ts` (novo) | páginas 1 reais + divergência |
| `scripts/test-capa-dos-modelos.ts` (novo) | cada `templates/capas/*/modelo*.odt` preenchido → `lerCapa` |
| `scripts/medir-identidade-do-memorial.mjs` (novo) | acervo antes × depois |
| `lib/nome-da-obra.ts` | sai o degrau `daCapa` |
| `scripts/test-nome-da-obra.ts` | saem os testes do degrau |
| `lib/audit-classify.ts` | precedência + campos novos + sinais |
| `server/nexo/classify-documents.ts` | campos novos no arquivo e no dossiê, divergência de código |
| `modules/nexo/types.ts` | tipos dos campos novos |
| `modules/nexo/components/NexoWorkspace.tsx` | mensagem do chat + identidade |
| `package.json` | scripts `test:leitura-da-capa`, `test:capa-dos-modelos`, `medir:identidade` |

---

### Task 1: O leitor da capa

**Files:**
- Create: `lib/leitura-da-capa.ts`
- Create: `scripts/test-leitura-da-capa.ts`
- Modify: `package.json` (bloco `scripts`, ao lado de `test:nome-da-obra`)

**Interfaces:**
- Produces: `interface LeituraDaCapa { orgao; secretaria; municipio; obra; bairro; mesAno; codigo: string }`, `lerCapa(texto: string, candidatosDeMunicipio?: readonly string[]): LeituraDaCapa | null`, `divergenciaDeCodigo(doArquivo: string, daCapa: string): string | null`.

- [ ] **Step 1: Escrever o teste que falha** — `scripts/test-leitura-da-capa.ts`

```ts
/**
 * A CAPA DO MEMORIAL, lida sem IA. Os textos abaixo são a página 1 REAL de cada
 * memorial, como `extractPdfText` a entrega (17/09/2026).
 *
 *   node scripts/test-leitura-da-capa.ts   (== npm run test:leitura-da-capa)
 */
import assert from "node:assert/strict";

import { divergenciaDeCodigo, lerCapa } from "../lib/leitura-da-capa.ts";

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

const pagina = (p1: string) => `--- PAGINA 1 ---\n${p1}\n\n--- PAGINA 2 ---\nSumário\n`;

test("027_24 São José: nome em 3 linhas, secretaria separada, mês sem barra", () => {
  const capa = lerCapa(
    pagina(
      "PREFEITURA MUNICIPAL DE SÃO JOSÉ\nSECRETARIA MUNICIPAL DE INFRAESTRUTURA\nBEIRA MAR DE SÃO JOSÉ - BARREIROS\nURBANIZAÇÃO DA ORLA - PARQUE,\nRESTAURANTE E LANCHONETE\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nOUTUBRO 2025\n027-24\n",
    ),
  );
  assert.deepEqual(capa, {
    orgao: "PREFEITURA MUNICIPAL DE SÃO JOSÉ",
    secretaria: "SECRETARIA MUNICIPAL DE INFRAESTRUTURA",
    municipio: "SÃO JOSÉ",
    obra: "BEIRA MAR DE SÃO JOSÉ - BARREIROS URBANIZAÇÃO DA ORLA - PARQUE, RESTAURANTE E LANCHONETE",
    bairro: "",
    mesAno: "OUTUBRO 2025",
    codigo: "027-24",
  });
});

test("040_26 Chapecó: código com sublinhado sai com hífen", () => {
  const capa = lerCapa(
    pagina(
      "PREFEITURA MUNICIPAL DE CHAPECÓ\nSECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO\nREVITALIZAÇÃO DA FEIRA MUNICIPAL\nDE CHAPECÓ\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nJUNHO/2024\n040_26\n",
    ),
  );
  assert.equal(capa?.obra, "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ");
  assert.equal(capa?.secretaria, "SECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO");
  assert.equal(capa?.municipio, "CHAPECÓ");
  assert.equal(capa?.mesAno, "JUNHO/2024");
  assert.equal(capa?.codigo, "040-26");
});

test("113_22 Navegantes: prefeitura sem modelo cadastrado também é lida", () => {
  const capa = lerCapa(
    pagina(
      "PREFEITURA MUNICIPAL DE NAVEGANTES\nSECRETARIA MUNICIPAL DE PLANEJAMENTO URBANO\nHOSPITAL MUNICIPAL NOSSA SENHORA\nDOS NAVEGANTES\nPROJETO EXECUTIVO\nMEMORIAL DESCRITIVO\nVol. I\nMAIO/2023\n113-22\n",
    ),
  );
  assert.equal(capa?.orgao, "PREFEITURA MUNICIPAL DE NAVEGANTES");
  assert.equal(capa?.obra, "HOSPITAL MUNICIPAL NOSSA SENHORA DOS NAVEGANTES");
});

const CRICIUMA_116 =
  "E S T A D O D E S A N T A C A T A R I N A\nG O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nUBS RENASCER - PORTE 2\nBAIRRO SÃO JOÃO\nVOLUME 1 – MEMORIAL DESCRITIVO\n116-25\nOUTUBRO/2025\n- Projetos, Supervisão e Planejamento Ltda\n";

test("116_25 Criciúma: timbre espaçado ganha a grafia do candidato", () => {
  assert.deepEqual(lerCapa(pagina(CRICIUMA_116), ["", "Criciúma"]), {
    orgao: "PREFEITURA MUNICIPAL DE CRICIÚMA",
    secretaria: "",
    municipio: "Criciúma",
    obra: "UBS RENASCER - PORTE 2",
    bairro: "BAIRRO SÃO JOÃO",
    mesAno: "OUTUBRO/2025",
    codigo: "116-25",
  });
});

test("timbre espaçado sem candidato que case: município e órgão vazios, obra lida", () => {
  const capa = lerCapa(pagina(CRICIUMA_116), ["Içara"]);
  assert.equal(capa?.municipio, "");
  assert.equal(capa?.orgao, "");
  assert.equal(capa?.obra, "UBS RENASCER - PORTE 2");
});

test("116_25 terraplenagem: o nome termina no bairro, subtítulos não entram", () => {
  const capa = lerCapa(
    pagina(
      "E S T A D O D E S A N T A C A T A R I N A\nG O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nUBS RENASCER - PORTE 2\nBAIRRO SÃO JOÃO\nTERRAPLENAGEM / DESENHO GEOMÉTRICO\nPROJETO DE PAVIMENTAÇÃO\nMEMORIAL DESCRITIVO E PROJETOS\n116-25\nOUTUBRO/2025\n- Projetos, Supervisão e Planejamento Ltda\n",
    ),
    ["Criciúma"],
  );
  assert.equal(capa?.obra, "UBS RENASCER - PORTE 2");
  assert.equal(capa?.bairro, "BAIRRO SÃO JOÃO");
});

test("156_25: sem bairro, MARÇO com cedilha", () => {
  const capa = lerCapa(
    pagina(
      "E S T A D O D E S A N T A C A T A R I N A\nG O V E R N O D O M U N I C Í P I O D E C R I C I Ú M A\nNOVA SEDE DA DEFESA CIVIL\nVOLUME 1 – MEMORIAL DESCRITIVO\n156-25\nMARÇO/2026\n- Projetos, Supervisão e Planejamento Ltda\n",
    ),
    ["Criciúma"],
  );
  assert.equal(capa?.obra, "NOVA SEDE DA DEFESA CIVIL");
  assert.equal(capa?.bairro, "");
  assert.equal(capa?.mesAno, "MARÇO/2026");
});

test("kit de erros plantados (capa achatada) não é lido: null, e o fallback decide", () => {
  const kit =
    "E S T A D O D E S A N T A C A T A R I N A G O V E R N O D O M U N I C Í P I\nO D E C R I C I Ú M A UBS RENASCER - PORTE 2 BAIRRO SÃO JOÃO\nVOLUME 1 - MEMORIAL DESCRITIVO 116-25 OUTUBRO/2025 - Projetos,\nSupervisão e Planejamento Ltda\n";
  assert.equal(lerCapa(pagina(kit), ["Criciúma"]), null);
  assert.equal(
    lerCapa(pagina("ESTADO DE SANTA CATARINA PREFEITURA MUNICIPAL DE CRICIUMA\nSECRETARIA MUNICIPAL DE SAUDE UBS RENASCER - PORTE 2\nVOLUME 1 - MEMORIAL DESCRITIVO 116-25 OUTUBRO/2025\n")),
    null,
  );
});

test("página 1 que é sumário não é capa", () => {
  assert.equal(lerCapa(pagina("Sumário\n1 APRESENTAÇÃO........ 12\n")), null);
});

test("timbre sem âncora de fim não é capa", () => {
  assert.equal(lerCapa(pagina("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nALGUMA COISA\nOUTRA COISA\n")), null);
});

test("sem o marcador de página não há página 1: null", () => {
  assert.equal(lerCapa("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nOBRA\nPROJETO EXECUTIVO"), null);
});

test("só a página 1 conta: capa na página 2 é ignorada", () => {
  const texto =
    "--- PAGINA 1 ---\n116-25\n\n--- PAGINA 2 ---\nPREFEITURA MUNICIPAL DE SÃO JOSÉ\nOBRA QUALQUER\nPROJETO EXECUTIVO\n";
  assert.equal(lerCapa(texto), null);
});

test("nome com mais de 4 linhas não é nome: obra vazia, o resto vale", () => {
  const capa = lerCapa(pagina("PREFEITURA MUNICIPAL DE SÃO JOSÉ\nA1\nA2\nA3\nA4\nA5\nPROJETO EXECUTIVO\n027-24\n"));
  assert.equal(capa?.obra, "");
  assert.equal(capa?.codigo, "027-24");
});

test("divergência de código: iguais com _ ou - não divergem", () => {
  assert.equal(divergenciaDeCodigo("027_24", "027-24"), null);
  assert.equal(divergenciaDeCodigo("", "027-24"), null);
  assert.equal(divergenciaDeCodigo("027-24", ""), null);
});

test("divergência de código: diferentes viram o sinal", () => {
  assert.equal(
    divergenciaDeCodigo("116-25", "117-25"),
    "código da capa (117-25) diverge do nome do arquivo (116-25)",
  );
});

console.log(`\n${passed} teste(s) de leitura da capa OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-leitura-da-capa.ts`
Expected: `ERR_MODULE_NOT_FOUND` para `lib/leitura-da-capa.ts`.

- [ ] **Step 3: Implementar** — `lib/leitura-da-capa.ts`

```ts
/**
 * A CAPA DO MEMORIAL — a fonte padrão da identidade da obra.
 *
 * 17/09/2026. O memorial de São José (027_24) chegou ao chat com a obra
 * "• Diário de Obra em dia": o rodapé não casou e a busca do campo "Obra:"
 * pegou prosa da página 40. A decisão foi ler a CAPA primeiro, em todo modelo
 * de prefeitura, e deixar rodapé e corpo como fallback. Ver
 * `docs/superpowers/specs/2026-09-17-leitura-da-capa-design.md`.
 *
 * Reconhece cada linha da página 1 pelo PAPEL (timbre, secretaria, fase,
 * título, bairro, data, código…); o que sobra entre o timbre e o primeiro
 * papel reconhecido é o nome da obra. Não depende de qual modelo gerou a capa:
 * os modelos de `templates/capas` são conferidos em `test-capa-dos-modelos.ts`.
 *
 * PURO e sem `@/`: prova em node cru, sem PDF.
 */

export interface LeituraDaCapa {
  /**
   * SEMPRE `PREFEITURA MUNICIPAL DE <CIDADE>`, mesmo quando a capa diz
   * "GOVERNO DO MUNICÍPIO DE". A marca da prefeitura, a pasta da conversa e o
   * `defaults.orgao` dos modelos usam esta forma; guardar a impressa apagaria
   * a cor da marca de Criciúma.
   */
  orgao: string;
  secretaria: string;
  /** A cidade como impressa, ou com a grafia do candidato no timbre espaçado. */
  municipio: string;
  /** Como impresso, sem mexer na caixa: é o que vai para `{{NOME_OBRA}}`. */
  obra: string;
  /** Com o prefixo ("BAIRRO SÃO JOÃO"): o modelo de Criciúma imprime `{{BAIRRO}}` sozinho. */
  bairro: string;
  mesAno: string;
  /** Com hífen: "027-24". */
  codigo: string;
}

type Papel =
  | "estado"
  | "timbre"
  | "secretaria"
  | "fase"
  | "titulo"
  | "volume"
  | "bairro"
  | "mesAno"
  | "codigo"
  | "escritorio"
  | "livre";

/** Sem acento, maiúsculo e sem espaço: a forma em que o timbre espaçado é comparável. */
function chave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

function espacos(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

const TIMBRE = /^(?:PREFEITURAMUNICIPALDE|GOVERNODOMUNICIPIODE)/;
const MES_ANO = /^(?:JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\/?\d{4}$/;
const ANCORAS_DE_FIM: readonly Papel[] = ["fase", "titulo", "volume"];

/**
 * "E S T A D O D E …" → "ESTADODE…". A extração entrega a capa de Criciúma com
 * as letras espaçadas; quatro pedaços de um caractere é o mínimo para não colar
 * uma linha curta de verdade ("Vol. I").
 */
function colarLetras(linha: string): { texto: string; espacada: boolean } {
  const partes = linha.trim().split(/\s+/);
  const espacada = partes.length >= 4 && partes.every((p) => [...p].length === 1);
  return { texto: espacada ? partes.join("") : espacos(linha), espacada };
}

function papelDaLinha(texto: string): Papel {
  const k = chave(texto);
  if (k === "ESTADODESANTACATARINA") return "estado";
  if (TIMBRE.test(k)) return "timbre";
  if (k.startsWith("SECRETARIA")) return "secretaria";
  if (/^(?:PROJETO(?:EXECUTIVO|BASICO)|ANTEPROJETO|ESTUDOPRELIMINAR)$/.test(k)) return "fase";
  if (k.startsWith("MEMORIALDESCRITIVO") || /^VOLUME\d+[-–]/.test(k)) return "titulo";
  if (/^VOL\.[IVXLC\d]+$/.test(k)) return "volume";
  if (k.startsWith("BAIRRO")) return "bairro";
  if (MES_ANO.test(k)) return "mesAno";
  if (/^\d{2,4}[-_]\d{2}$/.test(k)) return "codigo";
  if (k.includes("PROJETOS,SUPERVISAOEPLANEJAMENTO")) return "escritorio";
  return "livre";
}

/**
 * A cidade do timbre. Na linha normal, o que vem depois de "…DE", até um
 * travessão ou pontuação. Na espaçada as fronteiras das palavras sumiram
 * ("SÃOJOSÉ"), então só vale um candidato do próprio documento que, colado,
 * seja igual ao resto do timbre.
 */
function cidadeDoTimbre(
  texto: string,
  espacada: boolean,
  candidatos: readonly string[],
): string {
  if (espacada) {
    const resto = chave(texto).replace(TIMBRE, "");
    return candidatos.find((c) => c.trim() && chave(c) === resto)?.trim() ?? "";
  }
  const bruta =
    /^(?:PREFEITURA\s+MUNICIPAL\s+DE|GOVERNO\s+DO\s+MUNIC[IÍií]PIO\s+DE)\s+(.+)$/i.exec(texto)?.[1] ?? "";
  const corte = /\s[–-]\s|[.,;/(]/.exec(bruta);
  return espacos(corte ? bruta.slice(0, corte.index) : bruta);
}

export function lerCapa(
  texto: string,
  candidatosDeMunicipio: readonly string[] = [],
): LeituraDaCapa | null {
  const pagina1 = /--- PAGINA 1 ---\n([\s\S]*?)(?=\n--- PAGINA 2 ---|$)/.exec(texto)?.[1];
  if (pagina1 === undefined) return null;

  const linhas = pagina1
    .split("\n")
    .map(colarLetras)
    .filter((l) => l.texto);
  const papeis = linhas.map((l) => papelDaLinha(l.texto));

  const iTimbre = papeis.indexOf("timbre");
  if (iTimbre === -1) return null;
  const iFim = papeis.findIndex((p, i) => i > iTimbre && ANCORAS_DE_FIM.includes(p));
  if (iFim === -1) return null;

  let i = iTimbre + 1;
  const secretarias: string[] = [];
  while (i < iFim && papeis[i] === "secretaria") secretarias.push(linhas[i++].texto);
  const nome: string[] = [];
  while (i < iFim && papeis[i] === "livre") nome.push(linhas[i++].texto);

  const junto = espacos(nome.join(" "));
  const obra = nome.length <= 4 && junto.length >= 4 && junto.length <= 160 ? junto : "";

  const primeira = (papel: Papel) =>
    linhas.find((_, j) => j > iTimbre && papeis[j] === papel)?.texto ?? "";
  const cidade = cidadeDoTimbre(
    linhas[iTimbre].texto,
    linhas[iTimbre].espacada,
    candidatosDeMunicipio,
  );

  return {
    orgao: cidade ? `PREFEITURA MUNICIPAL DE ${cidade.toLocaleUpperCase("pt-BR")}` : "",
    secretaria: secretarias[0] ?? "",
    municipio: cidade,
    obra,
    bairro: primeira("bairro"),
    mesAno: primeira("mesAno"),
    codigo: primeira("codigo").replace("_", "-"),
  };
}

/**
 * O código do nome do arquivo manda (é a chave do projeto no sistema); o da
 * capa só confere. Devolve o SINAL quando os dois existem e divergem.
 */
export function divergenciaDeCodigo(doArquivo: string, daCapa: string): string | null {
  const a = doArquivo.trim().replace("_", "-");
  const c = daCapa.trim().replace("_", "-");
  if (!a || !c || a === c) return null;
  return `código da capa (${c}) diverge do nome do arquivo (${a})`;
}
```

Nota: o intervalo `[̀-ͯ]` é o bloco de acentos combinantes (U+0300–U+036F), escrito como em `lib/audit-classify.ts`.

- [ ] **Step 4: Registrar e rodar**

Em `package.json`, depois de `"test:nome-da-obra"`:
```json
    "test:leitura-da-capa": "node scripts/test-leitura-da-capa.ts",
```
Run: `npm run -s test:leitura-da-capa`
Expected: `15 teste(s) de leitura da capa OK`, nenhum `FALHOU`.

- [ ] **Step 5: Commit**

```bash
git add lib/leitura-da-capa.ts scripts/test-leitura-da-capa.ts package.json
git diff --cached --stat
git commit -m "leitor da capa do memorial: cada linha da pagina 1 pelo papel, sem ia"
```

---

### Task 2: Os modelos de capa como teste obrigatório

**Files:**
- Create: `scripts/test-capa-dos-modelos.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `lerCapa` (Task 1).

- [ ] **Step 1: Escrever o teste** — `scripts/test-capa-dos-modelos.ts`

```ts
/**
 * TODO MODELO DE CAPA DO SOFTWARE TEM DE SER LIDO PELO LEITOR.
 *
 * Para cada `templates/capas/<id>/modelo*.odt`: tira as linhas do `content.xml`,
 * preenche cada `{{CAMPO}}` com um valor de exemplo, passa por `lerCapa` e exige
 * os mesmos valores de volta. Um modelo novo que o leitor não entenda derruba
 * este teste — é assim que "todos os padrões de prefeitura" continua valendo.
 *
 *   node scripts/test-capa-dos-modelos.ts   (== npm run test:capa-dos-modelos)
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import JSZip from "jszip";

import { lerCapa } from "../lib/leitura-da-capa.ts";

const RAIZ = "templates/capas";
const chave = (v: string) =>
  v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, "");

interface Config {
  id: string;
  nome: string;
  volumeFormat: string;
  defaults: { orgao: string; secretaria: string; fase: string };
  campos: string[];
}

function linhasDoOdt(xml: string): string[] {
  return xml
    .replace(/<text:line-break\/>/g, "\n")
    .replace(/<text:(?:tab|s)(?:\s[^>]*)?\/>/g, " ")
    .replace(/<\/text:(?:p|h)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .split("\n");
}

let passed = 0;
const ids = readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name);
assert.ok(ids.length > 0, "nenhum modelo em templates/capas");

for (const id of ids) {
  const config = JSON.parse(readFileSync(join(RAIZ, id, "config.json"), "utf8")) as Config;
  const odt = readdirSync(join(RAIZ, id)).find((f) => f.endsWith(".odt"));
  assert.ok(odt, `${id}: sem .odt`);
  const zip = await JSZip.loadAsync(readFileSync(join(RAIZ, id, odt)));
  const xml = await zip.file("content.xml")!.async("string");

  const valores: Record<string, string> = {
    ORGAO: config.defaults.orgao,
    SECRETARIA: config.defaults.secretaria,
    FASE: config.defaults.fase,
    NOME_OBRA: "OBRA DE PROVA DO MODELO",
    BAIRRO: "BAIRRO CENTRO",
    TITULO_CAPA: "MEMORIAL DESCRITIVO",
    TOMO: "",
    VOLUME: config.volumeFormat === "numeric" ? "1" : "I",
    MES_ANO: "SETEMBRO/2026",
    CODIGO_EXIBIDO: "999-26",
  };
  const linhas = linhasDoOdt(xml)
    .map((l) => l.replace(/\{\{(\w+)\}\}/g, (_, c: string) => valores[c] ?? ""))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l, i, todas) => l && l !== todas[i - 1]);
  const texto = `--- PAGINA 1 ---\n${linhas.join("\n")}\n\n--- PAGINA 2 ---\n`;

  const cidade = config.nome.replace(/^Prefeitura Municipal de /i, "");
  const capa = lerCapa(texto, [cidade]);
  try {
    assert.ok(capa, "o leitor não reconheceu a capa");
    assert.equal(capa.obra, "OBRA DE PROVA DO MODELO");
    assert.equal(chave(capa.municipio), chave(cidade));
    assert.equal(chave(capa.orgao), chave(`PREFEITURA MUNICIPAL DE ${cidade}`));
    assert.equal(capa.codigo, "999-26");
    assert.equal(capa.mesAno, "SETEMBRO/2026");
    if (config.campos.includes("BAIRRO")) assert.equal(capa.bairro, "BAIRRO CENTRO");
    if (config.campos.includes("SECRETARIA")) {
      assert.equal(capa.secretaria, config.defaults.secretaria);
    }
    passed++;
    console.log(`  ok  ${id}`);
  } catch (err) {
    console.error(`FALHOU  ${id}`);
    console.error(err instanceof Error ? err.message : err);
    console.error(texto);
    process.exitCode = 1;
  }
}

console.log(`\n${passed} de ${ids.length} modelo(s) de capa lidos`);
```

- [ ] **Step 2: Registrar e rodar**

`package.json`: `"test:capa-dos-modelos": "node scripts/test-capa-dos-modelos.ts",`
Run: `npm run -s test:capa-dos-modelos`
Expected: `4 de 4 modelo(s) de capa lidos` (pmcriciuma, prefchap, prefflor, prefsjose). Se um modelo falhar, o texto impresso mostra a linha que o leitor não reconheceu: ajustar o reconhecedor em `lib/leitura-da-capa.ts`, rodar de novo **também** `npm run -s test:leitura-da-capa`.

- [ ] **Step 3: Commit**

```bash
git add scripts/test-capa-dos-modelos.ts package.json lib/leitura-da-capa.ts
git diff --cached --stat
git commit -m "os modelos de capa do software viram teste obrigatorio do leitor"
```

---

### Task 3: Medidor do acervo, linha de base ANTES da integração

**Files:**
- Create: `scripts/medir-identidade-do-memorial.mjs`
- Modify: `package.json`

- [ ] **Step 1: Escrever** — `scripts/medir-identidade-do-memorial.mjs`

```js
// A IDENTIDADE DE CADA MEMORIAL DO ACERVO, antes e depois de mexer no leitor.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/medir-identidade-do-memorial.mjs \
//     [--salvar antes.json] [--comparar antes.json] [pdf extra ...]
//   (== npm run medir:identidade -- ...)
//
// Sem IA. Lê `docs/samples/**/1_memorial`, `docs/samples/116-25/ter_pav` e o kit
// de erros plantados, mais os PDFs passados por argumento. Toda mudança de campo
// é listada: uma mudança que ninguém esperava é investigada antes de subir.
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename, join } from "node:path";

const { extractPdfText } = await import("../lib/pdf-text.ts");
const { classifyDocument } = await import("../lib/audit-classify.ts");

const CAMPOS = ["obra", "orgao", "secretaria", "municipio", "bairro", "mesAno", "codigo"];
const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i === -1 ? null : args.splice(i, 2)[1];
};
const salvar = opcao("--salvar");
const comparar = opcao("--comparar");

const arquivos = [];
for (const projeto of readdirSync("docs/samples", { withFileTypes: true })) {
  if (!projeto.isDirectory()) continue;
  for (const sub of ["1_memorial", "ter_pav"]) {
    const dir = join("docs/samples", projeto.name, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith(".pdf") && !/assinado/i.test(f)) arquivos.push(join(dir, f));
  }
}
const kit = "docs/samples/_auditoria-teste";
if (existsSync(kit)) for (const f of readdirSync(kit)) if (f.endsWith(".pdf")) arquivos.push(join(kit, f));
arquivos.push(...args);

const medida = {};
for (const f of arquivos) {
  const extraido = await extractPdfText(readFileSync(f));
  if (!(extraido.pageCount > 0)) throw new Error(`nada extraído de ${f}: a medida seria vazia`);
  const doc = classifyDocument(basename(f), extraido, "memorial");
  medida[basename(f)] = Object.fromEntries(CAMPOS.map((c) => [c, doc[c] ?? ""]));
  medida[basename(f)].capaLida = Boolean(doc.capa);
}

if (salvar) writeFileSync(salvar, JSON.stringify(medida, null, 1));
if (comparar) {
  const antes = JSON.parse(readFileSync(comparar, "utf8"));
  let mudancas = 0;
  for (const [nome, depois] of Object.entries(medida)) {
    for (const campo of [...CAMPOS, "capaLida"]) {
      const a = antes[nome]?.[campo] ?? "";
      if (String(a) !== String(depois[campo])) {
        mudancas++;
        console.log(`${nome} · ${campo}\n   antes: ${JSON.stringify(a)}\n  depois: ${JSON.stringify(depois[campo])}`);
      }
    }
  }
  console.log(`\n${Object.keys(medida).length} memoriais, ${mudancas} campo(s) mudaram`);
} else {
  console.log(JSON.stringify(medida, null, 1));
}
```

- [ ] **Step 2: Registrar e tirar a linha de base**

`package.json`: `"medir:identidade": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/medir-identidade-do-memorial.mjs",`

Run (o 027_24 fica fora do repositório, no scratchpad da sessão):
```bash
npm run -s medir:identidade -- --salvar "$SCRATCH/identidade-antes.json" "$SCRATCH/027_24_md_geral_a.pdf"
```
Expected: JSON com ~17 memoriais; `secretaria`, `bairro`, `mesAno` vazios e `capaLida: false` em todos (a integração ainda não existe).

- [ ] **Step 3: Commit**

```bash
git add scripts/medir-identidade-do-memorial.mjs package.json
git diff --cached --stat
git commit -m "medidor da identidade do memorial no acervo, antes e depois"
```

---

### Task 4: Integração na classificação

**Files:**
- Modify: `lib/audit-classify.ts` (tipo `DocumentClassification`, `extractIdentity`, `classifyDocument`)
- Modify: `lib/nome-da-obra.ts` (remover `TIMBRE`, `FIM_DA_CAPA`, `daCapa`)
- Modify: `scripts/test-nome-da-obra.ts` (remover os testes do degrau)
- Modify: `modules/nexo/types.ts` (`NexoFileClassification`, `NexoDossieDraft`)
- Modify: `server/nexo/classify-documents.ts` (`ContentIdentity`, `toClassification`, `classifyDocuments`, `pickByConfidence`, `aggregate`)

**Interfaces:**
- Consumes: `lerCapa`, `divergenciaDeCodigo`, `LeituraDaCapa` (Task 1).
- Produces: `DocumentClassification` ganha `secretaria: string; bairro: string; mesAno: string; capa?: LeituraDaCapa`. `NexoFileClassification` e `NexoDossieDraft` ganham `secretaria?: string; bairro?: string; mesAno?: string; capa?: LeituraDaCapa`.

- [ ] **Step 1: `lib/nome-da-obra.ts`** — apagar `TIMBRE`, `FIM_DA_CAPA` e `daCapa` com o comentário deles, e voltar `nomeDaObra`:

```ts
/**
 * O nome da obra no CORPO do memorial, na ordem de confiança: rodapé, depois
 * campo declarado. A capa vem antes disto e mora em [[leitura-da-capa.ts]].
 * Devolve "" quando não encontra — nunca chuta, porque gabarito inventado é
 * pior que gabarito ausente: ele reprova a obra certa.
 */
export function nomeDaObra(texto: string): string {
  return doRodape(texto) || doCampoObra(texto);
}
```

Em `scripts/test-nome-da-obra.ts`, apagar `CAPA_SAO_JOSE` e os testes "o nome sai da capa…", "a capa vence um campo 'OBRA :'…", "o rodapé continua vencendo a capa…", "capa sem o timbre…" e "capa sem linha de encerramento…". Manter `PROSA_CANTEIRO` e o teste da prosa.

Run: `npm run -s test:nome-da-obra` → Expected: `11 teste(s) de nome da obra OK`.

- [ ] **Step 2: `lib/audit-classify.ts`** — imports e tipo:

```ts
import { lerCapa, type LeituraDaCapa } from "@/lib/leitura-da-capa";
```

No `DocumentClassification`, depois de `revisao: string;`:
```ts
  /** Da capa: `""` quando a capa não traz ou não foi reconhecida. */
  secretaria: string;
  /** Capa ("BAIRRO SÃO JOÃO"), senão a caracterização da obra. */
  bairro: string;
  mesAno: string;
  /** A leitura crua da página 1, quando ela é capa. Ver [[leitura-da-capa.ts]]. */
  capa?: LeituraDaCapa;
```

Trocar `extractIdentity` inteira por:
```ts
/** identidade limpa para o cartão de confirmação (obra/código/município/órgão/revisão) */
function extractIdentity(
  source: { fileName: string; fileType: string; extracted: ExtractedPdf },
  municipioDaCaracterizacao: string,
) {
  const text = source.extracted.text;
  const fingerprint = extractIdentityFingerprint(source);
  const municipioFp = fingerprint.fields.municipio?.display ?? "";
  const municipioDoTexto =
    /Munic[ií]pio\s+de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]{2,40})/i
      .exec(text)?.[1]
      ?.trim() ?? "";

  /*
   * A CAPA PRIMEIRO (17/09/2026). Rodapé e campo "Obra:" viraram fallback: no
   * 027_24 os dois erravam e a capa dizia o nome certo na página 1. Os
   * municípios já lidos entram como CANDIDATOS de grafia para o timbre espaçado
   * de Criciúma, que perde a fronteira das palavras. Ver [[leitura-da-capa.ts]].
   *
   * O que vem da capa NÃO passa por `titleCase`: é o que o modelo imprime em
   * `{{NOME_OBRA}}`, e "UBS" viraria "Ubs".
   */
  const capa = lerCapa(text, [municipioDaCaracterizacao, municipioFp, municipioDoTexto]);

  /*
   * O corpo, quando a capa falta: rodapé primeiro, campo "Obra:" depois — ver
   * [[nome-da-obra.ts]], que guarda as duas regressões do 084_25.
   */
  const obraDoCorpo = (nomeDaObra(text) || fingerprint.fields.obra?.display || "").trim();
  const obra = capa?.obra || (obraDoCorpo ? titleCase(obraDoCorpo) : "");

  const codigo =
    capa?.codigo || (/\b\d{2,4}[_-]\d{2}\b/.exec(text)?.[0]?.replace("_", "-") ?? "");

  const municipioDaCapa = capa?.municipio ? titleCase(capa.municipio) : "";
  const municipio =
    municipioDaCapa || (municipioFp ? titleCase(municipioFp) : "") || municipioDoTexto;

  const orgao = capa?.orgao || orgaoDoTimbre(text);
  const revisao = fingerprint.fields.revisao?.display ?? "";

  return { obra, codigo, municipio, municipioDaCapa, orgao, revisao, capa };
}
```

Em `classifyDocument`, logo depois de `const precisaOcr = …`:
```ts
  /*
   * Lida ANTES da identidade, mas só EXPOSTA para memorial (lá embaixo): o
   * município dela serve de candidato de grafia para a capa em qualquer tipo,
   * e é inofensivo como candidato — só casa se for igual ao timbre.
   */
  const caracterizacaoLida = lerCaracterizacaoDaObra(text);
  const identity = extractIdentity({ fileName, fileType, extracted }, caracterizacaoLida?.municipio ?? "");
```
(e apagar a linha antiga `const identity = extractIdentity({ fileName, fileType, extracted });`).

Trocar o bloco da caracterização:
```ts
  const caracterizacao = tipo === "memorial" ? caracterizacaoLida : undefined;
  if (caracterizacao?.endereco) {
    sinais.push(`endereço lido da caracterização da obra: ${caracterizacao.endereco}`);
  }
  if (identity.capa) {
    sinais.push("dados lidos da capa (página 1)");
  } else if (tipo === "memorial") {
    sinais.push("capa não reconhecida na página 1: dados do rodapé e do corpo");
  }
```
(manter o comentário "Só no memorial…" acima dele).

No `return`, trocar `municipio: caracterizacao?.municipio || identity.municipio,` e acrescentar os campos:
```ts
    // A capa diz onde a obra é na primeira folha e vence (decisão de 17/09);
    // a caracterização vem depois, e o timbre/impressão digital por último.
    municipio: identity.municipioDaCapa || caracterizacao?.municipio || identity.municipio,
    codigo: identity.codigo,
    orgao: identity.orgao,
    revisao: identity.revisao,
    secretaria: identity.capa?.secretaria ?? "",
    bairro: identity.capa?.bairro || caracterizacao?.bairro || "",
    mesAno: identity.capa?.mesAno ?? "",
    ...(identity.capa ? { capa: identity.capa } : {}),
```

Conferir que `lerCaracterizacaoDaObra` devolve algo com `.municipio` e `.bairro` (`lib/caracterizacao-obra.ts:22`); se o tipo de retorno for `CaracterizacaoDaObra | null`, `caracterizacao` fica `CaracterizacaoDaObra | null | undefined` e o spread `...(caracterizacao?.trecho ? { caracterizacao } : {})` continua valendo.

- [ ] **Step 3: `modules/nexo/types.ts`**

Import: `import type { LeituraDaCapa } from "@/lib/leitura-da-capa";`

Em `NexoFileClassification`, depois de `revisao: string;`:
```ts
  /** Da capa do memorial. Ver [[lib/leitura-da-capa.ts]]. */
  secretaria?: string;
  /** Capa ("BAIRRO SÃO JOÃO"), senão caracterização. */
  bairro?: string;
  mesAno?: string;
  /** A leitura crua da página 1, quando ela é capa. */
  capa?: LeituraDaCapa;
```
Em `NexoDossieDraft`, depois de `revisao?: string;`:
```ts
  secretaria?: string;
  bairro?: string;
  mesAno?: string;
  /** A capa do memorial do lote, quando lida. O bairro da identidade sai SÓ daqui. */
  capa?: LeituraDaCapa;
```

- [ ] **Step 4: `server/nexo/classify-documents.ts`**

Import: `import { divergenciaDeCodigo, type LeituraDaCapa } from "@/lib/leitura-da-capa";`

`ContentIdentity`, depois de `codigo: string;`:
```ts
  secretaria: string;
  bairro: string;
  mesAno: string;
  capa?: LeituraDaCapa;
```

`toClassification`, depois de `revisao: parsed.revisao,`:
```ts
    secretaria: content?.secretaria ?? "",
    bairro: content?.bairro ?? "",
    mesAno: content?.mesAno ?? "",
    ...(content?.capa ? { capa: content.capa } : {}),
```

Em `classifyDocuments`, no objeto `content`, depois de `codigo: doc.codigo,`:
```ts
        secretaria: doc.secretaria,
        bairro: doc.bairro,
        mesAno: doc.mesAno,
        capa: doc.capa,
```
e logo depois de fechar o objeto `content = {…};`:
```ts
      /*
       * O nome do arquivo manda no código (é a chave do projeto); a capa só
       * confere, e a divergência tem de aparecer em vez de ser engolida.
       */
      const divergencia = divergenciaDeCodigo(parsed.codigo, doc.capa?.codigo ?? "");
      if (divergencia) content.sinais = [...content.sinais, divergencia];
```

`pickByConfidence`: o tipo de `key` passa a
`"obra" | "municipio" | "codigo" | "orgao" | "revisao" | "secretaria" | "bairro" | "mesAno"`.

`aggregate`, antes do `return`:
```ts
  const capa = arquivos.find((a) => a.capa)?.capa;
```
e no objeto, depois de `revisao: pickByConfidence(arquivos, "revisao"),`:
```ts
    secretaria: pickByConfidence(arquivos, "secretaria"),
    bairro: pickByConfidence(arquivos, "bairro"),
    mesAno: pickByConfidence(arquivos, "mesAno"),
    ...(capa ? { capa } : {}),
```

- [ ] **Step 5: Typecheck, lint e testes**

Run:
```bash
npx tsc --noEmit -p tsconfig.json
npx eslint lib/leitura-da-capa.ts lib/audit-classify.ts lib/nome-da-obra.ts server/nexo/classify-documents.ts modules/nexo/types.ts
npm run -s test:leitura-da-capa && npm run -s test:capa-dos-modelos && npm run -s test:nome-da-obra && npm run -s test:orgao-do-timbre && npm run -s test:caracterizacao
```
Expected: tsc sem saída; eslint sem saída; todos os testes OK.

- [ ] **Step 6: Medir o acervo DEPOIS**

```bash
npm run -s medir:identidade -- --comparar "$SCRATCH/identidade-antes.json" "$SCRATCH/027_24_md_geral_a.pdf"
```
Expected (e SÓ isto; qualquer outra mudança para e é investigada):
- `capaLida` `false → true` em 027_24, 040_26, 113_22, 116_25 (geral e ter_pav), 117_25, 156_25; `false` em todo o kit.
- `obra`: 113_22 → `HOSPITAL MUNICIPAL NOSSA SENHORA DOS NAVEGANTES`; 116_25 → `UBS RENASCER - PORTE 2`; 117_25 → `UBS VILA MANAUS - PORTE 1`; 156_25 → `NOVA SEDE DA DEFESA CIVIL`; 040_26 → `REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ`; 027_24 → `BEIRA MAR DE SÃO JOSÉ - BARREIROS URBANIZAÇÃO DA ORLA - PARQUE, RESTAURANTE E LANCHONETE`; 116_25_md_ter_pav → `UBS RENASCER - PORTE 2`.
- `secretaria`, `bairro`, `mesAno` preenchidos onde a capa traz.
- `orgao` e `municipio` iguais aos de antes (a forma canônica e a caracterização já davam o mesmo).

- [ ] **Step 7: Commit**

```bash
git add lib/audit-classify.ts lib/nome-da-obra.ts scripts/test-nome-da-obra.ts modules/nexo/types.ts server/nexo/classify-documents.ts
git diff --cached --stat
git commit -m "a capa vira a fonte padrao da identidade do memorial; rodape e corpo ficam de fallback"
```

---

### Task 5: Chat e identidade da conversa

**Files:**
- Modify: `modules/nexo/components/NexoWorkspace.tsx` (`appendMemorialIntake`, ~linha 873)

**Interfaces:**
- Consumes: `NexoDossieDraft.secretaria/bairro/mesAno/capa` e `NexoFileClassification.sinais` (Task 4).

- [ ] **Step 1: Trocar o começo de `appendMemorialIntake`** (do comentário "Só os campos que a classificação LÊ" até o `.join(" · ");`) por:

```ts
    /*
     * O que a classificação LEU, na ordem da capa. Endereço não entra: o
     * classificador lê o endereço da caracterização, mas afirmá-lo aqui como
     * dado do anexo seria misturar a capa com o corpo.
     */
    const detail = [
      dossie?.obra,
      dossie?.orgao,
      dossie?.secretaria,
      dossie?.bairro,
      dossie?.municipio,
      dossie?.codigo ? `código ${dossie.codigo}` : "",
      dossie?.mesAno,
    ]
      .filter(Boolean)
      .join(" · ");
    /* Código da capa × nome do arquivo: o nome manda, mas a divergência se vê. */
    const divergencia = dossie?.arquivos
      .find((a) => a.tipo === "memorial")
      ?.sinais.find((s) => s.startsWith("código da capa"));
```

- [ ] **Step 2: Identidade** — depois de `if (dossie?.municipio) lido.municipio = dossie.municipio;`:

```ts
    if (dossie?.secretaria) lido.secretaria = dossie.secretaria;
    /*
     * O bairro SÓ da capa: o modelo de Criciúma imprime `{{BAIRRO}}` sozinho e
     * espera "BAIRRO X"; o da caracterização vem sem o prefixo.
     */
    if (dossie?.capa?.bairro) lido.bairro = dossie.capa.bairro;
```

- [ ] **Step 3: Texto da mensagem** — trocar
```ts
        `Li as primeiras páginas: é o memorial descritivo${detail ? ` — ${detail}` : ""}.\n\n` +
```
por
```ts
        `${dossie?.capa ? "Li a capa" : "Li as primeiras páginas"}: é o memorial descritivo${detail ? ` — ${detail}` : ""}.\n\n` +
        (divergencia ? `Atenção: ${divergencia}.\n\n` : "") +
```

- [ ] **Step 4: Typecheck e lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint modules/nexo/components/NexoWorkspace.tsx`
Expected: sem saída.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/NexoWorkspace.tsx
git diff --cached --stat
git commit -m "o chat diz o que leu da capa, com secretaria, bairro e data, e avisa codigo divergente"
```

---

### Task 6: Provas de efeito

**Files:**
- Create: `scripts/prova-intake-da-capa.mjs`
- Modify: `package.json`

- [ ] **Step 1: Regra determinística com gabarito antigo × novo** (sem commit; script no scratchpad)

```js
// $SCRATCH/regra-gabarito.mjs — rodar com --import ./scripts/lib/resolver-de-imports.mjs
import fs from "fs";
import { extractPdfText } from "@/lib/pdf-text";
import { runWithinDocumentIdentityRules } from "@/lib/cross-document-audit";
const casos = [
  ["docs/samples/116-25/1_memorial/116_25_md_geral_b.pdf", "Unidade Básica de Saúde Localizada Na Rua Pedro Antônio", "UBS RENASCER - PORTE 2"],
  ["docs/samples/117-25/1_memorial/117_25_md_geral_a.pdf", "Unidade Básica de Saúde Localizada Na Rua São Francisco de Assis", "UBS VILA MANAUS - PORTE 1"],
  ["docs/samples/113-22/1_memorial/113_22_md_geral_a.pdf", "Hospital Nossa Senhora dos Navegantes", "HOSPITAL MUNICIPAL NOSSA SENHORA DOS NAVEGANTES"],
];
for (const [f, antigo, novo] of casos) {
  const source = { fileName: f.split("/").pop(), fileType: "memorial", extracted: await extractPdfText(fs.readFileSync(f)) };
  const a = runWithinDocumentIdentityRules(source, { gabaritoObra: antigo });
  const n = runWithinDocumentIdentityRules(source, { gabaritoObra: novo });
  console.log(source.fileName, "antigo:", a.length, "novo:", n.length);
  for (const x of n) console.log("  novo →", x.severity ?? x.prioridade, x.title ?? x.tipo, String(x.evidencia ?? x.description ?? "").slice(0, 120));
}
```
Expected: registrar os números. Achado novo com gabarito novo é lido um a um e classificado como real ou falso positivo **no relatório final ao usuário**, sem conserto nesta tarefa.

- [ ] **Step 2: Prova no navegador** — `scripts/prova-intake-da-capa.mjs`

```js
// ANEXAR O MEMORIAL E LER A MENSAGEM DO CHAT: os dados vêm da capa.
//
//   npm run dev                                  (noutro terminal)
//   MEMORIAL=/caminho/027_24_md_geral_a.pdf node scripts/prova-intake-da-capa.mjs
//   (== npm run prova:intake-da-capa)
//
// Sem IA: a classificação do anexo é determinística. O memorial vai pelo input
// `accept="application/pdf,image/*"`, que é o caminho dos anexos (ver
// nexodoc-pre-voo-do-anexo). A conversa criada é apagada no fim.
import { chromium } from "playwright";
import { existsSync } from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const MEMORIAL = process.env.MEMORIAL;
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};
if (!MEMORIAL || !existsSync(MEMORIAL)) {
  console.error("defina MEMORIAL com o caminho do PDF");
  process.exit(1);
}

const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
  const pg = await ctx.newPage();
  await pularTourGuiado(pg);
  await pg.goto("/nexo", { waitUntil: "domcontentloaded" });
  if (pg.url().includes("/login")) {
    await pg.getByRole("button", { name: /Entrar como dev/i }).click();
    await pg.waitForURL("**/nexo**", { timeout: 60_000 });
  }
  await pg.waitForLoadState("networkidle");

  await pg.locator('input[type=file][accept="application/pdf,image/*"]').first().setInputFiles(MEMORIAL);
  const mensagem = pg.getByText(/Li a capa: é o memorial descritivo/).first();
  await mensagem.waitFor({ state: "visible", timeout: 180_000 }).catch(() => {});
  const texto = (await mensagem.textContent().catch(() => "")) ?? "";
  check("a mensagem diz que leu a capa", texto.includes("Li a capa"), texto.slice(0, 200));
  check("com a obra da capa", texto.includes("BEIRA MAR DE SÃO JOSÉ - BARREIROS"), texto.slice(0, 300));
  check("com a prefeitura sem a secretaria colada", texto.includes("PREFEITURA MUNICIPAL DE SÃO JOSÉ ·"), texto);
  check("com a secretaria em campo próprio", texto.includes("SECRETARIA MUNICIPAL DE INFRAESTRUTURA"), texto);
  check("com o mês/ano", texto.includes("OUTUBRO 2025"), texto);
  check("e sem a prosa do canteiro", !texto.includes("Diário de Obra"), texto);
  const caixa = await mensagem.boundingBox().catch(() => null);
  const janela = pg.viewportSize();
  check(
    "a mensagem está DENTRO da janela",
    Boolean(caixa) && caixa.y >= 0 && caixa.y + caixa.height <= janela.height && caixa.x >= 0 && caixa.x + caixa.width <= janela.width,
    JSON.stringify({ caixa, janela }),
  );
  await pg.screenshot({ path: "docs/provas/prova-intake-da-capa.png" }).catch(() => {});
} finally {
  await navegador.close();
}
console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

`package.json`: `"prova:intake-da-capa": "node scripts/prova-intake-da-capa.mjs",`

Run: subir `npm run dev` limpo (em segundo plano), depois
`MEMORIAL="$SCRATCH/027_24_md_geral_a.pdf" npm run -s prova:intake-da-capa`
Expected: `prova passou`. Se a mensagem não aparecer, ler `docs/provas/prova-intake-da-capa.png` antes de mudar qualquer coisa (tour por cima, input errado, pré-voo perguntando o papel do anexo). Depois, derrubar o dev server e conferir que a porta 3000 está livre. A conversa criada na prova fica no banco de dev: apagar pelo título `Memorial` + data de hoje só se for dela (conferir o `id` antes).

- [ ] **Step 3: Commit**

```bash
git add scripts/prova-intake-da-capa.mjs package.json
git diff --cached --stat
git commit -m "prova no navegador: anexar o memorial de sao jose mostra no chat o que a capa diz"
```

- [ ] **Step 4: Push** — `git pull --rebase -q origin main && git push -q origin main`, depois rodar de novo os testes da Task 4, Step 5, em cima do que chegou.
