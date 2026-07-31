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
  /**
   * O BLOCO a que esta folha pertence — o código da disciplina que a leva para
   * a sua separatriz e a sua LD (`blocos.ts`). "" quando não se sabe.
   *
   * É o eixo de quase toda a conferência: um volume tem uma capa e um bloco por
   * disciplina, e CADA BLOCO numera as suas folhas de 1 a N. Sem isto, o volume
   * 10 de 040-26 (his 1-11, inc 1-5, spd 1-4) era conferido como se fosse uma
   * sequência de 1 a 20 — e um volume perfeito saía com nove folhas "faltando"
   * e cinco "duplicadas".
   *
   * Opcional para não quebrar quem ainda não o calcula: sem ele, tudo cai num
   * bloco só, que é exatamente o comportamento antigo.
   */
  bloco?: string;
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

/** Opções da checagem pura. */
export interface CheckSeloFactsOptions {
  /** Código do bloco → rótulo de exibição ("his" → "Hidrossanitario"). */
  rotulos?: Record<string, string>;
}

/** Nome legível de um bloco, para as mensagens. */
function nomeDoBloco(codigo: string, rotulos: Record<string, string>): string {
  if (!codigo) return "Sem disciplina";
  return rotulos[codigo] || codigo.toUpperCase();
}

/**
 * Agrupa os fatos por bloco, na ordem em que cada bloco aparece — a mesma
 * ordem em que as disciplinas entram no volume. Sem `bloco` em fato nenhum,
 * sai um grupo só: o comportamento de antes, sem regra especial.
 */
function porBloco(facts: SeloFact[]): { codigo: string; facts: SeloFact[] }[] {
  const grupos = new Map<string, SeloFact[]>();
  for (const f of facts) {
    const codigo = (f.bloco ?? "").trim().toLowerCase();
    const grupo = grupos.get(codigo);
    if (grupo) grupo.push(f);
    else grupos.set(codigo, [f]);
  }
  return [...grupos.entries()].map(([codigo, facts]) => ({ codigo, facts }));
}

/**
 * Checagem PURA sobre fatos já parseados (sem tocar em nome de arquivo). Cada
 * regra que falha vira um finding; `veredito` = pior severidade (critico > aviso
 * > ok); achados apenas `info` não rebaixam "ok".
 *
 * O CÓDIGO e a OBRA são conferidos no volume inteiro: uma prancha de outro
 * projeto é o erro que originou este software, e ela não fica menos grave por
 * estar num bloco só. Tudo o mais é POR BLOCO, porque é assim que o escritório
 * emite: cada disciplina tem a sua separatriz, a sua LD e a sua numeração de 1
 * a N. Conferir as 20 folhas de um volume misto como uma sequência única
 * inventava folhas faltando e folhas duplicadas num volume perfeito.
 */
