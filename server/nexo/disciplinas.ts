/**
 * Lexico de disciplinas do escritorio, extraido da convencao real de pastas/
 * arquivos dos projetos (040-26, 113-22, 116-25, 156-25). O CODIGO e a chave
 * canonica (e o que aparece nos nomes); o rotulo e para exibicao.
 *
 * Rotulos confirmados com o usuario (2026-07-21).
 */
export const DISCIPLINA_LEXICON: Record<string, string> = {
  // Arquitetura / estrutura
  arq: "Arquitetonico",
  urb: "Urbanismo",
  psg: "Paisagismo",
  mqt: "Maquete",
  fnd: "Fundacoes",
  est: "Estrutural",
  met: "Estrutura metalica",
  // Instalacoes
  elt: "Eletrico",
  ele: "Eletrico",
  cab: "Cabeamento estruturado",
  cft: "CFTV",
  cftv: "CFTV",
  his: "Hidrossanitario",
  inc: "Preventivo contra incendio",
  spd: "SPDA",
  cli: "Climatizacao",
  gme: "Gases medicinais",
  // Terra / infra
  top: "Topografia",
  snd: "Sondagem",
  lev: "Levantamento",
  gmt: "Geometrico",
  ter: "Terraplenagem",
  dre: "Drenagem",
  pav: "Pavimentacao",
};

/** Codigos que sao secoes/tipos de documento, nao disciplinas. */
export const NAO_DISCIPLINA = new Set(["memorial", "md", "geral", "capa", "capas", "separatriz", "vol", "orcamento"]);

export function disciplinaLabel(code: string): string | undefined {
  return DISCIPLINA_LEXICON[code.toLowerCase()];
}
