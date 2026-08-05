/**
 * Projeção das folhas: o que o PDF diz + o que o usuário mudou.
 *
 * `selos` é INTOCÁVEL — é o que a IA leu do carimbo. As edições manuais moram
 * separadas, em `ajustes`, e a projeção aplica uma coisa sobre a outra:
 *
 *     folhas(selos, ajustes) → Folha[]
 *
 * A separação existe para que reler as pranchas nunca apague o que foi mudado à
 * mão, e para que se saiba sempre de onde veio cada valor. Ela também é o que
 * implementa a decisão "o grupo manda, o automático é só o palpite inicial":
 * a divisão em tomos é uma DERIVAÇÃO dos selos, o grupo desenhado é um AJUSTE, e
 * o ajuste entra por cima — sem nenhuma regra especial de precedência.
 *
 * PURO: nenhum import de runtime, para rodar em Node pelado no
 * `scripts/test-nexo-folhas.ts`. Por isso a divisão automática chega INJETADA
 * (`repartir`) em vez de importada — mantém a pureza sem duplicar a regra de
 * equilíbrio que já vive em `lib/ld/ld-rules`.
 */

import type { SeloForLd } from "../../../server/nexo/build-ld-proposal.ts";

/** Chave natural do par arquivo/página. Estável entre releituras do PDF. */
export type FolhaId = string;

/**
 * O que o usuário mudou numa folha. Todo campo é OPCIONAL, e ausente significa
 * "use o que o selo disse" — é isso que dá de graça `folhas(selos, {}) === selos`.
 */
export interface Ajuste {
  /** "mudar nome / mudar titulo" — vai para o `conteudo` da folha. */
  titulo?: string;
  /** "mudar classificação". */
  disciplina?: string;
  /**
   * Nº da prancha posto à mão. Vence o carimbo, o nome do arquivo e a
   * reconciliação por ordem de página (`SeloSheetInput.folhaManual`) — quem
   * digitou viu a prancha; o resto inferiu.
   */
  numero?: number;
  /** Código da prancha (campo ARQUIVO do carimbo), que sai na coluna ARQUIVOS. */
  arquivo?: string;
  /** O tomo que o usuário decidiu. Vence a divisão automática. */
  grupo?: number;
  /** Posição manual. Esparsa: mover uma folha não renumera as outras. */
  ordem?: number;
  /**
   * A folha NÃO faz parte deste conjunto: sai da LD, do volume e da conferência.
   *
   * É ajuste, e não exclusão do array de selos, pela mesma razão que todo o
   * resto: `selos` é o que a IA leu e não se reescreve. Assim a folha volta
   * inteira — com título corrigido e tudo — quando a remoção foi engano, e
   * reler as pranchas não ressuscita o que já se decidiu tirar.
   */
  removida?: boolean;
}

/** O selo com os ajustes já aplicados. É isto que a montagem lê. */
export interface Folha extends SeloForLd {
  id: FolhaId;
  /** Algum campo veio de ajuste — a interface marca o que foi tocado à mão. */
  editado: boolean;
  /**
   * O TEXTO foi reescrito (título ou disciplina). Diferente de `editado`, que é
   * verdadeiro para qualquer ajuste: depois que o primeiro arrasto congela a
   * divisão, TODA folha tem `grupo` — e a marca de "corrigido à mão" no canvas
   * acenderia em todas, mentindo sobre o que o usuário mexeu. Posição não é
   * leitura de carimbo.
   */
  editadoTexto: boolean;
  /**
   * A DISCIPLINA veio de uma pessoa, não do carimbo.
   *
   * Precisa ser distinguível porque é ela que decide em que bloco a folha entra
   * no volume, e a decisão automática prefere o NOME DO ARQUIVO ao carimbo (o
   * arquivo é a convenção do escritório; o carimbo erra). Sem esta marca, quem
   * corrigisse a disciplina à mão veria a folha voltar para o bloco de origem —
   * a correção seria aceita e ignorada.
   */
  disciplinaManual: boolean;
  grupo?: number;
  ordem?: number;
  /**
   * Posição na LEITURA, antes de qualquer ajuste. É a chave de ordenação quando
   * não há `ordem` — e quem insere uma folha entre duas outras (o arrasto)
   * precisa dela: o índice no array já projetado não serve, porque com uma folha
   * reordenada os dois deixam de coincidir.
   */
  natural: number;
  /**
   * A folha foi CRIADA À MÃO — não existe PDF por trás dela.
   *
   * Existe porque prancha que não foi lida não virava linha nenhuma, e não havia
   * como criar uma: a única saída era abrir a tela antiga. Ela entra na LD (que é
   * uma LISTA de documentos, e a prancha pode estar a caminho) e NÃO entra no
   * volume — a montagem recorta páginas de arquivos reais, e não há página para
   * recortar. Quem monta o volume vê a marca no nó.
   */
  avulsa: boolean;
}

