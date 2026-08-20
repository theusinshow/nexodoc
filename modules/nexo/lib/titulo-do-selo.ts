/**
 * O TÍTULO que o carimbo já sabe — para ninguém digitar o que está lá.
 *
 * Núcleo PURO (só `import type`) → testável com node cru:
 * `node scripts/test-nexo-titulo-do-selo.ts`.
 *
 * O campo OBRA do carimbo é o nome do empreendimento, que é exatamente o título
 * que a capa e a LD pedem. Ele já é lido em toda prancha e já vive no selo; até
 * agora o engenheiro digitava no chat uma informação que o próprio documento
 * trazia.
 *
 * A ordem de precedência NÃO muda: decisão do engenheiro > proposta do agente >
 * evidência do carimbo > vazio (que vira pergunta). Isto aqui é só o degrau que
 * faltava entre o agente e o vazio.
 */
import type { SeloForLd } from "../../../server/nexo/build-ld-proposal";

export interface TituloDoSelo {
  /** O título dominante, ou "" quando os carimbos não sustentam nenhum. */
  valor: string;
  /** Quantas folhas sustentam esse valor. */
  apoio: number;
  /** Quantas folhas dizem OUTRA coisa. Acima de zero, a evidência está dividida. */
  divergentes: number;
}

const VAZIO: TituloDoSelo = { valor: "", apoio: 0, divergentes: 0 };

function limpar(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\s+/g, " ").trim();
}

/** minúsculas sem acento, para agrupar "PREFEITURA" e "Prefeitura" no mesmo balde */
function chave(valor: string): string {
  return valor
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * O título dominante entre as folhas, com o apoio que ele tem.
 *
 * Dominância, e não "o primeiro que aparecer": uma prancha reaproveitada de
 * outro projeto no meio do conjunto não pode nomear o volume inteiro. E a
 * contagem de divergentes viaja junto porque a TELA precisa dela — preencher em
 * silêncio quando os carimbos discordam é o mesmo erro que já custou um volume
 * de Criciúma emitido como Florianópolis, só que no outro campo.
 */
export function tituloDoSelo(selos: readonly SeloForLd[]): TituloDoSelo {
  const grupos = new Map<string, { valor: string; contagem: number }>();

  for (const s of selos) {
    const valor = limpar(s.obra);
    if (valor.length < 3) continue;

    const k = chave(valor);
    const atual = grupos.get(k);

    if (atual) {
      atual.contagem += 1;
      continue;
    }

    grupos.set(k, { valor, contagem: 1 });
  }

  if (grupos.size === 0) return VAZIO;

  const ordenados = [...grupos.values()].sort((a, b) => b.contagem - a.contagem);
  const vencedor = ordenados[0];
  const divergentes = ordenados.slice(1).reduce((total, g) => total + g.contagem, 0);

  /*
   * EMPATE NÃO PREENCHE. Dois títulos com o mesmo apoio significam que o
   * conjunto não tem um nome só, e escolher um deles é palpite — justamente o
   * que este produto existe para não fazer. Fica vazio e vira pergunta.
   */
  if (ordenados.length > 1 && ordenados[1].contagem === vencedor.contagem) {
    return { valor: "", apoio: 0, divergentes: vencedor.contagem + divergentes };
  }

  return { valor: vencedor.valor, apoio: vencedor.contagem, divergentes };
}

/** O que o AGENTE propôs neste turno, quando propôs alguma coisa. */
export interface TitulosDoAgente {
  capa?: string | null;
  ld?: string | null;
}

/**
 * QUAL título cada documento recebe do carimbo — e qual NÃO recebe.
 *
 * O carimbo dá o campo OBRA, que é o nome do EMPREENDIMENTO. Esse é o título da
 * CAPA, e era esse o ponto de preencher pelo carimbo.
 *
 * O TÍTULO DA LD É OUTRA COISA. Ele é o cabeçalho de seção do documento, e o
 * que sai impresso ali é o nome de documento da DISCIPLINA — "PROJETO
 * ESTRUTURAL CONCRETO", "PROJETO HIDROSSANITÁRIO" —, lido de 91 capas e
 * separatrizes reais e guardado no léxico ([[disciplinas.ts]]). Num volume
 * misto há um por bloco, e cada LD imprime o da SUA disciplina.
 *
 * Os dois campos foram preenchidos com o mesmo valor do carimbo, e o estrago é
 * que a obra passou a nomear a seção de toda LD: `buildLdProposal` trata
 * `tituloLd` como DECISÃO DO ENGENHEIRO — o degrau mais alto —, então a obra
 * chegava por cima do léxico e o nome da disciplina nunca era consultado. Nos
 * volumes mistos (seis dos oito reais) as quatro LDs saíam com o mesmo título.
 *
 * Vazio aqui NÃO é buraco: é o que devolve a decisão a quem sabe dela. Vazio na
 * LD faz o léxico responder pela disciplina do bloco; vazio na capa vira
 * pergunta, que é a regra do empate.
 */
export function titulosPropostos(
  doAgente: TitulosDoAgente,
  doCarimbo: TituloDoSelo,
  /**
   * As DISCIPLINAS deste volume, uma por linha, com o nome de capa do léxico.
   *
   * É o que o slot do título da capa leva — e não a obra. A capa real tem os
   * dois campos, e a obra já ocupa o dela:
   *
   *   REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ   <- a obra
   *   PROJETO EXECUTIVO
   *   PROJETO HIDROSSANITÁRIO                       <- o slot do título
   *   PROJETO PREVENTIVO
   *   PROJETO SPDA
   *
   * Medido em 20/08/2026 contra a capa do volume 10 de 040-26: o Nexo imprimia
   * a obra nos DOIS, então ela saía duas vezes e as disciplinas do volume não
   * apareciam em lugar nenhum — quem lê a capa não ficava sabendo o que há
   * dentro. A lista já era montada em `PlanoDeGeracao` e servia só de fantasma
   * no campo.
   *
   * Vazio (disciplina fora do léxico) devolve a obra, que era o comportamento
   * de antes.
   */
  disciplinasDoVolume = "",
): { tituloCapa: string; tituloLd: string } {
  return {
    // A lista NÃO passa por `limpar`: ali a quebra de linha é a estrutura (uma
    // disciplina por linha), e colapsar espaço em branco a transformaria numa
    // linha só.
    tituloCapa: limpar(doAgente.capa) || disciplinasDoVolume.trim() || doCarimbo.valor,
    // Sem `|| doCarimbo.valor`: é aqui que a obra parava de ser o título da LD.
    tituloLd: limpar(doAgente.ld),
  };
}
