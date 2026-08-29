"use client";

/**
 * OS TRÊS COMEÇOS, logo abaixo da saudação.
 *
 * A saudação NOMEIA as portas ("montar ou auditar?"); estes chips as ABREM. É a
 * diferença entre quem sabe o que quer e quem sabe como pedir — e ela some
 * depois da primeira conversa, que é quando a pessoa já aprendeu o vocabulário.
 *
 * O CHIP ESCREVE, NÃO ENVIA. Enviar direto gastaria uma volta de modelo para o
 * agente responder "anexe as pranchas" na metade dos casos, e o primeiro
 * contato com um produto que cobra por volta não pode ser uma cobrança que não
 * levou a nada. Escrito no composer, o pedido fica a um Enter — e visível, que
 * é como se aprende a frase.
 *
 * E QUANDO FALTA O INSUMO, ele também abre o seletor de arquivos: "audita o
 * memorial" numa conversa sem memorial é a frase certa sem nada a que ela se
 * aplique. O gesto seguinte é sempre anexar, então ele vem junto.
 */

import { Chip } from "@/components/ui/chip";
import { PARTIDAS, faltaInsumo } from "../lib/partidas";
import { useComposer } from "../state/composer-controller";

export function PartidasDoNexo({
  temPranchas,
  temMemorial,
  onAnexar,
}: {
  temPranchas: boolean;
  temMemorial: boolean;
  /** Abre o seletor de arquivos — chamado só quando falta o insumo da partida. */
  onAnexar?: () => void;
}) {
  const composer = useComposer();

  return (
    <div
      data-partidas
      className="flex flex-wrap gap-1.5"
      /*
       * `group` não: as partidas não escondem nada no hover. Elas são o
       * conteúdo da entrada, e conteúdo que só aparece no hover não é oferta —
       * é adivinhação.
       */
    >
      {PARTIDAS.map((partida) => {
        const falta = faltaInsumo(partida, {
          pranchas: temPranchas,
          memorial: temMemorial,
        });
        return (
          <Chip
            key={partida.id}
            variant={falta ? "default" : "suggest"}
            data-partida={partida.id}
            title={
              falta
                ? `Escreve o pedido e abre o seletor — falta ${
                    partida.precisa === "pranchas"
                      ? "anexar as pranchas"
                      : "anexar o memorial"
                  }.`
                : "Escreve o pedido no campo abaixo. Enter envia."
            }
            onClick={() => {
              composer.fill(partida.frase);
              if (falta) onAnexar?.();
            }}
          >
            {partida.rotulo}
          </Chip>
        );
      })}
    </div>
  );
}
