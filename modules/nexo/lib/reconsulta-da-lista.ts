/**
 * QUANDO VOLTAR A PERGUNTAR A LISTA DE CONVERSAS AO SERVIDOR — 15/09/2026.
 *
 * A lista remota só era lida na montagem e depois de apagar. Uma sessão que
 * carregou sem servidor (rede fora, Render dormindo além do limite) ficava sem
 * ela até o próximo F5: a abertura de conversa seguia "não conferida" e cada
 * conflito falso ia para o caminho travado. Agora a lista é pedida de novo
 * quando a rede volta, e quando a aba volta a ficar visível — sempre, se ela
 * nunca chegou; no máximo uma vez por intervalo, se já chegou.
 */

export const INTERVALO_DA_RECONSULTA_MS = 60_000;

export function deveReconsultarLista(args: {
  motivo: "online" | "visivel";
  carregada: boolean;
  ultimaIdaMs: number | null;
  agoraMs: number;
}): boolean {
  if (!args.carregada) return true;
  if (args.motivo === "online") return true;
  if (args.ultimaIdaMs === null) return true;
  return args.agoraMs - args.ultimaIdaMs >= INTERVALO_DA_RECONSULTA_MS;
}
