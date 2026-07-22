/**
 * Núcleo PURO da conferência leve do Nexo — a lógica de comparação sobre fatos já
 * parseados. SEM imports (nem do parser, nem de alias `@/`), de propósito: assim
 * `node` puro consegue carregá-lo e o smoke-test (`test:nexo:check`) roda sem o
 * resolver de módulos. O mapeamento selo->fato (que usa parse-filename) fica em
 * `light-check.ts`, mantendo a FONTE ÚNICA das regras de nome.
 */

export type LightCheckSeverity = "critico" | "aviso" | "info";

export interface LightCheckFinding {
  severidade: LightCheckSeverity;
  /** campo/dimensão conferido (ex.: "codigo", "obra", "sequencia"). */
  campo: string;
  mensagem: string;
  detalhe?: string;
}

export type LightCheckVeredito = "ok" | "aviso" | "critico";

export interface LightCheckResult {
  veredito: LightCheckVeredito;
  findings: LightCheckFinding[];
}

/**
 * Fatos já parseados de UMA prancha — a entrada da checagem pura. Isolar isto do
 * parsing do nome deixa `checkSeloFacts` testável sem carregar o parser.
 */
export interface SeloFact {
  /** rótulo de exibição (nome do arquivo). */
  label: string;
  /** código do projeto (ex.: "040-26"); "" se ausente. */
  codigo: string;
  /** nome da obra (cru, para exibição); "" se ausente. */
  obra: string;
  /** revisão (ex.: "a"); "" se ausente. */
  revisao: string;
  /** códigos de disciplina do nome (ex.: ["his"]). */
  disciplinas: string[];
  /** folha efetiva (autoritativa do nome); null se desconhecida. */
  sheet: number | null;
  /** total lido no selo (pode ser ruído de OCR); null se ausente. */
  totalLido: number | null;
  /** todos os números (>0) que o selo carrega — base do total de referência. */
  numeros: number[];
}

const SEVERITY_RANK: Record<LightCheckVeredito, number> = {
  ok: 0,
  aviso: 1,
  critico: 2,
};

