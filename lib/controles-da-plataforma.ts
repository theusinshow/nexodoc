/**
 * OS CONTROLES QUE O PAINEL REGULA — a definição e as guardas, sem banco.
 *
 * Quatro coisas que só existiam em variável de ambiente passam a ser editáveis:
 * o teto de gasto, a vazão de auditorias simultâneas, o freio do cadastro
 * automático e os limites de leitura. Mudar qualquer uma delas exigia deploy —
 * e "exigia deploy" era, na prática, a única guarda que havia contra um valor
 * absurdo.
 *
 * TIRAR O DEPLOY DO CAMINHO OBRIGA A PÔR A GUARDA NO CÓDIGO. Um campo de texto
 * num painel aceita `0`, aceita `999999` e aceita o que o dedo escorregar. Dois
 * deles derrubam o container (a vazão) e dois mudam o que a auditoria acha (a
 * cobertura e o teto de saída) — este último já produziu auditoria parcial em
 * silêncio uma vez, quando ainda era variável de ambiente.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:controles`).
 */

export type ChaveDeControle =
  | "teto.mensal.usd"
  | "teto.global.usd"
  | "vazao.usuario"
  | "vazao.global"
  | "limites.blocosPorArquivo"
  | "limites.concorrencia"
  | "limites.timeoutMs"
  | "limites.saidaProfundo";

export interface DefinicaoDeControle {
  chave: ChaveDeControle;
  rotulo: string;
  /** O que ele protege, escrito para quem vai digitar o número. */
  descricao: string;
  /** A variável que continua valendo quando o banco não diz nada. */
  variavel: string;
  minimo: number;
  maximo: number;
  /**
   * O que vale sem banco e sem ambiente.
   *
   * `null` significa NÃO DECLARADO, e é diferente de zero: teto zero recusaria
   * tudo, teto ausente não freia nada.
   *
   * OS QUATRO LIMITES DE LEITURA SÃO TODOS `null` DE PROPÓSITO. O padrão deles
   * não é um número: é a regra do motor, que depende do nível da análise
   * (Profundo lê 24 blocos, Padrão lê 8) e do modo de cobertura total. Declarar
   * um número aqui faria o Padrão passar a ler 24 no dia em que este arquivo
   * nasceu — uma mudança de custo e de resultado que ninguém pediu.
   */
  padrao: number | null;
  /** Só para a tela saber como escrever o número. */
  unidade: "usd" | "auditorias" | "blocos" | "ms" | "tokens";
}

export const CONTROLES: readonly DefinicaoDeControle[] = [
  {
    chave: "teto.mensal.usd",
    rotulo: "Teto de gasto por conta, no mês",
    descricao:
      "Barreira de ENTRADA: mede o que já foi registrado, então não freia auditoria em voo. Sem valor, não há teto.",
    variavel: "NEXODOC_MONTHLY_BUDGET_USD",
    minimo: 1,
    maximo: 100_000,
    padrao: null,
    unidade: "usd",
  },
  {
    chave: "teto.global.usd",
    rotulo: "Teto de gasto do sistema, no mês",
    descricao:
      "Vale para o consumo sem dono identificado — que é justamente o caminho sem ninguém a cobrar.",
    variavel: "NEXODOC_GLOBAL_MONTHLY_BUDGET_USD",
    minimo: 1,
    maximo: 1_000_000,
    padrao: null,
    unidade: "usd",
  },
  {
    chave: "vazao.usuario",
    rotulo: "Auditorias simultâneas por pessoa",
    descricao:
      "Contra quem dispara cinco de uma vez. Ninguém acompanha três auditorias ao mesmo tempo de verdade.",
    variavel: "NEXODOC_MAX_AUDITORIAS_SIMULTANEAS",
    minimo: 1,
    maximo: 20,
    padrao: null,
    unidade: "auditorias",
  },
  {
    chave: "vazao.global",
    rotulo: "Auditorias simultâneas no sistema",
    descricao:
      "É ESTE que protege a memória: cada auditoria segura um PDF de até 25 MB. A conta vive no processo — com mais de uma instância, cada uma conta a sua.",
    variavel: "NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL",
    minimo: 1,
    maximo: 50,
    padrao: null,
    unidade: "auditorias",
  },
  {
    chave: "limites.blocosPorArquivo",
    rotulo: "Blocos lidos por arquivo",
    descricao:
      "É COBERTURA: menos blocos, menos documento lido. Entra na versão do auditor, então mexer aqui invalida o reuso das auditorias anteriores.",
    variavel: "NEXODOC_MAX_CHUNKS_PER_FILE",
    minimo: 1,
    maximo: 200,
    padrao: null,
    unidade: "blocos",
  },
  {
    chave: "limites.concorrencia",
    rotulo: "Blocos em paralelo",
    descricao: "Quantos blocos vão ao modelo ao mesmo tempo. Mexe na velocidade e na memória, não no que se acha.",
    variavel: "NEXODOC_CHUNK_CONCURRENCY",
    minimo: 1,
    maximo: 20,
    padrao: null,
    unidade: "blocos",
  },
  {
    chave: "limites.timeoutMs",
    rotulo: "Tempo máximo por bloco",
    descricao: "Quando desistir de um bloco. Baixo demais transforma bloco lento em bloco perdido.",
    variavel: "NEXODOC_CHUNK_TIMEOUT_MS",
    minimo: 10_000,
    maximo: 600_000,
    padrao: null,
    unidade: "ms",
  },
  {
    chave: "limites.saidaProfundo",
    rotulo: "Teto de saída do bloco (Profundo)",
    descricao:
      "Quanto o modelo pode escrever por bloco. Baixo demais CENSURA achado no meio da frase, e a auditoria fica parcial sem dizer. Entra na versão do auditor.",
    variavel: "NEXODOC_DEEP_CHUNK_MAX_OUTPUT_TOKENS",
    minimo: 2_000,
    maximo: 100_000,
    padrao: null,
    unidade: "tokens",
  },
] as const;