/**
 * Uma folha criada à mão. É SÓ UM ID: todo o conteúdo (nº, código, título,
 * disciplina) mora no `Ajuste` daquele id, exatamente como numa folha lida.
 *
 * Guardar os campos aqui criaria um segundo lugar para editar folha, com as
 * mesmas quatro chaves e regras de precedência ligeiramente diferentes — que é
 * como duas verdades nascem. O popover "Corrigir" é um só.
 */
export type FolhaAvulsaId = FolhaId;

/** Prefixo dos ids criados à mão. Não colide com `arquivo#pagina`. */
export const PREFIXO_AVULSA = "manual#";

export function ehAvulsa(id: FolhaId): boolean {
  return id.startsWith(PREFIXO_AVULSA);
}

export function folhaId(selo: Pick<SeloForLd, "fileName" | "pageNumber">): FolhaId {
  // Sem página (PDF de uma folha só) não pode colidir com a página 1.
  return `${selo.fileName}#${selo.pageNumber ?? "?"}`;
}

/**
 * Põe os selos na ORDEM DO PAPEL: arquivo por arquivo, página por página.
 *
 * A leitura roda com três chamadas simultâneas e empilha cada resultado quando
 * ele CHEGA, não quando ele pertence. Bastava a página 7 responder antes da 6
 * para a folha 7 nascer antes; e a página que estoura o timeout volta um minuto
 * depois e aterrissa dez posições abaixo — foi assim que um projeto de 71
 * pranchas apareceu com 05, 07, 08, 10, 09 e a folha 06 lá embaixo, depois da 16.
 *
 * Isso não é detalhe de exibição: o índice nesta lista é o `natural` da folha, e
 * `natural` é a chave de ordenação de tudo o que vem depois — o canvas, a divisão
 * em tomos e a montagem quando o usuário arrasta alguma folha. A ordem de uma
 * prancha é uma propriedade do PAPEL, e não do instante em que a rede respondeu.
 *
 * A ordem dos ARQUIVOS é a de chegada, não alfabética: quem soltou `est` antes de
 * `arq` quer o volume nessa ordem, e ordenar por nome inverteria a decisão de
 * quem largou os arquivos na tela.
 */
export function ordenarPorPagina<T extends { fileName: string; pageNumber?: number | null }>(
  itens: readonly T[],
): T[] {
  const ordemDoArquivo = new Map<string, number>();
  for (const item of itens) {
    if (!ordemDoArquivo.has(item.fileName)) ordemDoArquivo.set(item.fileName, ordemDoArquivo.size);
  }
  return [...itens].sort((a, b) => {
    const arquivoA = ordemDoArquivo.get(a.fileName) ?? 0;
    const arquivoB = ordemDoArquivo.get(b.fileName) ?? 0;
    if (arquivoA !== arquivoB) return arquivoA - arquivoB;
    return (a.pageNumber ?? 0) - (b.pageNumber ?? 0);
  });
}

