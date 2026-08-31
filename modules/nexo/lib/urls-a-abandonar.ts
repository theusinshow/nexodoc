/**
 * QUAIS OBJECT URLs REVOGAR ao regravar um artefato — e quais NÃO.
 *
 * Regravar o mesmo artefato revoga os object URLs antigos, senão cada
 * regeração vaza os bytes da anterior no navegador. A regra estava certa e a
 * conta estava errada: ela revogava TUDO que havia antes, inclusive a URL que a
 * gravação nova está reusando. O resultado é um link morto guardado como se
 * estivesse vivo.
 *
 * O CAMINHO QUE MORDEU (31/08/2026, seis tomos de volume): `entregarVolume`
 * chama `salvar` DUAS vezes com o MESMO volume — uma assim que monta, para o
 * PDF existir antes da conferência longa, e outra depois, com o resultado da
 * conferência. A segunda revogava a URL da primeira e a regravava revogada. Na
 * tela: "6 arquivo(s) não estão disponíveis neste navegador e precisam ser
 * gerados de novo aqui". Os bytes estavam no IndexedDB o tempo todo — um F5
 * "consertava", porque a restauração cria URLs novas a partir deles.
 *
 * A segunda gravação é DE PROPÓSITO e não vai sair: ela é o que garante que o
 * volume esteja gravado antes de uma conferência que, num volume real de 42 MB,
 * mói por minutos. Quem tinha de mudar era esta conta.
 *
 * PURO e sem imports → roda em node cru (`npm run test:nexo:urls`).
 */

/** Um arquivo, no mínimo que esta regra precisa dele. */
export interface ComUrl {
  url: string;
}

/**
 * As URLs da versão ANTERIOR que ninguém mais usa — as únicas seguras de
 * revogar.
 *
 * Sem duplicatas: revogar duas vezes é inofensivo, mas a lista também serve de
 * diagnóstico, e "revogou 8" onde havia 4 arquivos confundiria quem lê.
 */
export function urlsAAbandonar(
  anteriores: readonly ComUrl[],
  novos: readonly ComUrl[],
): string[] {
  const sobreviventes = new Set(novos.map((f) => f.url));
  const abandonadas = new Set<string>();
  for (const f of anteriores) {
    if (!f.url || sobreviventes.has(f.url)) continue;
    abandonadas.add(f.url);
  }
  return [...abandonadas];
}