export function definicaoDoControle(chave: string): DefinicaoDeControle | null {
  return CONTROLES.find((controle) => controle.chave === chave) ?? null;
}

export type OrigemDoControle = "banco" | "ambiente" | "padrao";

export interface ValorDoControle {
  valor: number | null;
  origem: OrigemDoControle;
}

/**
 * A escada: banco → ambiente → padrão.
 *
 * `null` NO BANCO É UM VALOR, não ausência: é o administrador dizendo "não quero
 * teto", e ele tem que vencer a variável de ambiente. Por isso o parâmetro é
 * `undefined` quando não há linha — a distinção entre "não declarado" e
 * "declarado como nenhum" é a diferença entre respeitar e ignorar a decisão de
 * quem configurou.
 */
export function resolverControle(
  definicao: DefinicaoDeControle,
  doBanco: number | null | undefined,
  doAmbiente: string | undefined,
): ValorDoControle {
  if (doBanco !== undefined) {
    return { valor: doBanco, origem: "banco" };
  }

  const bruto = doAmbiente?.trim();

  if (bruto) {
    const numero = Number(bruto);
    /*
     * Variável ilegível cai para o padrão em vez de estourar. O ambiente é
     * digitado no painel do provedor, sem validação nenhuma, e um deploy que
     * morre por causa de um espaço a mais é pior que um valor de fábrica.
     */
    if (Number.isFinite(numero) && numero > 0) {
      return { valor: numero, origem: "ambiente" };
    }
  }

  return { valor: definicao.padrao, origem: "padrao" };
}

export type VereditoDoValor =
  | { ok: true; valor: number | null }
  | { ok: false; motivo: string };

/**
 * Valida o que veio da tela.
 *
 * VAZIO É "DESLIGAR", e é aceito de propósito: é como se tira um teto sem
 * precisar de deploy. Zero NÃO é — zero é um número, e um teto de zero recusa
 * todo trabalho enquanto parece configuração legítima.
 */
export function validarValorDoControle(chave: string, bruto: unknown): VereditoDoValor {
  const definicao = definicaoDoControle(chave);

  if (!definicao) return { ok: false, motivo: "Controle desconhecido." };

  if (bruto === null || bruto === "" || bruto === undefined) {
    return { ok: true, valor: null };
  }

  const numero = typeof bruto === "number" ? bruto : Number(String(bruto).trim().replace(",", "."));

  if (!Number.isFinite(numero)) {
    return { ok: false, motivo: `${definicao.rotulo}: informe um número.` };
  }

  if (numero < definicao.minimo || numero > definicao.maximo) {
    return {
      ok: false,
      motivo: `${definicao.rotulo}: aceita de ${definicao.minimo} a ${definicao.maximo}.`,
    };
  }

  return { ok: true, valor: numero };
}

/* ─────────────────────── o freio do cadastro automático ─────────────────── */

/**
 * TRÊS ESTADOS, e achatá-los em booleano perderia um caso.
 *
 * - `prosul`   — variável ausente: quem chega entra na PROSUL como MEMBER;
 * - `convite`  — variável definida e VAZIA: exige convite;
 * - `outra`    — variável definida com um id: outro escritório.
 *
 * O que a tela precisa dizer junto: o login é Google, então "prosul" significa
 * que QUALQUER conta Google que abrir o site vira membro e enxerga os projetos.
 */
export type FreioDoCadastro = "prosul" | "convite" | "outra";

export function lerFreio(valor: string | null | undefined): {
  estado: FreioDoCadastro;
  organizationId: string | null;
} {
  if (valor === undefined || valor === null) {
    return { estado: "prosul", organizationId: "org-prosul" };
  }

  const limpo = valor.trim();

  if (!limpo) return { estado: "convite", organizationId: null };
  if (limpo === "org-prosul") return { estado: "prosul", organizationId: "org-prosul" };

  return { estado: "outra", organizationId: limpo };
}

/** O inverso: do que a tela escolheu para o que se grava. */
export function escreverFreio(estado: FreioDoCadastro, organizationId?: string | null): string | null {
  if (estado === "convite") return "";
  if (estado === "prosul") return "org-prosul";

  const limpo = organizationId?.trim();

  /*
   * "outra" sem id não vira ausência: viraria PROSUL em silêncio, que é o
   * oposto do que quem escolheu "outro escritório" pediu.
   */
  return limpo ? limpo : null;
}
