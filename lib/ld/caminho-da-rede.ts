/**
 * O CAMINHO DA REDE NO RODAPÉ DA LD (08/10/2026).
 *
 * O escritório imprime, no rodapé de toda LD, onde o `.odt` dela mora na rede —
 * os diretores abrem o PDF e sabem onde está o arquivo. Medido nas 62 LDs de
 * `docs/samples`:
 *
 *   P:\cad\pmcriciuma\116_25\eletrico\documentos\1_emissão inicial_out-25\116_25_elt_ld_a.odt
 *          cliente    projeto disciplina          emissão                  nome
 *
 * Tudo é deduzível menos a EMISSÃO, que cada um escreve do seu jeito
 * (`1_emissão inicial_out-25`, `…_out-2025`, `1_emissao inicial_out.25`,
 * `4_recebido 14_10_25`) e que varia até entre disciplinas do mesmo volume. Por
 * isso ela é sugerida, decidida no topo para todas, e ajustável por disciplina;
 * e um caminho colado do Explorer vence qualquer dedução.
 *
 * Nunca inventa: sem cliente (nem do modelo, nem colado) não há caminho.
 *
 * PURO: nenhum import, para rodar em `node scripts/test-caminho-da-rede.ts`.
 * Spec: docs/superpowers/specs/2026-10-08-caminho-da-rede-na-ld-design.md
 */

const RAIZ = "P:\\cad";
const SEP = "\\";

/**
 * A pasta de cada disciplina, pela maioria nas 62 LDs. `top` fica no
 * arquitetônico (2 de 3; o 156-25 usa `topografia`) e `gme` em `gases
 * medicinais` (116-25; o 113-22 a guardou em `climatizacao`) — quem divergir
 * cola o caminho uma vez.
 */
export const PASTA_DA_DISCIPLINA: Record<string, string> = {
  arq: "arquitetonico",
  urb: "arquitetonico",
  psg: "arquitetonico",
  mqt: "arquitetonico",
  lev: "arquitetonico",
  top: "arquitetonico",
  snd: "sondagens",
  gmt: "terraplenagem",
  ter: "terraplenagem",
  geo: "terraplenagem",
  dre: "drenagem",
  pav: "pavimentacao",
  est: "estrutural_concreto",
  met: "estrutural_metalico",
  elt: "eletrico",
  ele: "eletrico",
  cab: "cabeamento",
  cft: "cftv",
  cftv: "cftv",
  his: "hidrossanitario",
  inc: "preventivo_incendio",
  spd: "preventivo_incendio",
  cli: "climatizacao",
  gme: "gases medicinais",
};

/** O que a pessoa ajustou numa disciplina. Campo ausente = segue o topo/dedução. */
export interface AjusteDaDisciplina {
  /** Tudo antes da emissão (`P:\cad\…\documentos`), vindo de uma colagem. */
  base?: string;
  /** A emissão desta disciplina. `""` = o arquivo fica direto na base. */
  emissao?: string;
}

/** A decisão guardada na conversa (`caminhoDaRede`, como JSON). */
export interface RedeDaLd {
  /** Cliente tirado de uma colagem — vence o do modelo da capa. */
  cliente?: string;
  /** A emissão decidida no topo. Ausente = sugerida; `""` = nenhuma. */
  emissao?: string;
  /** A revisão quando a decisão foi tomada: o volume seguinte só reaproveita a emissão se for a mesma. */
  revisao?: string;
  /** Mês e ano da capa, para a sugestão. Não são decisão: chegam junto. */
  mes?: string;
  ano?: string;
  porDisciplina?: Record<string, AjusteDaDisciplina>;
  /**
   * ALGUÉM OLHOU E DISSE "É AQUI" (16/10/2026). Sem isto o caminho é só uma
   * recomendação — deduzida do padrão ou herdada do volume anterior — e o
   * plano não gera a LD: o rodapé imprime um endereço que ninguém confirmou.
   */
  confirmada?: true;
  /** De onde veio a recomendação, enquanto não confirmada. Ausente = padrão do escritório. */
  origem?: "volume-anterior";
}

