/**
 * QUANDO A IA SIMULADA DA BATERIA ESTÁ LIGADA — um lugar só.
 *
 * Existia uma cópia em `lib/ai-runner.ts` (sem teste) e outra em
 * `lib/ia-simulada.ts` (com teste): as duas condições podiam divergir sem
 * nenhum teste ficar vermelho. Este módulo não importa nada, então o
 * `ai-runner` o importa estaticamente sem carregar o simulador, e o teste em
 * node cru (`scripts/test-ia-simulada.ts`) exercita exatamente a função que o
 * produto usa.
 *
 * As DUAS condições: uma variável esquecida no Render não pode ligar isto.
 */
export function iaSimuladaLigada(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NEXODOC_IA_SIMULADA === "1" && env.NODE_ENV !== "production";
}
