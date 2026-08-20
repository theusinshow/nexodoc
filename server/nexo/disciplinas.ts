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

/**
 * OS GRUPOS TÉCNICOS do escritório — quem responde pela disciplina.
 *
 * Vieram da tabela que o escritório padronizou (`docs/samples/`, 14/08/2026).
 * `orcamento` e `diretoria` não têm disciplina nenhuma: existem porque há GENTE
 * neles, e o grupo também classifica pessoa.
 */
export type GrupoTecnico =
  | "arquitetura"
  | "estrutural"
  | "complementares"
  | "orcamento"
  | "externo"
  | "diretoria";

export const GRUPOS_TECNICOS: Record<GrupoTecnico, string> = {
  arquitetura: "Arquitetura",
  estrutural: "Estrutural",
  complementares: "Complementares",
  orcamento: "Orçamento",
  externo: "Externo",
  diretoria: "Diretoria",
};

export interface NomesDaDisciplina {
  /** Chips, canvas, resumo — o nome curto de tela. */
  ui: string;
  /** A linha da disciplina na CAPA. */
  capa: string;
  /** A SEPARATRIZ e o título da LD. */
  documento: string;
  /** Quem responde por ela. */
  grupo: GrupoTecnico;
  /**
   * AS EXCEÇÕES, e não três "sim" repetidos dezesseis vezes.
   *
   * A tabela do escritório traz `tem_ld`, `tem_separatriz` e `tem_capa` por
   * disciplina — e hoje elas carregam UMA regra só: sondagem não tem lista de
   * documentos. Escrever `temLd: true` em quinze linhas para marcar uma
   * exceção esconde justamente a exceção, que é o que alguém precisa enxergar
   * ao ler a tabela.
   *
   * Quando surgir a segunda, ela entra do mesmo jeito — como negativa explícita.
   */
  semLd?: true;
  semSeparatriz?: true;
  semCapa?: true;
}