/** Minúsculas + sem acento + espaço colapsado (para comparar obra). */
function normalizeObra(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lista curta e legível de nomes (limita para não estourar a mensagem). */
function joinNames(names: string[], max = 6): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} (+${names.length - max})`;
}

/** Valor mais frequente (>0) entre números — total dominante. */
function modeNumber(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) if (Number.isFinite(v) && v > 0) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) [best, bestN] = [k, n];
  return best;
}

/**
 * Checagem PURA sobre fatos já parseados (sem tocar em nome de arquivo). Cada
 * regra que falha vira um finding; `veredito` = pior severidade (critico > aviso
 * > ok); achados apenas `info` não rebaixam "ok".
 */
export function checkSeloFacts(facts: SeloFact[]): LightCheckResult {
  const findings: LightCheckFinding[] = [];
  if (facts.length === 0) return { veredito: "ok", findings };

  // --- Código consistente (CRÍTICO: o erro do "projeto errado") --------------
  const codigoGroups = new Map<string, string[]>();
  for (const f of facts) {
    if (!f.codigo) continue;
    if (!codigoGroups.has(f.codigo)) codigoGroups.set(f.codigo, []);
    codigoGroups.get(f.codigo)!.push(f.label);
  }
  if (codigoGroups.size > 1) {
    findings.push({
      severidade: "critico",
      campo: "codigo",
      mensagem: `Pranchas com códigos de projeto divergentes (${[...codigoGroups.keys()].join(
        " x ",
      )}) — possível mistura de projetos diferentes.`,
      detalhe: [...codigoGroups.entries()]
        .map(([cod, names]) => `${cod}: ${joinNames(names)}`)
        .join(" | "),
    });
  }

  // --- Obra consistente (CRÍTICO) --------------------------------------------
  const obraGroups = new Map<string, { display: string; names: string[] }>();
  for (const f of facts) {
    if (!f.obra) continue;
    const key = normalizeObra(f.obra);
    if (!key) continue;
    if (!obraGroups.has(key)) obraGroups.set(key, { display: f.obra, names: [] });
    obraGroups.get(key)!.names.push(f.label);
  }
  if (obraGroups.size > 1) {
    findings.push({
      severidade: "critico",
      campo: "obra",
      mensagem: `Selos com nomes de obra divergentes (${[...obraGroups.values()]
        .map((g) => `"${g.display}"`)
        .join(" x ")}) — confira se todas as pranchas são da mesma obra.`,
      detalhe: [...obraGroups.values()]
        .map((g) => `"${g.display}": ${joinNames(g.names)}`)
        .join(" | "),
    });
  }

  // --- Revisão consistente (AVISO) -------------------------------------------
  const revGroups = new Map<string, string[]>();
  for (const f of facts) {
    if (!f.revisao) continue;
    if (!revGroups.has(f.revisao)) revGroups.set(f.revisao, []);
    revGroups.get(f.revisao)!.push(f.label);
  }
  if (revGroups.size > 1) {
    findings.push({
      severidade: "aviso",
      campo: "revisao",
      mensagem: `Pranchas com revisões divergentes (${[...revGroups.keys()]
        .map((r) => r.toUpperCase())
        .join(" x ")}).`,
      detalhe: [...revGroups.entries()]
        .map(([rev, names]) => `rev ${rev.toUpperCase()}: ${joinNames(names)}`)
        .join(" | "),
    });
  }

  // --- Disciplina consistente (AVISO: talvez intencional, mas sinaliza) ------
  const discGroups = new Map<string, string[]>();
  for (const f of facts) {
    if (f.disciplinas.length === 0) continue;
    const key = f.disciplinas.join("+");
    if (!discGroups.has(key)) discGroups.set(key, []);
    discGroups.get(key)!.push(f.label);
  }
  if (discGroups.size > 1) {
    findings.push({
      severidade: "aviso",
      campo: "disciplina",
      mensagem: `Pranchas de disciplinas diferentes no mesmo conjunto (${[
        ...discGroups.keys(),
      ]
        .map((d) => d.toUpperCase())
        .join(" x ")}).`,
      detalhe: [...discGroups.entries()]
        .map(([disc, names]) => `${disc.toUpperCase()}: ${joinNames(names)}`)
        .join(" | "),
    });
  }

  // --- Sequência de folhas: faltas (gaps) e duplicatas (AVISO) ---------------
  // Total ROBUSTO: total DOMINANTE (o /TT mais frequente, resiste a OCR ruim) OU a
  // maior folha real OU a contagem. NÃO é o max de números soltos (que inflava e
  // inventava folhas faltando).
  const dominantTotal = modeNumber(
    facts.map((f) => f.totalLido).filter((t): t is number => typeof t === "number"),
  );
  const maxSheet = Math.max(
    0,
    ...facts.map((f) => (f.sheet != null && f.sheet > 0 ? f.sheet : 0)),
  );
  const referenceTotal = Math.max(dominantTotal, maxSheet, facts.length);

  const sheetCount = new Map<number, number>();
  for (const f of facts) {
    if (f.sheet != null) sheetCount.set(f.sheet, (sheetCount.get(f.sheet) ?? 0) + 1);
  }

  if (sheetCount.size > 0 && referenceTotal > 0) {
    const missing: number[] = [];
    for (let n = 1; n <= referenceTotal; n++) {
      if (!sheetCount.has(n)) missing.push(n);
    }
    if (missing.length > 0) {
      findings.push({
        severidade: "aviso",
        campo: "sequencia",
        mensagem: `Folha(s) faltando na sequência 1..${referenceTotal}: ${missing.join(", ")}.`,
        detalhe: `Total de referência ${referenceTotal}; ${sheetCount.size} folha(s) distinta(s) presentes.`,
      });
    }

    const duplicates = [...sheetCount.entries()]
      .filter(([, count]) => count > 1)
      .map(([n]) => n)
      .sort((a, b) => a - b);
    if (duplicates.length > 0) {
      findings.push({
        severidade: "aviso",
        campo: "sequencia",
        mensagem: `Número(s) de folha duplicado(s): ${duplicates.join(", ")}.`,
        detalhe: duplicates
          .map((n) => `folha ${n} aparece ${sheetCount.get(n)}x`)
          .join(" | "),
      });
    }
  }

  // --- Folha × total: total do selo diverge do de referência (INFO/OCR) ------
  const totalMismatch: string[] = [];
  for (const f of facts) {
    if (f.totalLido != null && f.totalLido > 0 && f.totalLido !== referenceTotal) {
      totalMismatch.push(`${f.label} (total lido ${f.totalLido})`);
    }
  }
  if (totalMismatch.length > 0) {
    findings.push({
      severidade: "info",
      campo: "total",
      mensagem: `Total lido no selo diverge do total de referência (${referenceTotal}) em ${totalMismatch.length} prancha(s) — provável ruído de OCR.`,
      detalhe: joinNames(totalMismatch),
    });
  }

  // --- Veredito = pior severidade (info não rebaixa "ok") --------------------
  let veredito: LightCheckVeredito = "ok";
  for (const f of findings) {
    const asVeredito: LightCheckVeredito =
      f.severidade === "critico" ? "critico" : f.severidade === "aviso" ? "aviso" : "ok";
    if (SEVERITY_RANK[asVeredito] > SEVERITY_RANK[veredito]) veredito = asVeredito;
  }

  return { veredito, findings };
}
