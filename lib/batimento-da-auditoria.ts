/**
 * O BATIMENTO DA AUDITORIA — como se sabe que uma análise ainda está viva.
 *
 * A auditoria roda DENTRO do POST que a pediu: não há fila e não há worker, e o
 * único sinal de vida é o processo continuar de pé. Quando o container reinicia
 * no meio (deploy, OOM, queda do provedor), a linha do banco fica em
 * `PROCESSING` para sempre — ninguém a fecha, porque quem a fecharia morreu
 * junto com ela.
 *
 * O preço aparece do lado de quem espera. `use-reconectar-auditoria` pergunta
 * de cinco em cinco segundos e NUNCA desiste: a tela diz "a análise está
 * rodando no servidor" por horas sobre um trabalho que morreu no primeiro
 * minuto. O parecer não existe e não vai existir, e a pessoa não tem como saber
 * que bastava rodar de novo.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * NÃO É UM TETO DE DURAÇÃO, e a escolha é o assunto deste módulo.
 *
 * O caminho óbvio seria "PROCESSING com mais de N minutos está morta". Mas N
 * teria que ser maior que a auditoria legítima mais lenta, e os tetos que o
 * PRÓPRIO motor declara já somam mais de vinte minutos: leitura global do
 * Profundo até 900s, validação até 480s, blocos de até 300s cada. Um N honesto
 * seria tão grande que a tela seguiria mentindo por meia hora — que é quase tão
 * inútil quanto mentir para sempre. E um N confortável mataria no meio a
 * auditoria de um memorial grande, que é justamente a que custou mais caro.
 *
 * O batimento não pergunta há quanto tempo começou. Pergunta quando foi a
 * última vez que houve alguém do outro lado. Um processo vivo escreve a cada
 * `INTERVALO_DE_BATIMENTO_MS` mesmo estando parado dentro de uma chamada de
 * quinze minutos: o `setInterval` não depende do progresso da análise, só do
 * event loop, e toda espera do motor é de rede.
 *
 * PURO e sem imports — roda no node cru. Quem ESCREVE o batimento vive em
 * `lib/audit-persistence.ts`, junto do resto do que fala com o banco; aqui só
 * mora o julgamento, que é a parte que precisa ser provável sem banco.
 */

/** Espaço entre dois batimentos de um processo vivo. */
export const INTERVALO_DE_BATIMENTO_MS = 30_000;

/**
 * Quantos batimentos podem faltar antes de declarar a análise morta.
 *
 * Um só seria frágil: um `update` que demora por causa do banco (Neon acorda do
 * sono em segundos) marcaria como morta uma auditoria que só se atrasou. Quatro
 * dá dois minutos de margem, que é mais do que qualquer atraso de escrita
 * observado e ainda é rápido o bastante para a pessoa não desistir da tela.
 */
export const BATIMENTOS_ATE_DESISTIR = 4;

/** Silêncio a partir do qual a análise é dada por morta. */
export const SEM_SINAL_MS = INTERVALO_DE_BATIMENTO_MS * BATIMENTOS_ATE_DESISTIR;

/** O que basta saber de uma auditoria para julgar se ela ainda respira. */
export interface RegistroComBatimento {
  status: string;
  /** Último sinal de vida. Nulo em linha anterior a esta coluna, ou recém-criada. */
  heartbeatAt: Date | null;
  createdAt: Date;
}

/**
 * A análise perdeu o processo que a rodava?
 *
 * Só se pronuncia sobre `PROCESSING`: COMPLETED, FAILED e CANCELED são estados
 * FINAIS, e reabri-los por causa de um batimento velho — que nunca mais vai
 * chegar, porque o trabalho acabou — apagaria parecer pronto.
 */
export function auditoriaSemSinal(
  registro: RegistroComBatimento,
  agora: Date = new Date(),
): boolean {
  if (registro.status !== "PROCESSING") return false;

  /*
   * SEM BATIMENTO, VALE A CRIAÇÃO — e o mesmo `??` resolve os dois casos que
   * parecem opostos:
   *
   *  · a auditoria de três segundos atrás, cujo primeiro batimento ainda não
   *    saiu: `createdAt` é recente, e ela vive;
   *  · a linha presa desde antes desta coluna existir: `createdAt` é de ontem,
   *    e ela morre na primeira consulta.
   *
   * Tratar nulo como "viva" acomodaria o acervo já preso para sempre; tratar
   * como "morta" mataria toda auditoria no berço.
   */
  const ultimoSinal = registro.heartbeatAt ?? registro.createdAt;

  /*
   * SEM `Math.abs`. Batimento no FUTURO acontece com desvio de relógio entre a
   * instância e o banco, e futuro não é sintoma de morte — é sintoma de relógio.
   * A subtração crua já dá negativo nesse caso, que nunca passa da tolerância.
   */
  return agora.getTime() - ultimoSinal.getTime() > SEM_SINAL_MS;
}

/**
 * O que fica gravado no `error` de uma auditoria interrompida assim.
 *
 * Diz o que aconteceu E o que fazer, porque esta frase chega inteira na tela de
 * quem estava esperando. "Erro interno" mandaria a pessoa abrir um chamado
 * sobre algo que um clique resolve.
 */
export const MOTIVO_SEM_SINAL =
  "A análise foi interrompida antes de terminar (o servidor reiniciou). " +
  "Nada do que já foi lido se perdeu no documento — rode a auditoria de novo.";