export const DISCIPLINAS: Record<string, NomesDaDisciplina> = {
  // ---------------------------------------------------- Arquitetura / estrutura
  arq: { ui: "Arquitetônico", capa: "PROJETO ARQUITETÔNICO", documento: "PROJETO ARQUITETÔNICO", grupo: "arquitetura" },
  urb: { ui: "Urbanismo", capa: "PROJETO DE URBANIZAÇÃO", documento: "PROJETO DE URBANIZAÇÃO", grupo: "arquitetura" },
  psg: { ui: "Paisagismo", capa: "PROJETO DE PAISAGISMO", documento: "PROJETO DE PAISAGISMO", grupo: "arquitetura" },
  mqt: { ui: "Maquete", capa: "MAQUETE ELETRÔNICA", documento: "MAQUETE ELETRÔNICA", grupo: "arquitetura" },
  fnd: { ui: "Fundações", capa: "PROJETO DE FUNDAÇÕES", documento: "PROJETO DE FUNDAÇÕES", grupo: "estrutural" },
  est: { ui: "Estrutural", capa: "PROJETO ESTRUTURAL CONCRETO", documento: "PROJETO ESTRUTURAL CONCRETO", grupo: "estrutural" },
  met: { ui: "Estrutura metálica", capa: "PROJETO ESTRUTURAL METÁLICO", documento: "PROJETO ESTRUTURAL METÁLICO", grupo: "estrutural" },

  // ------------------------------------------------------------------ Instalações
  elt: { ui: "Elétrico", capa: "PROJETO ELÉTRICO", documento: "PROJETO DE INSTALAÇÕES ELÉTRICAS", grupo: "complementares" },
  ele: { ui: "Elétrico", capa: "PROJETO ELÉTRICO", documento: "PROJETO DE INSTALAÇÕES ELÉTRICAS", grupo: "complementares" },
  cab: {
    ui: "Cabeamento estruturado",
    capa: "PROJETO DE CABEAMENTO ESTRUTURADO",
    documento: "PROJETO DE INSTALAÇÕES DE CABEAMENTO ESTRUTURADO",
    grupo: "complementares",
  },
  cft: { ui: "CFTV", capa: "PROJETO DE CFTV", documento: "PROJETO DE CFTV", grupo: "complementares" },
  cftv: { ui: "CFTV", capa: "PROJETO DE CFTV", documento: "PROJETO DE CFTV", grupo: "complementares" },
  his: {
    ui: "Hidrossanitário",
    capa: "PROJETO HIDROSSANITÁRIO",
    documento: "PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS",
    grupo: "complementares",
  },
  inc: {
    ui: "Preventivo contra incêndio",
    capa: "PROJETO PREVENTIVO",
    documento: "PROJETO PREVENTIVO CONTRA INCÊNDIO",
    grupo: "complementares",
  },
  spd: {
    ui: "SPDA",
    capa: "PROJETO SPDA",
    documento: "PROJETO DE SISTEMA DE PROTEÇÃO CONTRA DESCARGAS ATMOSFÉRICAS",
    grupo: "complementares",
  },
  cli: { ui: "Climatização", capa: "PROJETO DE CLIMATIZAÇÃO", documento: "PROJETO DE CLIMATIZAÇÃO", grupo: "externo" },
  gme: { ui: "Gases medicinais", capa: "PROJETO DE GASES MEDICINAIS", documento: "PROJETO DE GASES MEDICINAIS", grupo: "complementares" },

  // ---------------------------------------------------------------- Terra / infra
  top: { ui: "Topografia", capa: "LEVANTAMENTO TOPOGRÁFICO", documento: "LEVANTAMENTO TOPOGRÁFICO", grupo: "externo" },
  snd: { ui: "Sondagem", capa: "SONDAGEM", documento: "SONDAGEM", grupo: "externo", semLd: true },
  lev: {
    ui: "Levantamento",
    capa: "LEVANTAMENTO ARQUITETÔNICO",
    documento: "PROJETO DE LEVANTAMENTO ARQUITETÔNICO",
    grupo: "arquitetura",
  },
  gmt: { ui: "Geométrico", capa: "DESENHO GEOMÉTRICO", documento: "DESENHO GEOMÉTRICO", grupo: "externo" },
  ter: { ui: "Terraplenagem", capa: "PROJETO DE TERRAPLENAGEM", documento: "PROJETO DE TERRAPLENAGEM", grupo: "externo" },
  dre: { ui: "Drenagem", capa: "PROJETO DE DRENAGEM", documento: "PROJETO DE DRENAGEM", grupo: "externo" },
  pav: { ui: "Pavimentação", capa: "PROJETO DE PAVIMENTAÇÃO", documento: "PROJETO DE PAVIMENTAÇÃO", grupo: "externo" },
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

/**
 * Como a disciplina sai na CAPA — e no TÍTULO DA LD, que usa o mesmo nome.
 *
 * Os dois andam juntos nos documentos reais do escritório: a capa lista
 * "PROJETO HIDROSSANITÁRIO" e a LD se intitula "LISTA DE DOCUMENTOS PROJETO
 * HIDROSSANITÁRIO". Quem usa o nome longo é só a separatriz — ver
 * `nomeNaSeparatriz`, e não troque um pelo outro.
 */
export function nomeNaCapa(code: string): string | undefined {
  return DISCIPLINAS[code.toLowerCase()]?.capa;
}

/**
 * Como a disciplina sai na SEPARATRIZ — e SÓ nela.
 *
 * Chamava-se `nomeNoDocumento`, e o comentário dizia "na separatriz E no título
 * da LD". A segunda metade era falsa, e o nome genérico ("no documento") era o
 * que a tornava plausível: três chamadores leram assim e imprimiram o nome longo
 * na LD. Medido em 20/08/2026 contra os PDFs que o escritório entregou:
 *
 *   disciplina | separatriz                              | LD e capa
 *   -----------|-----------------------------------------|------------------------
 *   his        | PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS | PROJETO HIDROSSANITÁRIO
 *   inc        | PROJETO PREVENTIVO CONTRA INCÊNDIO      | PROJETO PREVENTIVO
 *   spd        | PROJETO DE SISTEMA DE PROTEÇÃO C.D.A.   | PROJETO SPDA
 *
 * A tabela acima já estava no léxico e já estava certa (`documento` e `capa`).
 * Quem errava era quem lia. O nome novo não deixa mais ler errado.
 */
export function nomeNaSeparatriz(code: string): string | undefined {
  return DISCIPLINAS[code.toLowerCase()]?.documento;
}

/**
 * OITO CÓDIGOS SEM GRUPO NA TABELA DO ESCRITÓRIO, e o grupo deles aqui é
 * INFERÊNCIA MINHA — não decisão de quem assina o projeto.
 *
 * A tabela padronizada traz 16 dos 24 códigos do léxico. Os que faltam foram
 * classificados por família óbvia (`fnd` com estrutural) ou por serem alias de
 * um código que a tabela já traz (`ele` = `elt`, `cftv` = `cft`).
 *
 * Está registrado porque a diferença importa no dia em que alguém discordar:
 * um grupo vindo da tabela é decisão do escritório; um daqui é chute educado, e
 * corrigir o segundo não contraria ninguém.
 */
export const GRUPO_INFERIDO = new Set(["ele", "cftv", "gme", "fnd", "lev", "gmt", "ter", "pav"]);

/** De que grupo técnico é esta disciplina. */
export function grupoDaDisciplina(code: string): GrupoTecnico | undefined {
  return DISCIPLINAS[code.toLowerCase()]?.grupo;
}

/**
 * A disciplina gera lista de documentos?
 *
 * Desconhecida responde SIM: o léxico não é exaustivo — chega código novo em
 * nome de arquivo antes de alguém cadastrá-lo — e o custo dos dois erros é
 * assimétrico. Gerar uma LD a mais é uma aba que se fecha; deixar de gerar a de
 * uma disciplina real é um documento faltando no volume entregue.
 */
export function temLd(code: string): boolean {
  return DISCIPLINAS[code.toLowerCase()]?.semLd !== true;
}

/** A disciplina tem separatriz? Mesma regra do `temLd`. */
export function temSeparatriz(code: string): boolean {
  return DISCIPLINAS[code.toLowerCase()]?.semSeparatriz !== true;
}

/** A disciplina tem capa? Mesma regra do `temLd`. */
export function temCapa(code: string): boolean {
  return DISCIPLINAS[code.toLowerCase()]?.semCapa !== true;
}

/**
 * Da disciplina do ACHADO (`FindingDiscipline`, que é o vocabulário da
 * auditoria) para o grupo técnico.
 *
 * São dois vocabulários mesmo, e juntá-los seria pior: o do achado é derivado
 * de texto e tem dez valores largos ("hidrossanitario"); o do léxico é o código
 * de três letras que aparece no nome do arquivo. Este mapa é a ponte, e ela é
 * pequena o bastante para ser lida de uma vez.
 *
 * `geral` NÃO tem grupo, e é o caso mais comum: a disciplina do achado sai de
 * varredura de texto e cai em `geral` quando nada casa. Quem consome isto
 * precisa continuar funcionando sem grupo.
 */
export function grupoDaDisciplinaDoAchado(disciplina: string): GrupoTecnico | undefined {
  const mapa: Record<string, GrupoTecnico> = {
    arquitetura: "arquitetura",
    paisagismo: "arquitetura",
    acessibilidade: "arquitetura",
    estrutural: "estrutural",
    hidrossanitario: "complementares",
    eletrico: "complementares",
    ppci: "complementares",
    cabeamento: "complementares",
    terraplenagem: "externo",
  };

  return mapa[disciplina];
}
