/**
 * O CLIENTE DO PROJETO — a chave estável e a decisão do que gravar.
 *
 * `Project.client` é texto que humano lê e edita: "CRICIÚMA", "Criciúma" e
 * "Prefeitura Municipal de Criciúma" são a MESMA prefeitura escritas por três
 * pessoas. Agrupar o histórico ou pintar uma cor por esse texto daria três
 * grupos e três cores para um cliente só.
 *
 * `clientKey` é o slug do MUNICÍPIO, e ele não muda quando alguém corrige a
 * grafia — é isso que o torna utilizável como chave de agrupamento e de cor.
 *
 * NÃO é o id do template de capa (`pmcriciuma`): IÇARA não tem template, e
 * amarrar a identidade do cliente à existência de um modelo de capa deixaria
 * projetos reais sem chave. O template aponta para o município, não o inverso.
 *
 * PURO e sem imports → roda em node cru (`npm run test:cliente`).
 */

/**
 * Palavras que TODA prefeitura tem no nome e por isso não distinguem nenhuma.
 *
 * É a mesma lista de `GENERICOS` em `server/nexo/agent/normalize.ts`, e pela
 * mesma razão: sem ela "prefeitura" seria token de todas. Duplicada de
 * propósito — aquele arquivo importa tipos do agente, e este precisa rodar em
 * node cru.
 */
const GENERICOS = new Set([
  "prefeitura",
  "pref",
  "municipal",
  "municipio",
  "governo",
  "estado",
  "secretaria",
  "padrao",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
]);

/**
 * As unidades da federação. "Criciúma - SC" e "Criciúma" são o mesmo município,
 * e sem esta lista virariam duas chaves.
 *
 * A lista é fechada e de duas letras: cortar QUALQUER token de duas letras
 * comeria o "sé" de nomes legítimos.
 */
const UFS = new Set([
  "ac",
  "al",
  "am",
  "ap",
  "ba",
  "ce",
  "df",
  "es",
  "go",
  "ma",
  "mg",
  "ms",
  "mt",
  "pa",
  "pb",
  "pe",
  "pi",
  "pr",
  "rj",
  "rn",
  "ro",
  "rr",
  "rs",
  "sc",
  "se",
  "sp",
  "to",
]);

/** Minúsculas, sem acento — a base da comparação. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR");
}

/**
 * `"Prefeitura Municipal de São José"` → `"sao-jose"`.
 *
 * Devolve `""` quando não sobra nada que identifique um município — e vazio é
 * desfecho legítimo, não falha: um projeto sem cliente é um projeto sem
 * cliente, e inventar uma chave o faria agrupar com quem não é dele.
 *
 * A ENTRADA IDEAL É O MUNICÍPIO. Passar um órgão de nome longo ("Secretaria de
 * Desenvolvimento Sustentável e Obras Estruturantes") produz uma chave longa e
 * determinística, não um erro — e ela é corrigível em `/projetos`, que é onde a
 * decisão de gente vence.
 */
export function slugDoCliente(valor: string | null | undefined): string {
  const tokens = normalizar(valor ?? "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !GENERICOS.has(t) && !UFS.has(t));

  return tokens.join("-");
}

export type DecisaoDeCliente = {
  /** O texto a gravar em `client`. Igual ao atual quando não se preenche. */
  client: string;
  /** O slug a gravar em `clientKey`. Nunca fica vazio se há `client`. */
  clientKey: string;
  /** Preencheu um campo que estava em branco. */
  preencheu: boolean;
  /** Cadastro e leitura discordam. Vira `ProjectEvent`, nunca uma pergunta. */
  divergencia: { cadastrado: string; lido: string } | null;
};

/**
 * O QUE GRAVAR no cliente do projeto, dadas as quatro situações do desenho.
 *
 * A regra que muda de comportamento é a segunda: cliente VAZIO passa a ser
 * preenchido pelo que a classificação leu. O comentário de
 * `por-centro-de-custo/route.ts` diz que "o cadastro de quem o criou vale mais
 * do que a leitura de um PDF qualquer", e continua certo — mas **vazio não é
 * cadastro**, e hoje ninguém digita prefeitura em lugar nenhum do produto.
 */
export function decidirCliente(args: {
  atual: string;
  atualKey: string;
  lido: string;
  municipioLido: string;
}): DecisaoDeCliente {
  const atual = (args.atual ?? "").trim();
  const lido = (args.lido ?? "").trim();
  /*
   * A chave sai do MUNICÍPIO quando ele existe: o órgão pode ser uma secretaria
   * de nome longo, e o município é o que identifica o cliente.
   */
  const chaveLida = slugDoCliente(args.municipioLido || lido);

  if (!atual) {
    /* Preencher o branco. Não desrespeita decisão nenhuma — não havia decisão. */
    return {
      client: lido,
      clientKey: lido ? chaveLida : "",
      preencheu: Boolean(lido),
      divergencia: null,
    };
  }

  /*
   * O cadastro fica. A chave é recalculada quando está em branco — é o estado
   * que a migração deixa nos projetos que já existiam.
   */
  const chaveAtual = (args.atualKey ?? "").trim() || slugDoCliente(atual);

  /* Sem leitura não há com o que divergir. */
  if (!lido) {
    return { client: atual, clientKey: chaveAtual, preencheu: false, divergencia: null };
  }

  /*
   * A CHAVE é quem decide se é o mesmo cliente. "Pref. Mun. de Criciúma" e
   * "CRICIÚMA" dão a mesma chave, e alarmar sobre isso seria ruído de grafia.
   */
  const mesmo = chaveLida !== "" && chaveLida === chaveAtual;

  return {
    client: atual,
    clientKey: chaveAtual,
    preencheu: false,
    divergencia: mesmo ? null : { cadastrado: atual, lido },
  };
}
