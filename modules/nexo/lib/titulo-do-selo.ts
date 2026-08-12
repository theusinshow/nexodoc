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
