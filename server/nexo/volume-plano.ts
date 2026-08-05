/**
 * A EXPECTATIVA POR PÁGINA do volume montado — núcleo puro.
 *
 * A montagem sabe o que vai gerar: `buildVolumeParts` produz as partes na ordem
 * canônica, e `assembleVolume` diz quantas páginas cada uma contribuiu. O que
 * faltava era transformar isso na pergunta que a conferência precisa fazer:
 *
 *   a página 9 do PDF final deveria ser O QUÊ?
 *
 * Sem essa tabela, conferir o volume montado seria comparar o documento com uma
 * intuição. Com ela, cada página tem um gabarito, e discordar do gabarito é um
 * achado com página e nome.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-volume-check.ts`.
 * Por isso `PapelDaPagina` é redeclarado em vez de importado de `volume-parts.ts`.
 */

/** Espelha `VolumePartRole` de `volume-parts.ts`. Redeclarado: núcleo puro. */
export type PapelDaPagina = "capa" | "separatriz" | "ld" | "prancha";

/**
 * Quantas páginas uma parte contribui para o volume.
 *
 * A faixa `startPage`/`endPage` é 1-based e INCLUSIVA, e pode mentir: ela é
 * derivada dos selos, e o selo é lido de um carimbo. Uma faixa que estoura o
 * documento ou que começa antes da primeira página não pode virar contagem
 * negativa nem inflada — `buildRowPdf` copia só o que existe, e a conta aqui tem
 * de bater com o que ele realmente copiou. Se não bater, a conferência inteira
 * acusa um deslocamento que não existe.
 */
export function paginasDaParte(
  totalDoDocumento: number,
  startPage?: number,
  endPage?: number,
): number {
  if (!Number.isFinite(totalDoDocumento) || totalDoDocumento <= 0) return 0;
  const inicio = Math.max(1, Math.trunc(startPage ?? 1));
  const fim = Math.min(totalDoDocumento, Math.trunc(endPage ?? totalDoDocumento));
  return Math.max(0, fim - inicio + 1);
}

/** O que a LD promete de UMA folha. */
export interface FolhaEsperada {
  folha: number | null;
  total: number | null;
  /** Campo ARQUIVO. Nem toda família imprime o número da folha nele. */
  codigo: string | null;
  /** CONTEÚDO — a descrição técnica da prancha. */
  titulo: string | null;
}

/** Um bloco (disciplina) e as folhas que a LD dele lista, em ordem. */
export interface BlocoDoPlano {
  codigo: string;
  folhas: FolhaEsperada[];
}

/** Uma parte já montada, com quantas páginas ela contribuiu. */
export interface ParteDoPlano {
  papel: PapelDaPagina;
  nome: string;
  paginas: number;
  /** Código do bloco a que a parte pertence; a capa do volume não tem. */
  bloco?: string;
}

/** Uma parte como a montagem a devolveu: papel, nome e páginas — sem o bloco. */
export interface ParteDevolvida {
  role: string;
  name: string;
  paginas: number;
}

/**
 * Liga cada parte devolvida pela montagem ao seu BLOCO.
 *
 * O servidor devolve papel, nome e páginas, mas não a disciplina — e é a
 * disciplina que diz a qual LD aquela página deve obedecer. Reconstituir isso
 * por contagem erraria em silêncio se alguma parte fosse pulada (`pushPart`
 * ignora parte sem dados), e uma atribuição errada produz achados apontando
 * para a disciplina errada — pior do que não conferir.
 *
 * Por isso a lista de papéis esperados é remontada pela MESMA regra de
 * `buildVolumeParts` e CONFERIDA contra o que voltou. Discordou, devolve `null`:
 * quem chama diz que não deu para conferir, em vez de chutar.
 */
export function alinharPartes(
  esperadas: readonly { papel: PapelDaPagina; bloco: string }[],
  devolvidas: readonly ParteDevolvida[],
): ParteDoPlano[] | null {
  if (esperadas.length !== devolvidas.length) return null;
  for (let i = 0; i < esperadas.length; i++) {
    if (esperadas[i].papel !== devolvidas[i].role) return null;
  }
  return devolvidas.map((d, i) => ({
    papel: esperadas[i].papel,
    nome: d.name,
    paginas: d.paginas,
    bloco: esperadas[i].bloco,
  }));
}

