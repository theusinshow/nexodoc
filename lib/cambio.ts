/**
 * O CÂMBIO DECLARADO — e por que ele é declarado, não buscado.
 *
 * O painel de consumo fala em dólar porque é a moeda da fatura do provedor. Só
 * que quem decide se vale rodar o Profundo raciocina em real, e converter de
 * cabeça a cada olhada é o tipo de atrito que faz o painel não ser aberto.
 *
 * A cotação NÃO é buscada de uma API. Três razões, nesta ordem:
 *
 * 1. Cotação buscada envelhece em silêncio. Uma chamada que falha devolve o
 *    último valor, e ninguém vê a diferença entre "hoje" e "de três semanas
 *    atrás" — o painel passaria a mentir com cara de precisão.
 * 2. O número que o escritório usa para precificar é o do CONTADOR, não o do
 *    mercado à vista. Fazer o produto discordar da planilha dele seria criar
 *    uma terceira verdade.
 * 3. É o único jeito de o produto dizer honestamente DE QUANDO é o número.
 *
 * Por isso todo valor convertido sai com "≈" e acompanhado da data da cotação.
 * Sem cotação declarada, não há real na tela: o dólar aparece sozinho. Inventar
 * uma taxa seria pior que não converter.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:cambio`).
 */

export interface CotacaoDeclarada {
  /** Quantos reais valem um dólar. Zero = não declarada. */
  valor: number;
  /** Quando foi declarada, em ISO. Vazio = não declarada. */
  declaradaEm: string;
  /** Quem declarou, para a linha de procedência. */
  declaradaPor: string;
}

export const COTACAO_NAO_DECLARADA: CotacaoDeclarada = {
  valor: 0,
  declaradaEm: "",
  declaradaPor: "",
};

/** Acima disto é dedo escorregado, não câmbio. */
const TETO = 100;

export function normalizarCotacao(bruto: unknown): CotacaoDeclarada {
  const fonte = (bruto ?? {}) as Partial<Record<keyof CotacaoDeclarada, unknown>>;
  const cru = fonte.valor;
  const numero =
    typeof cru === "number"
      ? cru
      : // Aceita "5,42" e "5.42": o teclado brasileiro dá vírgula, e recusar a
        // vírgula aqui seria recusar o jeito certo de escrever.
        parseFloat(String(cru ?? "").replace(",", "."));

  return {
    valor: Number.isFinite(numero) && numero > 0 ? numero : 0,
    declaradaEm: typeof fonte.declaradaEm === "string" ? fonte.declaradaEm.trim() : "",
    declaradaPor: typeof fonte.declaradaPor === "string" ? fonte.declaradaPor.trim() : "",
  };
}

/** O que impede de salvar. Cotação zerada é válida: é "apagar a cotação". */
export function validarCotacao(cotacao: CotacaoDeclarada): string[] {
  const erros: string[] = [];
  if (cotacao.valor < 0) erros.push("A cotação não pode ser negativa.");
  if (cotacao.valor > TETO) {
    erros.push(`Cotação acima de ${TETO} — confira: o campo espera reais por dólar.`);
  }
  return erros;
}

export function cotacaoDeclarada(cotacao: CotacaoDeclarada): boolean {
  return cotacao.valor > 0;
}

/** Reais a partir de dólares. `null` quando não há cotação — nunca zero. */
export function emReais(usd: number | null | undefined, cotacao: CotacaoDeclarada): number | null {
  if (!cotacaoDeclarada(cotacao)) return null;
  if (typeof usd !== "number" || !Number.isFinite(usd)) return null;
  return usd * cotacao.valor;
}

/**
 * O real formatado, SEMPRE com "≈". Devolve "" quando não há cotação, e quem
 * chama simplesmente não desenha a linha — em vez de desenhar "R$ 0,00", que
 * seria um fato falso.
 */
export function formatarReais(
  usd: number | null | undefined,
  cotacao: CotacaoDeclarada,
): string {
  const reais = emReais(usd, cotacao);
  if (reais === null) return "";
  return `≈ ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(reais)}`;
}

/** Há quantos dias inteiros a cotação foi declarada. `null` se não há data. */
export function idadeDaCotacaoEmDias(cotacao: CotacaoDeclarada, agora: Date): number | null {
  if (!cotacao.declaradaEm) return null;
  const quando = new Date(cotacao.declaradaEm);
  if (Number.isNaN(quando.getTime())) return null;
  return Math.floor((agora.getTime() - quando.getTime()) / 86_400_000);
}

/**
 * A partir de quantos dias a cotação merece aviso. Trinta: um mês de fatura é o
 * ciclo em que este painel é lido, e dentro dele a variação normal do câmbio
 * não muda nenhuma decisão.
 */
export const DIAS_ATE_ENVELHECER = 30;

/**
 * A linha de procedência que acompanha todo real da tela. Nunca some: valor sem
 * origem declarada é o que este produto existe para não produzir.
 */
export function procedenciaDaCotacao(cotacao: CotacaoDeclarada, agora: Date): string {
  if (!cotacaoDeclarada(cotacao)) {
    return "cotação não declarada — os valores ficam em dólar";
  }

  const valor = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(cotacao.valor);
  const idade = idadeDaCotacaoEmDias(cotacao, agora);

  if (idade === null) return `cotação declarada: R$ ${valor} por US$ 1`;
  const quando =
    idade <= 0 ? "hoje" : idade === 1 ? "ontem" : `há ${idade} dias`;
  const envelheceu = idade >= DIAS_ATE_ENVELHECER ? " — vale revisar" : "";

  return `cotação declarada ${quando}: R$ ${valor} por US$ 1${envelheceu}`;
}
