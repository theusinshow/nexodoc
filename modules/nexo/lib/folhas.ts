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
  grupo?: number;
  ordem?: number;
  /**
   * Posição na LEITURA, antes de qualquer ajuste. É a chave de ordenação quando
   * não há `ordem` — e quem insere uma folha entre duas outras (o arrasto)
   * precisa dela: o índice no array já projetado não serve, porque com uma folha
   * reordenada os dois deixam de coincidir.
   */
  natural: number;
}

export function folhaId(selo: Pick<SeloForLd, "fileName" | "pageNumber">): FolhaId {
  // Sem página (PDF de uma folha só) não pode colidir com a página 1.
  return `${selo.fileName}#${selo.pageNumber ?? "?"}`;
}

/** Texto que só conta como ajuste se tiver conteúdo — evita título em branco na LD. */
function texto(valor: string | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/**
 * Aplica os ajustes sobre os selos e devolve as folhas na ordem final.
 * Ajuste órfão (prancha removida) é simplesmente ignorado: a prancha pode voltar,
 * e apagar o ajuste perderia a edição para sempre.
 */
export function folhas(
  selos: readonly SeloForLd[],
  ajustes: Readonly<Record<FolhaId, Ajuste>>,
): Folha[] {
  const projetadas = selos.map((selo, natural) => {
    const ajuste = ajustes[folhaId(selo)];
    const titulo = texto(ajuste?.titulo);
    const disciplina = texto(ajuste?.disciplina);
    const arquivo = texto(ajuste?.arquivo);
    const numero =
      typeof ajuste?.numero === "number" && ajuste.numero > 0 ? ajuste.numero : null;
    const grupo = ajuste?.grupo;
    const ordem = ajuste?.ordem;

    return {
      folha: {
        ...selo,
        id: folhaId(selo),
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
    .slice()
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