/** Texto que só conta como ajuste se tiver conteúdo — evita título em branco na LD. */
function texto(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/** O selo que uma folha criada à mão não tem. Tudo vazio: o ajuste é que fala. */
function seloVazio(): SeloForLd {
  return {
    fileName: "",
    pageNumber: null,
    disciplina: null,
    folha: null,
    total: null,
    numeroFolha: null,
    arquivo: null,
    conteudo: null,
    cliente: null,
    secretaria: null,
    obra: null,
    fase: null,
    tituloSecao: null,
  };
}

/**
 * Aplica os ajustes sobre os selos e devolve as folhas na ordem final.
 * Ajuste órfão (prancha removida) é simplesmente ignorado: a prancha pode voltar,
 * e apagar o ajuste perderia a edição para sempre.
 *
 * `avulsas` são os ids criados à mão: entram no fim da leitura (é onde uma folha
 * nova nasce) e daí em diante são folhas como as outras — arrastáveis,
 * corrigíveis, removíveis.
 *
 * As REMOVIDAS não saem daqui: quem foi tirado do conjunto não pode aparecer na
 * LD, no volume nem na conferência, e este é o ponto único por onde os três
 * enxergam as folhas.
 */
export function folhas(
  selos: readonly SeloForLd[],
  ajustes: Readonly<Record<FolhaId, Ajuste>>,
  avulsas: readonly FolhaId[] = [],
): Folha[] {
  const fontes: { selo: SeloForLd; id: FolhaId; avulsa: boolean }[] = [
    ...selos.map((selo) => ({ selo, id: folhaId(selo), avulsa: false })),
    ...avulsas.map((id) => ({ selo: seloVazio(), id, avulsa: true })),
  ];

  const projetadas = fontes.map(({ selo, id, avulsa }, natural) => {
    const ajuste = ajustes[id];
    const titulo = texto(ajuste?.titulo);
    const disciplina = texto(ajuste?.disciplina);
    const arquivo = texto(ajuste?.arquivo);
    const numero =
      typeof ajuste?.numero === "number" && ajuste.numero > 0 ? ajuste.numero : null;
    const grupo = ajuste?.grupo;
    const ordem = ajuste?.ordem;

    return {
      removida: ajuste?.removida === true,
      folha: {
        ...selo,
        id,
        avulsa,
        natural,
        conteudo: titulo ?? selo.conteudo,
        disciplina: disciplina ?? selo.disciplina,
        arquivo: arquivo ?? selo.arquivo,
        /*
         * O número vai em CANAL PRÓPRIO (`folhaManual`), não sobrescrevendo
         * `folha`: `folha` é o que o OCR leu, e a resolução prefere o código do
         * carimbo a ele. Escrever ali faria a correção perder para o parser —
         * o engenheiro digitaria e veria o valor voltar.
         */
        ...(numero !== null ? { folhaManual: numero } : {}),
        editado:
          titulo !== null ||
          disciplina !== null ||
          arquivo !== null ||
          numero !== null ||
          grupo !== undefined ||
          ordem !== undefined,
        editadoTexto:
          titulo !== null || disciplina !== null || arquivo !== null || numero !== null,
        disciplinaManual: disciplina !== null,
        ...(grupo !== undefined ? { grupo } : {}),
        ...(ordem !== undefined ? { ordem } : {}),
      } satisfies Folha,
      natural,
    };
  });

  /*
   * Ordem esparsa: a chave é `ordem ?? posição natural`. No empate, quem tem
   * ordem MANUAL vem antes — senão arrastar uma folha para a posição de outra
   * não teria efeito visível, que é justamente o gesto que se quer.
   */
  return projetadas
    .filter((p) => !p.removida)
    .sort((a, b) => {
      const chaveA = a.folha.ordem ?? a.natural;
      const chaveB = b.folha.ordem ?? b.natural;
      if (chaveA !== chaveB) return chaveA - chaveB;
      const manualA = a.folha.ordem !== undefined;
      const manualB = b.folha.ordem !== undefined;
      if (manualA !== manualB) return manualA ? -1 : 1;
      return a.natural - b.natural;
    })
    .map((p) => p.folha);
}

/**
 * As folhas que foram TIRADAS do conjunto, na ordem da leitura.
 *
 * Existe para a tela poder oferecer a volta. Remoção que não se desfaz obriga a
 * reler as pranchas inteiras — e reler custa uma chamada de modelo por página.
 */
export function folhasRemovidas(
  selos: readonly SeloForLd[],
  ajustes: Readonly<Record<FolhaId, Ajuste>>,
): { id: FolhaId; rotulo: string }[] {
  return selos
    .map((selo) => ({ selo, id: folhaId(selo) }))
    .filter(({ id }) => ajustes[id]?.removida === true)
    .map(({ selo, id }) => ({
      id,
      // O rótulo é o que dá para reconhecer a folha sem ela estar na tela: o
      // código do carimbo, senão o arquivo e a página.
      rotulo:
        texto(ajustes[id]?.arquivo) ??
        selo.arquivo?.trim() ??
        `${selo.fileName}${selo.pageNumber ? ` p.${selo.pageNumber}` : ""}`,
    }));
}

/** Reparte N itens em `count` baldes equilibrados. É `buildBalancedQuantities`. */
export type Repartir = (total: number, count: number) => number[];

/**
 * Divide as folhas em tomos. O grupo manual manda; as folhas sem grupo caem na
 * divisão automática por quantidade — o "palpite inicial".
 *
 * `repartir` deve ser `buildBalancedQuantities` de `lib/ld/ld-rules`: chega por
 * parâmetro só para este módulo não precisar de import de runtime.
 *
 * Devolve um array de `numTomos` listas de ids, na ordem da projeção.
 */
export function gruposDasFolhas(
  lista: readonly Folha[],
  numTomos: number,
  repartir: Repartir,
): FolhaId[][] {
  const tomos = Math.max(1, Math.trunc(numTomos));
  const baldes: FolhaId[][] = Array.from({ length: tomos }, () => []);
  if (lista.length === 0) return baldes;

  const posicao = new Map<FolhaId, number>(lista.map((f, i) => [f.id, i]));
  const semGrupo: Folha[] = [];

  for (const f of lista) {
    if (f.grupo === undefined) {
      semGrupo.push(f);
      continue;
    }
    // Grupo fora da faixa não pode fazer a folha sumir da montagem.
    const alvo = Math.min(tomos, Math.max(1, Math.trunc(f.grupo)));
    baldes[alvo - 1].push(f.id);
  }

  // O palpite: reparte quem não foi decidido à mão, equilibrando as quantidades.
  let cursor = 0;
  repartir(semGrupo.length, tomos).forEach((quantidade, i) => {
    for (let n = 0; n < quantidade; n++) baldes[i].push(semGrupo[cursor++].id);
  });

  // Dentro do tomo, a ordem é sempre a da projeção — não a ordem em que a folha
  // foi atribuída ao balde.
  return baldes.map((ids) => ids.sort((a, b) => posicao.get(a)! - posicao.get(b)!));
}

/**
 * Acumula um ajuste sobre o que já havia, sem mutar o objeto recebido.
 * Campo passado como `undefined` LIMPA aquele campo — é como se desfaz uma
 * edição sem apagar as outras.
 */
export function aplicarAjuste(
  ajustes: Readonly<Record<FolhaId, Ajuste>>,
  id: FolhaId,
  patch: Ajuste,
): Record<FolhaId, Ajuste> {
  const combinado: Ajuste = { ...ajustes[id] };
  for (const chave of Object.keys(patch) as (keyof Ajuste)[]) {
    if (patch[chave] === undefined) delete combinado[chave];
    else Object.assign(combinado, { [chave]: patch[chave] });
  }

  const proximo = { ...ajustes };
  // Ajuste vazio é o mesmo que ajuste nenhum: não vale ocupar o estado.
  if (Object.keys(combinado).length === 0) delete proximo[id];
  else proximo[id] = combinado;
  return proximo;
}

/**
 * A chave de ordenação de uma folha: a `ordem` manual quando existe, senão a
 * posição natural. É por esta chave que a projeção ordena — e é entre duas
 * destas que uma folha arrastada tem de cair.
 */
export function chaveDeOrdem(f: Folha): number {
  return f.ordem ?? f.natural;
}
