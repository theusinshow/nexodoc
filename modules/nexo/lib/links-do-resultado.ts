/**
 * A REGRA DE VISIBILIDADE DO BLOCO DE DOWNLOADS.
 *
 * Mora em `lib/` e não dentro do `ResultLinks.tsx` pelo mesmo motivo que
 * `pendencia.ts` mora aqui: é decisão pura, e o Node só tira tipo de `.ts` —
 * dentro do `.tsx` ela não teria como ser provada sem navegador.
 */

/**
 * ESTE BLOCO TEM ALGO A DIZER? — e a resposta não é "há arquivo".
 *
 * `files` fica VAZIO exatamente no caso mais comum de bytes ausentes: conversa
 * aberta noutra máquina não tem blob nenhum, o restaurador pula todos e marca
 * `bytesAusentes`. Enquanto a saída antecipada do `ResultLinks` media só a
 * lista de arquivos, o aviso que ele existe para dar — e agora o botão
 * Regenerar — NUNCA chegavam à tela: a pessoa via um card "gerado", sem
 * download e sem explicação. É o silêncio de sempre, que parece defeito.
 */
export function temAlgoADizer(saved: {
  files: readonly unknown[];
  bytesAusentes?: boolean;
}) {
  return saved.files.length > 0 || Boolean(saved.bytesAusentes);
}
