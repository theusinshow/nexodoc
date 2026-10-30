"use client";

/**
 * A ENTREGA DO VOLUME como ação: a regra pura (`entrega-do-volume.ts`) + o
 * estado da conversa + os dois downloads. Um lugar só para o cartão do chat e
 * o painel do palco — duas cópias do "baixar" são duas travas, e uma esquece.
 *
 * Os downloads vieram de `SalvarEditaveisNoProjeto` (o ZIP dos editáveis) e de
 * `VolumesDoConjunto` (o "baixar todos").
 */
import { useMemo, useState } from "react";

import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

import { baixarArquivosEmZip, baixarEditaveis, editaveisDosResultados } from "../lib/editaveis";
import { gerarEditaveisConsolidados, parametrosDaEntrega } from "../lib/editaveis-consolidados";
import { assinaturaDosDocumentos } from "../lib/editaveis-no-projeto";
import { passosDaEntrega, tomosMontados, tomosPlanejados, volumeDaCapa } from "../lib/entrega-do-volume";
import { nomeDoZipDosVolumes, nomesDosEditaveis } from "../lib/nome-do-volume";
import { redeParaGerar } from "../lib/rede-da-conversa";
import { MOTIVO_DA_REDE, useRedeDoVolume } from "../components/PerguntaDaRedeDoVolume";
import { volumesProntosDosResultados } from "../lib/volumes-prontos";
import { useConversation } from "./conversation-store";
import { useLiberacaoDoVolume } from "./use-liberacao-do-volume";

/** Um arquivo só: link de download direto, sem ZIP. */
function baixarUrl(url: string, nome: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function useEntregaDoVolume(selos: SeloForLd[]) {
  const { results, identidade, decisoes, editaveisSalvos, registrarEditaveisSalvos, blocosFundidos } = useConversation();
  const liberacao = useLiberacaoDoVolume();
  const { pendente: redePorConfirmar } = useRedeDoVolume(selos);
  const [ocupado, setOcupado] = useState<"editaveis" | "volumes" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const tomos = useMemo(() => tomosMontados(results), [results]);
  const planejados = useMemo(() => tomosPlanejados(results), [results]);
  const temEditaveis = useMemo(() => editaveisDosResultados(results).length > 0, [results]);
  const passos = useMemo(
    () => passosDaEntrega({ tomos, planejados, liberacao, editaveisSalvosEm: editaveisSalvos?.quando ?? null }),
    [tomos, planejados, liberacao, editaveisSalvos],
  );

  /**
   * SÓ os três consolidados, com os nomes do escritório (30/09/2026):
   * `138_26_editaveis.zip` com `138_26_est_met_capas/ld/separatriz.odt`.
   */
  async function baixarEditaveisZip() {
    // A LD editável imprime o caminho no rodapé: não sai com um que ninguém confirmou.
    if (redePorConfirmar) {
      setErro(MOTIVO_DA_REDE.charAt(0).toUpperCase() + MOTIVO_DA_REDE.slice(1) + ".");
      return;
    }
    setErro(null);
    setOcupado("editaveis");
    try {
      const assinatura = assinaturaDosDocumentos(results);
      const nomes = nomesDosEditaveis(selos, identidade ?? {});
      const params = parametrosDaEntrega(results);
      const { editaveis: todos, falhas } = await gerarEditaveisConsolidados({
        selos,
        nomes,
        params,
        identidade,
        rede: redeParaGerar(decisoes, params),
        fundidos: blocosFundidos,
      });
      // Liberar com um editável faltando é liberar o volume que perde a capa
      // editável — exatamente o que a trava existe para impedir.
      if (falhas.length > 0) throw new Error(`Não deu para gerar: ${falhas.join("; ")}. O ZIP não saiu.`);
      await baixarEditaveis(todos, nomes.zip);
      registrarEditaveisSalvos({ pasta: "", quando: Date.now(), modo: "zip", arquivos: todos.map((e) => e.nome), assinatura });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao juntar os editáveis.");
    } finally {
      setOcupado(null);
    }
  }

  async function baixarVolumes() {
    if (!passos.volumes.liberado) return;
    setErro(null);
    setOcupado("volumes");
    try {
      const prontos = volumesProntosDosResultados(results);
      if (prontos.length === 1) baixarUrl(prontos[0].url, prontos[0].nome);
      else await baixarArquivosEmZip(prontos, nomeDoZipDosVolumes(selos, identidade ?? {}, volumeDaCapa(results) || undefined));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao juntar os volumes.");
    } finally {
      setOcupado(null);
    }
  }

  return { passos, tomos, temEditaveis, ocupado, erro, baixarEditaveisZip, baixarVolumes };
}