/**
 * Os papéis que a montagem DEVERIA ter produzido, na ordem canônica de
 * `buildVolumeParts`: a capa (quando existe) e, por bloco, separatriz → LD →
 * uma parte por arquivo de prancha. Parte ausente não entra — é a mesma regra
 * de `pushPart`, e é ela que o alinhamento confere.
 */
export function papeisEsperados(
  temCapa: boolean,
  blocos: readonly {
    codigo: string;
    temSeparatriz: boolean;
    temLd: boolean;
    pranchas: number;
  }[],
): { papel: PapelDaPagina; bloco: string }[] {
  const saida: { papel: PapelDaPagina; bloco: string }[] = [];
  if (temCapa) saida.push({ papel: "capa", bloco: "" });
  for (const b of blocos) {
    if (b.temSeparatriz) saida.push({ papel: "separatriz", bloco: b.codigo });
    if (b.temLd) saida.push({ papel: "ld", bloco: b.codigo });
    for (let i = 0; i < b.pranchas; i++) saida.push({ papel: "prancha", bloco: b.codigo });
  }
  return saida;
}

/** O gabarito de UMA página do PDF final. */
export interface PaginaEsperada {
  /** 1-based no volume final. */
  pagina: number;
  papel: PapelDaPagina;
  /** "" para a capa do volume, que não pertence a bloco nenhum. */
  bloco: string;
  folha: number | null;
  total: number | null;
  codigo: string | null;
  titulo: string | null;
}

/**
 * Achata as partes em páginas e casa cada página de prancha com a folha que a
 * LD promete naquela posição.
 *
 * O gabarito de folha/código/título vem das LINHAS DA LD daquele bloco — a
 * mesma fonte que imprimiu a LD encadernada. É deliberado: a LD é o documento
 * que PROMETE o conteúdo do volume, e conferir o volume contra a promessa é
 * exatamente o que se quer.
 *
 * As folhas do bloco são consumidas EM ORDEM, uma por página de prancha. Não é
 * casamento por código porque o código não identifica a folha em toda família:
 * `est` imprime `040_26_est_001_a`, `arq` imprime `040_26_arq_a` em todas. A
 * posição é o único eixo que vale nas duas.
 *
 * Página de prancha sem folha correspondente na LD sai com tudo `null` — este
 * módulo DESCREVE, não julga. Acusar sobra ou falta é trabalho de
 * `volume-check-core.ts`, que é onde a severidade mora.
 */
export function montarPlanoDePaginas(
  partes: readonly ParteDoPlano[],
  blocos: readonly BlocoDoPlano[],
): PaginaEsperada[] {
  const folhasPorBloco = new Map<string, FolhaEsperada[]>();
  for (const bloco of blocos) folhasPorBloco.set(bloco.codigo, [...bloco.folhas]);
  const consumido = new Map<string, number>();

  const plano: PaginaEsperada[] = [];
  let pagina = 0;

  for (const parte of partes) {
    const bloco = parte.bloco ?? "";
    for (let i = 0; i < parte.paginas; i++) {
      pagina++;
      if (parte.papel !== "prancha") {
        plano.push({
          pagina,
          papel: parte.papel,
          bloco,
          folha: null,
          total: null,
          codigo: null,
          titulo: null,
        });
        continue;
      }

      const usadas = consumido.get(bloco) ?? 0;
      const esperada = folhasPorBloco.get(bloco)?.[usadas] ?? null;
      consumido.set(bloco, usadas + 1);

      plano.push({
        pagina,
        papel: "prancha",
        bloco,
        folha: esperada?.folha ?? null,
        total: esperada?.total ?? null,
        codigo: esperada?.codigo ?? null,
        titulo: esperada?.titulo ?? null,
      });
    }
  }

  return plano;
}
