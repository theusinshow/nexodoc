/**
 * A FICHA DO QUE ENTROU — a identidade do projeto, lida e mostrada.
 *
 * O recibo ([[recibo-do-drop.ts]]) responde "quantas folhas entraram"; esta
 * ficha responde "de que projeto elas são". Os dois fatos vinham na mesma
 * frase corrida — "66 recebidas · 66 lidas — MET · código 088-25 · obra EMEB
 * JOSÉ GIASSI. 66 folhas vieram de leitura anterior…" —, e o engenheiro, que
 * precisa CONFERIR se é o projeto certo antes de mandar gerar, tinha de
 * garimpar cada campo no meio da prosa.
 *
 * TUDO AQUI JÁ ESTAVA LIDO. Nenhum campo custa uma chamada de modelo: saem dos
 * mesmos carimbos que a leitura já pagou. O que faltava era mostrar.
 *
 * DUAS SEÇÕES, e a separação é o ponto: o que foi LIDO do carimbo (código,
 * obra, prefeitura, data) e o que é PROPOSTA do sistema (os títulos). Misturar
 * as duas faria a proposta parecer fato, e é a proposta que sai impressa na
 * capa sem ninguém ter olhado — o mesmo defeito que a nota de procedência do
 * título já existe para impedir.
 *
 * NÃO LIDO APARECE. Um campo que o carimbo não trouxe some da frase corrida e
 * ninguém sente falta; some da ficha e o engenheiro conclui que está lá. A
 * linha fica, dizendo que não foi lida.
 *
 * PURO e sem imports de runtime → roda em node cru
 * (`npm run test:nexo:ficha`).
 */

/** Uma linha da ficha: rótulo, valor, e se o valor veio mesmo do documento. */
export interface LinhaDaFicha {
  rotulo: string;
  valor: string;
  /** `false` = o carimbo não trouxe. A linha fica, o valor aparece apagado. */
  lido: boolean;
}

export interface FichaDoDrop {
  /** A conta que fecha, já montada por `reciboDoDrop`. */
  recibo: string;
  /** O que o CARIMBO diz — código, obra, prefeitura, data. */
  identidade: LinhaDaFicha[];
  /** O que o SISTEMA propõe — os títulos. Vazio quando não há o que propor. */
  propostos: LinhaDaFicha[];
}

/** Uma folha, no mínimo que a ficha precisa dela. */
export interface FolhaDaFicha {
  cliente?: string | null;
  logoOrgao?: string | null;
}

const MESES_DO_ANO = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

function limpar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

/**
 * O valor que MAIS FOLHAS sustentam.
 *
 * Dominância, e não "o primeiro que aparecer" — é a mesma regra do título e da
 * data: uma folha reaproveitada de outro projeto no meio do conjunto não
 * nomeia o volume inteiro.
 */
function dominante(valores: readonly (string | null | undefined)[]): string {
  const contagem = new Map<string, { valor: string; n: number }>();
  for (const bruto of valores) {
    const valor = limpar(bruto);
    if (!valor) continue;
    const chave = valor.toLocaleLowerCase("pt-BR");
    const atual = contagem.get(chave);
    if (atual) atual.n += 1;
    else contagem.set(chave, { valor, n: 1 });
  }
  let vencedor = "";
  let maior = 0;
  for (const { valor, n } of contagem.values()) {
    if (n > maior) {
      vencedor = valor;
      maior = n;
    }
  }
  return vencedor;
}

/**
 * A prefeitura, pelas DUAS evidências do carimbo — o campo CLIENTE e o brasão.
 *
 * A mesma ordem de `casarPrefeituraDoCarimbo`: o texto primeiro, o brasão como
 * reserva. Aqui não há casamento com template nenhum, e é de propósito — a
 * ficha mostra o que o CARIMBO diz, não a decisão do plano. Quando os dois
 * discordarem, quem resolve (ou recusa) é o casamento, lá.
 */
export function prefeituraDoCarimbo(folhas: readonly FolhaDaFicha[]): string {
  return (
    dominante(folhas.map((f) => f.cliente)) ||
    dominante(folhas.map((f) => f.logoOrgao))
  );
}

/** "MAIO/2026" a partir do que `dataDominante` apurou. */
export function dataPorExtenso(data: { mes: number; ano: number } | null): string {
  if (!data) return "";
  const nome = MESES_DO_ANO[data.mes - 1];
  return nome ? `${nome}/${data.ano}` : "";
}

export function fichaDoDrop(entrada: {
  recibo: string;
  codigo: string | null;
  obra: string | null;
  folhas: readonly FolhaDaFicha[];
  dataDoSelo: { mes: number; ano: number } | null;
  /**
   * Os nomes que a CAPA e a LD imprimem para as disciplinas deste conjunto, na
   * ordem, já resolvidos pelo léxico. Vazio = disciplina fora do léxico, e aí
   * não há título a propor.
   */
  nomesDasDisciplinas: readonly string[];
}): FichaDoDrop {
  const naoLido = (rotulo: string, valor: string): LinhaDaFicha =>
    valor ? { rotulo, valor, lido: true } : { rotulo, valor: "não lido", lido: false };

  const identidade: LinhaDaFicha[] = [
    naoLido("Código", limpar(entrada.codigo)),
    naoLido("Obra", limpar(entrada.obra)),
    naoLido("Prefeitura", prefeituraDoCarimbo(entrada.folhas)),
    naoLido("Data do selo", dataPorExtenso(entrada.dataDoSelo)),
  ];

  /*
   * O TÍTULO DA CAPA LISTA AS DISCIPLINAS; o da LD é UM POR BLOCO.
   *
   * Não é a mesma frase escrita duas vezes: num volume misto — seis dos oito
   * reais — a capa lista as disciplinas do volume e cada LD imprime só a da
   * sua. Mostrar o mesmo valor nos dois prometeria uma LD que não vai sair
   * assim. Ver `titulosPropostos`, em [[titulo-do-selo.ts]].
   */
  const nomes = entrada.nomesDasDisciplinas.filter(Boolean);
  const propostos: LinhaDaFicha[] = [];
  if (nomes.length === 1) {
    propostos.push({ rotulo: "Título da capa", valor: nomes[0], lido: true });
    propostos.push({ rotulo: "Título da LD", valor: nomes[0], lido: true });
  } else if (nomes.length > 1) {
    propostos.push({ rotulo: "Título da capa", valor: nomes.join("\n"), lido: true });
    propostos.push({
      rotulo: "Título da LD",
      valor: `um por disciplina — ${nomes.join(", ")}`,
      lido: true,
    });
  }

  return { recibo: entrada.recibo, identidade, propostos };
}
