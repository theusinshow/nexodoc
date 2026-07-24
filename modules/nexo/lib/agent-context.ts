/**
 * Contexto do agente derivado dos selos lidos — o "o que o Nexo já entendeu"
 * que alimenta o popover de status do orb. PURO e SEM IMPORTS (testável com
 * `node` cru). Princípio "afirma fatos": só devolve o que foi de fato lido;
 * código/revisão são conservadores (null quando incerto — nunca inventa).
 *
 * Nota: código/revisão NÃO reusam `parseFilename` de propósito — aquele módulo
 * tem imports relativos sem extensão que o type-stripping do node não resolve,
 * o que inviabilizaria o teste. A extração aqui é um subconjunto conservador da
 * convenção do escritório (<cod>_<disc>_<NNN>_<rev>).
 */

/** Subconjunto do selo que o contexto precisa (evita acoplar ao tipo completo). */
export interface SeloFacts {
  fileName: string;
  arquivo: string | null;
  disciplina: string | null;
  obra: string | null;
}

export interface AgentContext {
  /** Nº de folhas com selo lido. */
  folhas: number;
  /** Obra dominante (mais frequente; empate → primeira vista). */
  obra: string | null;
  /** Disciplinas distintas, na ordem de aparição. */
  disciplinas: string[];
  /** Código do projeto dominante, normalizado "NNN-NN" (null se incerto). */
  codigo: string | null;
  /** Revisão dominante, minúscula (null se incerto). */
  revisao: string | null;
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Código do projeto no padrão do escritório: "040_26"/"040-26" → "040-26". */
function extractCodigo(source: string): string | null {
  const m = normalize(source).match(/(\d{2,4})[_-](\d{2})(?!\d)/);
  return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Revisão conservadora: a letra final isolada da convenção do escritório
 * (…_a.pdf / 040_26_est_005_a → "a"). Retorna null quando não há um marcador
 * claro — não chuta (formas ambíguas como "-R00" ficam de fora de propósito).
 */
function extractRevisao(source: string): string | null {
  const stem = normalize(source)
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_ -]?assinado/g, "");
  const letra = stem.match(/[_-]([a-z])$/);
  return letra ? letra[1] : null;
}

/** Valor mais frequente de uma lista (empate → primeiro visto). Ignora vazios. */
function dominant(values: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const v = raw?.trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

/** Deriva o contexto do agente a partir dos selos lidos. */
export function summarizeSelos(selos: SeloFacts[]): AgentContext {
  const disciplinas: string[] = [];
  const seen = new Set<string>();
  for (const s of selos) {
    const d = s.disciplina?.trim();
    if (d && !seen.has(d)) {
      seen.add(d);
      disciplinas.push(d);
    }
  }

  const codigos = selos.map((s) => extractCodigo(s.arquivo?.trim() || s.fileName));
  const revisoes = selos.map((s) => extractRevisao(s.arquivo?.trim() || s.fileName));

  return {
    folhas: selos.length,
    obra: dominant(selos.map((s) => s.obra)),
    disciplinas,
    codigo: dominant(codigos),
    revisao: dominant(revisoes),
  };
}
