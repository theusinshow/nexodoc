/**
 * QUEM ESTÁ ESPERANDO AVISO — a regra, sem banco.
 *
 * Ela já existia como o objeto `PENDENTE_DE_AVISO` dentro de
 * [[aviso-de-achados.ts]], e valia para UMA pessoa por achado. Com envolvidos, a
 * mesma regra passa a valer para N — e sai do Prisma para poder ser provada sem
 * banco.
 *
 * AS TRÊS CONDIÇÕES, cada uma com o motivo:
 *
 *  · tem e-mail — sem dono não há a quem avisar;
 *  · `notifiedAt` nulo — apertar o botão duas vezes não repete a mensagem. É
 *    esta condição que torna o botão seguro de tocar;
 *  · o achado não está resolvido — se a pessoa corrigiu antes de o aviso sair,
 *    avisar seria mandá-la olhar trabalho que ela mesma fechou.
 *
 * PURO e sem imports → roda em node cru (`npm run test:quem-avisar`).
 */
export type PessoaNoAchado = {
  email: string;
  papel: "responsavel" | "envolvido";
  /** Milissegundos, ou nulo quando o aviso ainda não saiu para ESTA pessoa. */
  notifiedAt: number | null;
};

export type AchadoParaAvisar = {
  resolvido: boolean;
  pessoas: readonly PessoaNoAchado[];
};

export function quemAvisar(
  achados: readonly AchadoParaAvisar[],
): { email: string; quantidade: number }[] {
  const contagem = new Map<string, number>();

  for (const achado of achados) {
    if (achado.resolvido) continue;

    /*
     * UM ACHADO CONTA UMA VEZ POR PESSOA.
     *
     * Dá para ser responsável por um achado e envolvido nele ao mesmo tempo — a
     * atribuição não remove ninguém dos envolvidos. Sem este conjunto, o assunto
     * do e-mail diria "2 achados esperam por você" havendo um.
     */
    const nesteAchado = new Set<string>();

    for (const pessoa of achado.pessoas) {
      const email = pessoa.email.trim().toLowerCase();
      if (!email || pessoa.notifiedAt !== null) continue;
      nesteAchado.add(email);
    }

    for (const email of nesteAchado) {
      contagem.set(email, (contagem.get(email) ?? 0) + 1);
    }
  }

  return (
    [...contagem.entries()]
      .map(([email, quantidade]) => ({ email, quantidade }))
      /*
       * Quem tem MAIS achados primeiro: é a pessoa cujo dia este envio mais
       * muda, e a que quem confirma mais precisa conferir antes de apertar. É a
       * mesma ordem que `comNomes` já usava.
       */
      .sort((a, b) => b.quantidade - a.quantidade || a.email.localeCompare(b.email, "pt-BR"))
  );
}