export function checkSeloFacts(
  facts: SeloFact[],
  opts: CheckSeloFactsOptions = {},
): LightCheckResult {
  const findings: LightCheckFinding[] = [];
  if (facts.length === 0) return { veredito: "ok", findings };
  const rotulos = opts.rotulos ?? {};

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

  const blocos = porBloco(facts);
  /*
   * O volume MISTO é o caso comum do escritório — seis dos oito volumes de
   * 040-26 misturam disciplinas. Por isso ele é FATO, não aviso: dizer
   * "disciplinas diferentes no mesmo conjunto" em todo volume normal treinava
   * o engenheiro a ignorar o semáforo, que é o pior estrago que um aviso pode
   * fazer. A composição fica registrada para ele CONFERIR (um bloco a menos é
   * uma disciplina que ficou de fora), sem rebaixar o veredito.
   */
  const comDisciplina = blocos.filter((b) => b.codigo !== "");
  if (comDisciplina.length > 1) {
    findings.push({
      severidade: "info",
      campo: "disciplina",
      mensagem: `Volume de ${comDisciplina.length} disciplinas — uma capa e um bloco (separatriz · LD · pranchas) para cada.`,
      detalhe: blocos
        .map((b) => `${nomeDoBloco(b.codigo, rotulos)}: ${b.facts.length} folha(s)`)
        .join(" | "),
    });
  }

  /*
   * Quem NÃO calculou o bloco cai aqui: sem disciplina por folha, a única
   * pista de mistura é o nome do arquivo, e o aviso antigo continua sendo o
   * melhor que dá para dizer. Com bloco calculado, a composição acima já disse
   * a mesma coisa melhor, e repetir seria o aviso falso de volta.
   */
  const semBloco = facts.every((f) => !(f.bloco ?? "").trim());
  if (semBloco) {
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
  }

  // Com um bloco só, a mensagem não leva prefixo: é o volume simples, e dizer
  // "Hidrossanitario: folha 3 faltando" quando só existe hidrossanitário é
  // cerimônia que não informa nada.
  const varios = blocos.length > 1;
  const prefixo = (codigo: string) =>
    varios ? `${nomeDoBloco(codigo, rotulos)}: ` : "";

  for (const bloco of blocos) {
    const doBloco = bloco.facts;

    // --- Revisão consistente DENTRO do bloco (AVISO) -------------------------
    // Entre blocos ela pode divergir sem defeito: cada disciplina tem o seu
    // ciclo de revisão, e o volume sai com hidrossanitário em A e incêndio em B.
    const revGroups = new Map<string, string[]>();
    for (const f of doBloco) {
      if (!f.revisao) continue;
      if (!revGroups.has(f.revisao)) revGroups.set(f.revisao, []);
      revGroups.get(f.revisao)!.push(f.label);
    }
    if (revGroups.size > 1) {
      findings.push({
        severidade: "aviso",
        campo: "revisao",
        mensagem: `${prefixo(bloco.codigo)}Pranchas com revisões divergentes (${[
          ...revGroups.keys(),
        ]
          .map((r) => r.toUpperCase())
          .join(" x ")}).`,
        detalhe: [...revGroups.entries()]
          .map(([rev, names]) => `rev ${rev.toUpperCase()}: ${joinNames(names)}`)
          .join(" | "),
      });
    }

    // --- Sequência de folhas: faltas (gaps) e duplicatas (AVISO) -------------
    // Total ROBUSTO: total DOMINANTE (o /TT mais frequente, resiste a OCR ruim)
    // OU a maior folha real OU a contagem. NÃO é o max de números soltos (que
    // inflava e inventava folhas faltando). Tudo dentro do bloco: cada
    // disciplina numera as suas folhas de 1 a N.
    const dominantTotal = modeNumber(
      doBloco.map((f) => f.totalLido).filter((t): t is number => typeof t === "number"),
    );
    const maxSheet = Math.max(
      0,
      ...doBloco.map((f) => (f.sheet != null && f.sheet > 0 ? f.sheet : 0)),
    );
    const referenceTotal = Math.max(dominantTotal, maxSheet, doBloco.length);

    const sheetCount = new Map<number, number>();
    for (const f of doBloco) {
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
          mensagem: `${prefixo(bloco.codigo)}Folha(s) faltando na sequência 1..${referenceTotal}: ${missing.join(", ")}.`,
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
          mensagem: `${prefixo(bloco.codigo)}Número(s) de folha duplicado(s): ${duplicates.join(", ")}.`,
          detalhe: duplicates
            .map((n) => `folha ${n} aparece ${sheetCount.get(n)}x`)
            .join(" | "),
        });
      }
    }

    // --- Folha × total: total do selo diverge do de referência (INFO/OCR) ----
    const totalMismatch: string[] = [];
    for (const f of doBloco) {
      if (f.totalLido != null && f.totalLido > 0 && f.totalLido !== referenceTotal) {
        totalMismatch.push(`${f.label} (total lido ${f.totalLido})`);
      }
    }
    if (totalMismatch.length > 0) {
      findings.push({
        severidade: "info",
        campo: "total",
        mensagem: `${prefixo(bloco.codigo)}Total lido no selo diverge do total de referência (${referenceTotal}) em ${totalMismatch.length} prancha(s) — provável ruído de OCR.`,
        detalhe: joinNames(totalMismatch),
      });
    }
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
