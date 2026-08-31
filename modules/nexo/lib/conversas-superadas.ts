/**
 * O QUE DÁ PARA APAGAR NUMA PASTA — e, sobretudo, o que NÃO dá.
 *
 * A causa das conversas repetidas foi consertada em [[ultima-conversa.ts]]: o
 * F5 deixou de abrir conversa nova. Isto aqui é a outra metade — a bagunça que
 * já existe. Numa pasta real (`088-25-CRICIUMA`) havia quatro conversas
 * chamadas "MET", todas do mesmo volume; noutra, dezessete "Nova conversa".
 *
 * O SOFTWARE ENCONTRA, A PESSOA DECIDE. Nada aqui apaga: a função devolve
 * candidatas com o motivo e o que cada uma produziu, e é a tela que pergunta.
 * Apagar sozinho, mesmo com regra boa, seria trocar uma lista confusa por um
 * trabalho perdido — e o trabalho perdido não tem desfazer.
 *
 * TRÊS PORTAS FECHADAS, e nenhuma abre por conveniência:
 *
 *   1. a conversa ABERTA nunca é candidata — é onde a pessoa está;
 *   2. conversa com AUDITORIA EM VOO nunca é candidata — há trabalho acontecendo
 *      nela, e o `auditId` para reconectar mora ali;
 *   3. a MAIS NOVA de cada grupo nunca é candidata pela regra da superação —
 *      ela é justamente a que herdou o trabalho das outras.
 *
 * PURO e sem imports → roda em node cru (`npm run test:nexo:limpeza`).
 */

/** Uma conversa da pasta, no mínimo que a regra precisa dela. */
export interface ConversaDaPasta {
  id: string;
  /** Dentro de uma pasta, o título é a sigla da disciplina ("MET"). */
  title: string;
  updatedAt: number;
  /**
   * Os TIPOS de artefato que ela produziu (`ld`, `capa`, `separatriz`,
   * `volume`, `auditoria`, `conferencia`), sem repetição.
   *
   * Tipos, e não contagem: duas LDs numa conversa e uma noutra não fazem a
   * primeira "mais completa" — são tomos do mesmo trabalho. O que distingue é
   * ter chegado a produzir capa, ou volume, ou não.
   */
  kinds: readonly string[];
  auditoriaPendente?: boolean;
}

export type MotivoDaCandidata = "sem-artefato" | "superada";

export interface Candidata {
  id: string;
  title: string;
  updatedAt: number;
  motivo: MotivoDaCandidata;
  /** O que ela produziu — é isto que a tela mostra antes de alguém marcar. */
  kinds: readonly string[];
  /** Quem a superou, quando o motivo é `superada`. */
  superadaPor?: { id: string; updatedAt: number };
}

/** minúsculas, sem acento e sem espaço dobrado — para agrupar "MET" e "met". */
function chave(valor: string): string {
  return valor
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * As conversas desta pasta que dá para oferecer para apagar.
 *
 * Recebe UMA pasta: quem chama já agrupou. Comparar conversas de pastas
 * diferentes seria comparar projetos diferentes, e "MET" do 088-25 nada tem a
 * ver com "MET" do 063-26.
 */
export function candidatasDaPasta(
  conversas: readonly ConversaDaPasta[],
  opcoes: { idAberta?: string | null } = {},
): Candidata[] {
  const elegiveis = conversas.filter(
    (c) => c.id !== opcoes.idAberta && !c.auditoriaPendente,
  );

  // Mais novas primeiro: a comparação abaixo lê "quem veio depois de mim".
  const porGrupo = new Map<string, ConversaDaPasta[]>();
  for (const c of elegiveis) {
    const k = chave(c.title);
    const lista = porGrupo.get(k);
    if (lista) lista.push(c);
    else porGrupo.set(k, [c]);
  }

  const candidatas: Candidata[] = [];

  for (const grupo of porGrupo.values()) {
    const ordenado = [...grupo].sort((a, b) => b.updatedAt - a.updatedAt);

    for (let i = 0; i < ordenado.length; i++) {
      const c = ordenado[i];

      /*
       * SEM ARTEFATO NENHUM: não há o que perder, e vale mesmo sendo a mais
       * nova do grupo. É o que limpa as dezessete "Nova conversa" — conversas
       * abertas e abandonadas antes de produzirem qualquer coisa.
       */
      if (c.kinds.length === 0) {
        candidatas.push({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          motivo: "sem-artefato",
          kinds: [],
        });
        continue;
      }

      // A mais nova do grupo nunca é superada: não há ninguém depois dela.
      if (i === 0) continue;

      /*
       * SUPERADA quando alguma conversa MAIS NOVA do mesmo grupo produziu tudo
       * o que esta produziu (e possivelmente mais).
       *
       * "Alguma mais nova", e não "a mais nova": num grupo de quatro, a segunda
       * pode ter o volume que a primeira não tem. Exigir que a campeã fosse
       * sempre a última deixaria de fora exatamente o caso que motivou isto.
       */
      const meus = new Set(c.kinds.map(chave));
      const superior = ordenado
        .slice(0, i)
        .find((mais) => [...meus].every((k) => mais.kinds.some((x) => chave(x) === k)));

      if (superior) {
        candidatas.push({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
          motivo: "superada",
          kinds: c.kinds,
          superadaPor: { id: superior.id, updatedAt: superior.updatedAt },
        });
      }
    }
  }

  // Da mais velha para a mais nova: quem revisa a lista começa pelo que menos dói.
  return candidatas.sort((a, b) => a.updatedAt - b.updatedAt);
}
