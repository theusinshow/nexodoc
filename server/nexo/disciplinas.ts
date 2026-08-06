/**
 * LÉXICO DE DISCIPLINAS — a fonte única dos nomes.
 *
 * O código de três letras é a chave canônica: é o que aparece nos nomes de
 * arquivo e nas pastas do escritório. O que muda é COMO ele é escrito, e são
 * três registros diferentes — descobertos lendo 91 capas e separatrizes reais
 * dos projetos 040-26, 113-22, 116-25 e 156-25:
 *
 * | registro | onde | exemplo (`his`) |
 * |----------|------|-----------------|
 * | `ui`         | chips, canvas, resumo do card | Hidrossanitário |
 * | `capa`       | a linha da disciplina na CAPA | PROJETO HIDROSSANITÁRIO |
 * | `documento`  | a SEPARATRIZ e o título da LD | PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS |
 *
 * **A capa usa o nome curto; a separatriz e a LD usam o longo.** Não é ruído do
 * escritório: repete-se em disciplina após disciplina, e sete das vinte e quatro
 * divergem entre os dois. Antes disto a LD de um volume misto saía com o rótulo
 * de INTERFACE ("HIDROSSANITARIO", sem acento) — o nome de tela indo parar no
 * documento entregue ao cliente.
 *
 * Os quatro casos que as amostras não decidiam sozinhas foram fechados com o
 * engenheiro (2026-08-06): `est` é sempre "PROJETO ESTRUTURAL CONCRETO" (e não
 * "DE CONCRETO ARMADO", que o 113-22 usava); `top` é sempre "LEVANTAMENTO
 * TOPOGRÁFICO" (e não a forma longa do 156-25); `fnd` é "PROJETO DE FUNDAÇÕES";
 * e `gmt`/`ter` às vezes andam juntos, às vezes separados — por isso têm nome
 * individual E um nome de par.
 */

export interface NomesDaDisciplina {
  /** Chips, canvas, resumo — o nome curto de tela. */
  ui: string;
  /** A linha da disciplina na CAPA. */
  capa: string;
  /** A SEPARATRIZ e o título da LD. */
  documento: string;
}

export const DISCIPLINAS: Record<string, NomesDaDisciplina> = {
  // ---------------------------------------------------- Arquitetura / estrutura
  arq: { ui: "Arquitetônico", capa: "PROJETO ARQUITETÔNICO", documento: "PROJETO ARQUITETÔNICO" },
  urb: { ui: "Urbanismo", capa: "PROJETO DE URBANIZAÇÃO", documento: "PROJETO DE URBANIZAÇÃO" },
  psg: { ui: "Paisagismo", capa: "PROJETO DE PAISAGISMO", documento: "PROJETO DE PAISAGISMO" },
  mqt: { ui: "Maquete", capa: "MAQUETE ELETRÔNICA", documento: "MAQUETE ELETRÔNICA" },
  fnd: { ui: "Fundações", capa: "PROJETO DE FUNDAÇÕES", documento: "PROJETO DE FUNDAÇÕES" },
  est: { ui: "Estrutural", capa: "PROJETO ESTRUTURAL CONCRETO", documento: "PROJETO ESTRUTURAL CONCRETO" },
  met: { ui: "Estrutura metálica", capa: "PROJETO ESTRUTURAL METÁLICO", documento: "PROJETO ESTRUTURAL METÁLICO" },

  // ------------------------------------------------------------------ Instalações
  elt: { ui: "Elétrico", capa: "PROJETO ELÉTRICO", documento: "PROJETO DE INSTALAÇÕES ELÉTRICAS" },
  ele: { ui: "Elétrico", capa: "PROJETO ELÉTRICO", documento: "PROJETO DE INSTALAÇÕES ELÉTRICAS" },
  cab: {
    ui: "Cabeamento estruturado",
    capa: "PROJETO DE CABEAMENTO ESTRUTURADO",
    documento: "PROJETO DE INSTALAÇÕES DE CABEAMENTO ESTRUTURADO",
  },
  cft: { ui: "CFTV", capa: "PROJETO DE CFTV", documento: "PROJETO DE CFTV" },
  cftv: { ui: "CFTV", capa: "PROJETO DE CFTV", documento: "PROJETO DE CFTV" },
  his: {
    ui: "Hidrossanitário",
    capa: "PROJETO HIDROSSANITÁRIO",
    documento: "PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS",
  },
  inc: {
    ui: "Preventivo contra incêndio",
    capa: "PROJETO PREVENTIVO",
    documento: "PROJETO PREVENTIVO CONTRA INCÊNDIO",
  },
  spd: {
    ui: "SPDA",
    capa: "PROJETO SPDA",
    documento: "PROJETO DE SISTEMA DE PROTEÇÃO CONTRA DESCARGAS ATMOSFÉRICAS",
  },
  cli: { ui: "Climatização", capa: "PROJETO DE CLIMATIZAÇÃO", documento: "PROJETO DE CLIMATIZAÇÃO" },
  gme: { ui: "Gases medicinais", capa: "PROJETO DE GASES MEDICINAIS", documento: "PROJETO DE GASES MEDICINAIS" },

  // ---------------------------------------------------------------- Terra / infra
  top: { ui: "Topografia", capa: "LEVANTAMENTO TOPOGRÁFICO", documento: "LEVANTAMENTO TOPOGRÁFICO" },
  snd: { ui: "Sondagem", capa: "SONDAGEM", documento: "SONDAGEM" },
  lev: {
    ui: "Levantamento",
    capa: "LEVANTAMENTO ARQUITETÔNICO",
    documento: "PROJETO DE LEVANTAMENTO ARQUITETÔNICO",
  },
  gmt: { ui: "Geométrico", capa: "DESENHO GEOMÉTRICO", documento: "DESENHO GEOMÉTRICO" },
  ter: { ui: "Terraplenagem", capa: "PROJETO DE TERRAPLENAGEM", documento: "PROJETO DE TERRAPLENAGEM" },
  dre: { ui: "Drenagem", capa: "PROJETO DE DRENAGEM", documento: "PROJETO DE DRENAGEM" },
  pav: { ui: "Pavimentação", capa: "PROJETO DE PAVIMENTAÇÃO", documento: "PROJETO DE PAVIMENTAÇÃO" },
};

