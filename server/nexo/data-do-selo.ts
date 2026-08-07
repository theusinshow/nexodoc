/**
 * A DATA que o carimbo traz, normalizada para mês + ano.
 *
 * Carimbo não tem padrão: os projetos reais trazem "JUNHO/2026", "JUN/26",
 * "06/2026" e "12/06/2026", e o texto chega junto com o rótulo ("DATA: ..."). O
 * dia é descartado — a capa imprime mês/ano.
 *
 * Acento é opcional de propósito: o texto de algumas pranchas vem de fonte sem
 * mapa de caracteres, e "MARÇO" chega como "MARCO". Recusar aí seria descartar a
 * folha por um defeito de fonte, que é o mesmo motivo de `texto-cad.ts` existir.
 *
 * A ESCALA é o vizinho perigoso: "1:50" tem a forma de dois números separados, e
 * o carimbo a imprime coladinha na data. Por isso `:` NÃO é separador aceito.
 *
 * PURO: sem imports e sem relógio, para rodar em node cru
 * (`scripts/test-nexo-data-do-selo.ts`). Ano de dois dígitos vira 20NN — é o
 * único século em que este software é usado, e "26" nunca quis dizer 1926.
 */

/** Nome do mês → número. Chaves sem acento: `norm` normaliza antes de consultar. */
const MESES: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

/** Minúsculas sem acento — "MARÇO" e "MARCO" têm de chegar na mesma chave. */
function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** "26" -> 2026; "2026" -> 2026; qualquer outra coisa -> null. */
function anoCheio(n: number): number | null {
  if (!Number.isInteger(n)) return null;
  if (n >= 1900 && n <= 2999) return n;
  if (n >= 0 && n <= 99) return 2000 + n;
  return null;
}

export function parseDataDoSelo(
  texto: string | null | undefined,
): { mes: number; ano: number } | null {
  const t = norm((texto ?? "").trim());
  if (!t) return null;

  // 1) Mês por nome (extenso ou abreviado) seguido do ano.
  const porNome = t.match(/([a-z]{3,9})\s*[/\-. ]\s*(\d{2,4})/);
  if (porNome) {
    const mes = MESES[porNome[1]];
    const ano = anoCheio(Number(porNome[2]));
    if (mes && ano !== null) return { mes, ano };
  }

  /*
   * 2) Só números. Com três grupos o primeiro é o DIA e é descartado; com dois,
   * o primeiro é o mês. Ancorar no ÚLTIMO par (mês, ano) — via lookahead que
   * recusa mais um grupo à frente — resolve os dois casos sem precisar saber de
   * antemão quantos vieram.
   */
  const porNumero = t.match(/(\d{1,2})\s*[/\-.]\s*(\d{2,4})(?!\s*[/\-.]\s*\d)/);
  if (porNumero) {
    const mes = Number(porNumero[1]);
    const ano = anoCheio(Number(porNumero[2]));
    if (mes >= 1 && mes <= 12 && ano !== null) return { mes, ano };
  }

  return null;
}

/**
 * A data DOMINANTE de um conjunto de folhas.
 *
 * Uma folha com a data mal lida não pode arrastar o volume inteiro — e EMPATE
 * NÃO É MAIORIA: sem vencedor, devolve null e o campo volta a ser perguntável,
 * em vez de o software decidir no cara ou coroa qual data vai na capa.
 *
 * `divergentes` conta as folhas que trazem data legível DIFERENTE da vencedora.
 * Folha ilegível não conta como divergência: ela não discorda de nada.
 */
export function dataDominante(
  textos: (string | null | undefined)[],
): { mes: number; ano: number; folhas: number; divergentes: number } | null {
  const contagem = new Map<string, { mes: number; ano: number; n: number }>();
  let lidas = 0;

  for (const texto of textos) {
    const d = parseDataDoSelo(texto);
    if (!d) continue;
    lidas++;
    const chave = `${d.ano}-${d.mes}`;
    const atual = contagem.get(chave);
    if (atual) atual.n++;
    else contagem.set(chave, { mes: d.mes, ano: d.ano, n: 1 });
  }

  let melhor: { mes: number; ano: number; n: number } | null = null;
  let empatado = false;
  for (const v of contagem.values()) {
    if (!melhor || v.n > melhor.n) {
      melhor = v;
      empatado = false;
    } else if (v.n === melhor.n) {
      empatado = true;
    }
  }

  if (!melhor || empatado) return null;
  return {
    mes: melhor.mes,
    ano: melhor.ano,
    folhas: melhor.n,
    divergentes: lidas - melhor.n,
  };
}