export interface CaminhoColado {
  base: string;
  emissao: string;
  cliente?: string;
  /** A pasta da disciplina reconhecida no caminho (`cabeamento`). */
  pasta?: string;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function semAcento(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "OUTUBRO", "outubro", "out", "10" → "out". Vazio quando não reconhece. */
function abreviarMes(mes?: string): string {
  const v = semAcento(mes ?? "");
  if (!v) return "";
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return MESES[n - 1];
  return MESES.find((m) => v.startsWith(m)) ?? "";
}

/** "a" → 1, "b" → 2… Letra que não é letra conta como primeira emissão. */
function numeroDaRevisao(revisao: string): number {
  const c = semAcento(revisao).charCodeAt(0);
  return c >= 97 && c <= 122 ? c - 96 : 1;
}

/**
 * A emissão sugerida: a forma mais comum nas LDs entregues.
 * `a` → `1_emissão inicial_out-25`; `b` → `2_revisão_abr-26`.
 */
export function sugerirEmissao(revisao: string, mes?: string, ano?: string): string {
  const n = numeroDaRevisao(revisao);
  const m = abreviarMes(mes);
  const aa = (ano ?? "").trim().slice(-2);
  const quando = m && /^\d{2}$/.test(aa) ? `_${m}-${aa}` : "";
  return `${n}_${n === 1 ? "emissão inicial" : "revisão"}${quando}`;
}

function codigoDaPasta(codigo: string): string {
  return codigo.trim().toLowerCase().replace(/[-\s]+/g, "_");
}

/** `116_25_elt_ld_a.odt` — como o escritório salva a LD. */
export function nomeDaLd(codigo: string, disciplina: string, revisao: string): string {
  return [codigoDaPasta(codigo), disciplina.trim().toLowerCase(), "ld", revisao.trim().toLowerCase()]
    .filter(Boolean)
    .join("_") + ".odt";
}

/**
 * A base deduzida: `P:\cad\<cliente>\<projeto>\<pasta>\documentos`. Sigla fora
 * da tabela para no projeto — pasta inventada seria pior que pasta nenhuma.
 */
export function baseDeduzida(a: { cliente?: string; codigo?: string; disciplina?: string }): string {
  const cliente = a.cliente?.trim();
  const codigo = a.codigo?.trim();
  if (!cliente || !codigo) return "";
  const projeto = [RAIZ, cliente, codigoDaPasta(codigo)].join(SEP);
  const pasta = PASTA_DA_DISCIPLINA[(a.disciplina ?? "").trim().toLowerCase()];
  return pasta ? [projeto, pasta, "documentos"].join(SEP) : projeto;
}

const EXTENSAO_DE_ARQUIVO = /\.(odt|pdf|dwg|ods|docx?|xlsx?)$/i;

/**
 * Separa um caminho colado do Explorer. Aceita aspas (o "Copiar como caminho"
 * do Windows as põe), `/`, barra no fim e o nome do arquivo junto. Texto que não
 * parece caminho (sem `X:\` nem `\\servidor`) devolve `null`: é uma emissão
 * digitada, não uma colagem.
 */
export function separarCaminhoColado(texto: string): CaminhoColado | null {
  let v = texto.trim().replace(/^["']+|["']+$/g, "").trim().replace(/\//g, SEP);
  const unc = v.startsWith(SEP + SEP);
  if (!unc && !/^[A-Za-z]:\\/.test(v)) return null;
  const partes = v.split(SEP).filter(Boolean);
  if (partes.length > 1 && EXTENSAO_DE_ARQUIVO.test(partes[partes.length - 1])) partes.pop();
  if (partes.length === 0) return null;
  const i = partes.map((p) => semAcento(p)).lastIndexOf("documentos");
  const baseP = i >= 0 ? partes.slice(0, i + 1) : partes;
  const emissao = i >= 0 ? partes.slice(i + 1).join(SEP) : "";
  v = (unc ? SEP + SEP : "") + baseP.join(SEP);
  const iCad = baseP.findIndex((p) => semAcento(p) === "cad");
  const cliente = iCad >= 0 ? baseP[iCad + 1] : undefined;
  // A pasta da disciplina: a anterior a `documentos`, ou a última da base.
  const pasta = i >= 0 ? baseP[i - 1] : baseP[baseP.length - 1];
  const out: CaminhoColado = { base: v, emissao };
  if (cliente) out.cliente = cliente;
  if (pasta) out.pasta = pasta;
  return out;
}

/**
 * Aplica uma colagem à decisão. Com `alvo`, vale para aquela disciplina. No
 * topo: se a pasta colada é a de alguma disciplina do volume, ajusta só ela(s);
 * senão a emissão colada vale para todas.
 */
export function aplicarColado(
  rede: RedeDaLd,
  colado: CaminhoColado,
  disciplinas: readonly string[],
  alvo?: string,
): RedeDaLd {
  const proxima: RedeDaLd = { ...rede, porDisciplina: { ...(rede.porDisciplina ?? {}) } };
  if (colado.cliente) proxima.cliente = colado.cliente;
  const pasta = semAcento(colado.pasta ?? "");
  const alvos = alvo
    ? [alvo]
    : disciplinas.filter((d) => pasta && semAcento(PASTA_DA_DISCIPLINA[d.toLowerCase()] ?? "") === pasta);
  if (alvos.length === 0) {
    proxima.emissao = colado.emissao;
  } else {
    for (const d of alvos) proxima.porDisciplina![d.toLowerCase()] = { base: colado.base, emissao: colado.emissao };
  }
  if (Object.keys(proxima.porDisciplina!).length === 0) delete proxima.porDisciplina;
  return proxima;
}

/**
 * O caminho completo da LD, ou `""`. Precedência: o ajuste da disciplina (que
 * vem de colagem ou da linha editada) > a emissão do topo > a sugestão.
 */
export function caminhoDaLd(a: {
  cliente?: string;
  codigo?: string;
  disciplina?: string;
  revisao?: string;
  rede?: RedeDaLd;
}): string {
  const rede = a.rede ?? {};
  const disc = (a.disciplina ?? "").trim().toLowerCase();
  const ajuste = rede.porDisciplina?.[disc] ?? {};
  const cliente = rede.cliente?.trim() || a.cliente;
  const colada = ajuste.base?.trim();
  const base = colada || baseDeduzida({ cliente, codigo: a.codigo, disciplina: disc });
  if (!base || !a.codigo?.trim()) return "";
  const revisao = a.revisao?.trim() || "a";
  // Sem pasta da disciplina conhecida, a emissão não tem onde morar: pendurá-la
  // no projeto inventaria uma pasta que ninguém criou.
  const semPasta = !colada && !PASTA_DA_DISCIPLINA[disc];
  const emissao = semPasta ? "" : (ajuste.emissao ?? rede.emissao ?? sugerirEmissao(revisao, rede.mes, rede.ano));
  return [base, emissao.trim(), nomeDaLd(a.codigo, disc, revisao)].filter(Boolean).join(SEP);
}

/**
 * O ponto de partida de um volume novo da mesma obra: a decisão do volume
 * anterior. As PASTAS (cliente, disciplina colada) são da obra e valem sempre;
 * a EMISSÃO é da entrega — mesma revisão, mesma emissão (os volumes 3, 5 e 7 da
 * mesma entrega moram na mesma pasta); revisão nova, emissão sugerida de novo.
 */
export function redeDoVolumeAnterior(anterior: RedeDaLd, revisao: string): RedeDaLd {
  const atual = revisao.trim().toLowerCase() || "a";
  // Herdar é RECOMENDAR: a confirmação foi de outro volume, não deste.
  if ((anterior.revisao ?? "").trim().toLowerCase() === atual) {
    const { confirmada: _c, ...herdada } = lerRede(anterior);
    return { ...herdada, origem: "volume-anterior" };
  }
  const rede: RedeDaLd = { revisao: atual, origem: "volume-anterior" };
  if (anterior.cliente) rede.cliente = anterior.cliente;
  const por: Record<string, AjusteDaDisciplina> = {};
  for (const [d, ajuste] of Object.entries(anterior.porDisciplina ?? {})) {
    if (ajuste.base) por[d] = { base: ajuste.base };
  }
  if (Object.keys(por).length > 0) rede.porDisciplina = por;
  return rede;
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** Lê a decisão guardada (JSON ou objeto). Lixo vira `{}`; campo de tipo errado cai. */
export function lerRede(valor: unknown): RedeDaLd {
  let bruto: unknown = valor;
  if (typeof valor === "string") {
    try {
      bruto = JSON.parse(valor);
    } catch {
      return {};
    }
  }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return {};
  const o = bruto as Record<string, unknown>;
  const rede: RedeDaLd = {};
  for (const k of ["cliente", "emissao", "revisao", "mes", "ano"] as const) {
    const v = texto(o[k]);
    if (v !== undefined) rede[k] = v;
  }
  if (o.confirmada === true) rede.confirmada = true;
  if (o.origem === "volume-anterior") rede.origem = "volume-anterior";
  if (o.porDisciplina && typeof o.porDisciplina === "object" && !Array.isArray(o.porDisciplina)) {
    const por: Record<string, AjusteDaDisciplina> = {};
    for (const [d, aj] of Object.entries(o.porDisciplina as Record<string, unknown>)) {
      if (!aj || typeof aj !== "object") continue;
      const r = aj as Record<string, unknown>;
      const ajuste: AjusteDaDisciplina = {};
      const base = texto(r.base);
      const emissao = texto(r.emissao);
      if (base !== undefined) ajuste.base = base;
      if (emissao !== undefined) ajuste.emissao = emissao;
      if (Object.keys(ajuste).length > 0) por[d.toLowerCase()] = ajuste;
    }
    if (Object.keys(por).length > 0) rede.porDisciplina = por;
  }
  return rede;
}

/** O plano ainda não pode gerar a LD: ninguém confirmou o caminho. */
export function redePendente(rede: RedeDaLd): boolean {
  return rede.confirmada !== true;
}

/**
 * "Usar este caminho". A emissão sugerida é CONGELADA: enquanto pendente ela
 * acompanha o mês da capa, mas o que alguém confirmou não muda sozinho depois.
 */
export function confirmarRede(rede: RedeDaLd, sugestao: string): RedeDaLd {
  const { origem: _o, ...resto } = rede;
  return { ...resto, emissao: rede.emissao ?? sugestao, confirmada: true };
}

/** A decisão como texto. Decisão vazia = `""`, que DESFAZ (regra das decisões). */
export function gravarRede(rede: RedeDaLd): string {
  const limpa = lerRede(rede);
  return Object.keys(limpa).length > 0 ? JSON.stringify(limpa) : "";
}