/**
 * PARES que o escritório emite sob UMA separatriz só.
 *
 * `gmt` e `ter` às vezes andam juntos: a separatriz real de 040-26 diz
 * "PROJETO DE GEOMETRIA E TERRAPLENAGEM", que não é a junção mecânica dos dois
 * nomes ("PROJETO DE DESENHO GEOMÉTRICO e PROJETO DE TERRAPLENAGEM"). Nome de
 * par é nome próprio, então mora aqui.
 *
 * A chave é a dupla de códigos em ORDEM ALFABÉTICA, para a busca não depender de
 * quem foi fundido primeiro.
 */
export const NOME_DO_PAR: Record<string, string> = {
  "gmt+ter": "PROJETO DE GEOMETRIA E TERRAPLENAGEM",
};

/** O nome do par, se este for um par nomeado. */
export function nomeDoPar(codigoA: string, codigoB: string): string | undefined {
  const chave = [codigoA.toLowerCase(), codigoB.toLowerCase()].sort().join("+");
  return NOME_DO_PAR[chave];
}

/**
 * Compatibilidade: o mapa código→rótulo de UI que o resto do sistema já usa
 * para CASAR disciplina (parse do nome de arquivo, léxico dos blocos).
 *
 * Derivado, nunca escrito à mão — duas listas divergiriam, e este repositório
 * já pagou caro por verdade duplicada.
 */
export const DISCIPLINA_LEXICON: Record<string, string> = Object.fromEntries(
  Object.entries(DISCIPLINAS).map(([codigo, nomes]) => [codigo, nomes.ui]),
);

/** Codigos que sao secoes/tipos de documento, nao disciplinas. */
export const NAO_DISCIPLINA = new Set(["memorial", "md", "geral", "capa", "capas", "separatriz", "vol", "orcamento"]);

/** O nome curto de tela. Chips, canvas, resumo. */
export function disciplinaLabel(code: string): string | undefined {
  return DISCIPLINAS[code.toLowerCase()]?.ui;
}

/** Como a disciplina sai na CAPA. */
export function nomeNaCapa(code: string): string | undefined {
  return DISCIPLINAS[code.toLowerCase()]?.capa;
}

/** Como a disciplina sai na SEPARATRIZ e no título da LD. */
export function nomeNoDocumento(code: string): string | undefined {
  return DISCIPLINAS[code.toLowerCase()]?.documento;
}
