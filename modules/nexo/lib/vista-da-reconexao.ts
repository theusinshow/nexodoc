/**
 * O que o palco mostra da RETOMADA de uma auditoria — 15/09/2026, jornada x3.
 *
 * No 403 (acesso suspenso) a reconexão para de perguntar e GUARDA o bilhete:
 * se o acesso voltar, o próximo carregamento reconecta à análise que o servidor
 * terminou. Mas o palco escolhe "análise em curso" sempre que há bilhete, antes
 * de olhar a falha — a tela ficava em "em curso" para sempre, sem perguntar,
 * sem dizer por quê e sem saída. Com o bloqueio registrado para ESTE bilhete, a
 * espera sai de cena, o motivo aparece e a pessoa pode descartar a espera.
 */

export type BloqueioDaReconexao = { auditId: string; motivo: string } | null;

export function vistaDaReconexao(args: {
  bilhete: { auditId: string } | null;
  semAcesso: BloqueioDaReconexao;
  falha: string | null;
}): { mostrarPendente: boolean; falha: string | null; podeDescartar: boolean } {
  const bloqueado =
    args.bilhete !== null &&
    args.semAcesso !== null &&
    args.semAcesso.auditId === args.bilhete.auditId;
  return {
    mostrarPendente: args.bilhete !== null && !bloqueado,
    falha: bloqueado && args.semAcesso ? args.semAcesso.motivo : args.falha,
    podeDescartar: bloqueado,
  };
}
