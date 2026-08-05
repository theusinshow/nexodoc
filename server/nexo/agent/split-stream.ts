/**
 * Separador do fluxo do turno: o que vai PRA TELA (prosa) e o que é CAUDA DE
 * DADOS (o JSON das propostas). O agente responde em prosa e só no fim abre uma
 * cerca ```json — porque JSON não se mostra pela metade.
 *
 * PURO, SEM IMPORTS de runtime (padrão de `light-check-core.ts`/`normalize.ts`):
 * roda em node cru, sem esbarrar no alias `@/`.
 *
 * Também é o PARSER ÚNICO do turno (`parseTail`) — o caminho não-streaming usa o
 * mesmo código, para não existirem dois parsers divergindo com o tempo.
 */

/** Marcadores que abrem a cauda. `\n{` pega o JSON solto, sem cerca. */
const MARKERS = ["```", "\n{"];

export interface SplitState {
  /** Já entrou na cauda: daqui pra frente nada mais vai pra tela. */
  inTail: boolean;
  /** Sufixo retido — pode ser o começo de um marcador partido entre pedaços. */
  held: string;
  /** Cauda acumulada (cerca + JSON). */
  tail: string;
  /** Já saiu alguma prosa? (decide se um "{" inicial é o JSON antigo inteiro) */
  emitted: boolean;
}

export function createSplitState(): SplitState {
  return { inTail: false, held: "", tail: "", emitted: false };
}

/**
 * Maior sufixo de `buf` que é começo (parcial) de algum marcador — o pedaço que
 * NÃO pode ser mostrado ainda porque o próximo chunk pode completar a cerca.
 */
function heldSuffixLength(buf: string): number {
  for (let n = Math.min(2, buf.length); n > 0; n--) {
    const suffix = buf.slice(buf.length - n);
    if (MARKERS.some((m) => m.length > n && m.startsWith(suffix))) return n;
  }
  return 0;
}

/** Consome um pedaço do fluxo e devolve a PROSA VISÍVEL dele (pode ser ""). */
export function pushChunk(state: SplitState, chunk: string): string {
  if (state.inTail) {
    state.tail += chunk;
    return "";
  }

  let buf = state.held + chunk;
  state.held = "";

  // Modelo desobedeceu e mandou o JSON antigo inteiro: a resposta ABRE com "{".
  // Sem isto, o JSON cru iria pra tela.
  if (!state.emitted) {
    const lead = buf.trimStart();
    if (lead === "") {
      state.held = buf; // só espaço até agora — ainda não dá pra decidir
      return "";
    }
    if (lead.startsWith("{")) {
      state.inTail = true;
      state.tail = lead;
      return "";
    }
  }

  // Marcador mais cedo no buffer abre a cauda.
  let cut = -1;
  for (const marker of MARKERS) {
    const i = buf.indexOf(marker);
    if (i !== -1 && (cut === -1 || i < cut)) cut = i;
  }
  if (cut !== -1) {
    state.inTail = true;
    state.tail = buf.slice(cut);
    // O espaço em branco encostado na cerca só existe pra abrir a cauda: não é
    // prosa e não pode sobrar na tela.
    const visible = buf.slice(0, cut).replace(/\s+$/, "");
    if (visible) state.emitted = true;
    return visible;
  }

  // Sem marcador: retém o sufixo ambíguo (cerca partida entre pedaços).
  const hold = heldSuffixLength(buf);
  if (hold > 0) {
    state.held = buf.slice(buf.length - hold);
    buf = buf.slice(0, buf.length - hold);
  }
  if (buf) state.emitted = true;
  return buf;
}

/** Fecha o fluxo: solta o sufixo retido (não era cerca) e entrega a cauda. */
export function endStream(state: SplitState): { trailing: string; tail: string } {
  const trailing = state.inTail ? "" : state.held;
  state.held = "";
  return { trailing, tail: state.tail };
}

/**
 * Lê a cauda. Tolerante a cercas e a prosa em volta. Devolve `reply` quando o
 * modelo mandou o JSON antigo inteiro (rede de segurança do formato velho).
 */
/**
 * Escapa quebras de linha CRUAS dentro das strings do JSON.
 *
 * O prompt manda o modelo copiar o título "inclusive quando vier em várias
 * linhas" — e uma quebra de linha crua dentro de uma string é JSON INVÁLIDO.
 * O `JSON.parse` estourava, o `catch` devolvia `proposals: null`, e a proposta
 * inteira sumia sem uma palavra na tela: o engenheiro pedia
 *
 *   Alterar o título da capa para:
 *   PROJETO ESTRUTURAL CONCRETO
 *   (TOMO XX)
 *
 * e o software simplesmente não fazia nada. Instruir o modelo a escapar ajuda,
 * mas prompt é conselho; isto é garantia.
 *
 * Só toca no que está DENTRO de string (respeitando a barra invertida), para
 * não mexer na formatação do JSON em volta.
 */
export function escaparQuebrasEmStrings(json: string): string {
  let saida = "";
  let dentroDeString = false;
  let escapado = false;
  for (const c of json) {
    if (escapado) {
      saida += c;
      escapado = false;
      continue;
    }
    if (c === "\\") {
      saida += c;
      escapado = dentroDeString;
      continue;
    }
    if (c === '"') {
      dentroDeString = !dentroDeString;
      saida += c;
      continue;
    }
    if (dentroDeString && (c === "\n" || c === "\r" || c === "\t")) {
      saida += c === "\n" ? "\\n" : c === "\r" ? "\\r" : "\\t";
      continue;
    }
    saida += c;
  }
  return saida;
}

export function parseTail(tail: string): { reply: string | null; proposals: unknown } {
  const cleaned = tail.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return { reply: null, proposals: null };
  try {
    const parsed = JSON.parse(escaparQuebrasEmStrings(cleaned.slice(start, end + 1))) as {
      reply?: unknown;
      proposals?: unknown;
    };
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : null,
      proposals: parsed.proposals ?? null,
    };
  } catch {
    return { reply: null, proposals: null };
  }
}
