"use client";

/**
 * A PERGUNTA DA REDE NA MONTAGEM (30/10/2026).
 *
 * Ela só morava no plano do chat, e só ele travava. Quem montava pelo cartão
 * da montagem (a LD do bloco gerada na hora) ou baixava o ZIP dos editáveis
 * passava por baixo: num volume de três disciplinas as LDs saíram com o
 * caminho deduzido, sem ninguém ter olhado. Aqui é a MESMA pergunta, com as
 * mesmas disciplinas que o plano mostraria, para quem nunca abriu o plano.
 *
 * `useRedeDoVolume` é a régua das travas (montar e baixar editáveis); o
 * componente é onde se responde.
 */
import { gravarRede, lerRede, redePendente } from "@/lib/ld/caminho-da-rede";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

import { summarizeSelos } from "../lib/agent-context";
import { blocoGera, blocosDoVolume, porBloco } from "../lib/blocos";
import { codigoDaFolha, rotuloDoCodigo } from "../lib/disciplina-da-folha";
import { parametrosDaEntrega } from "../lib/editaveis-consolidados";
import type { Folha } from "../lib/folhas";
import { CAMPO_DA_REDE, dataDaCapa } from "../lib/rede-da-conversa";
import { useConversation } from "../state/conversation-store";
import { PerguntaDaRede } from "./PerguntaDaRede";

/** A frase das travas. Minúscula e sem ponto: quem mostra capitaliza. */
export const MOTIVO_DA_REDE = "confirme onde as LDs ficam na rede, no cartão da montagem";

export function useRedeDoVolume(selos: SeloForLd[]) {
  const { decisoes, decidir, identidade, results, blocosFundidos } = useConversation();
  const blocos = blocosDoVolume(selos as Folha[], codigoDaFolha, rotuloDoCodigo, blocosFundidos);
  const geraLd = blocos.some((b) => blocoGera("ld", b));
  const disciplinas = porBloco(blocos)
    ? blocos.filter((b) => b.codigo && blocoGera("ld", b)).map((b) => b.codigo)
    : [blocos.find((b) => b.codigo)?.codigo ?? ""];
  const rede = lerRede(decisoes[CAMPO_DA_REDE]?.valor);
  const doSelo = summarizeSelos(selos);
  const revisao = identidade?.revisao?.trim() || doSelo.revisao || "a";
  const params = parametrosDaEntrega(results);

  return {
    pendente: geraLd && redePendente(rede),
    pergunta: {
      cliente: params.templateId ?? "",
      codigo: identidade?.codigo?.trim() || doSelo.codigo || "",
      revisao,
      ...dataDaCapa(params),
      disciplinas,
      rede,
      onMudar: (proxima: typeof rede) => decidir(CAMPO_DA_REDE, gravarRede({ ...proxima, revisao }), ""),
    },
  };
}

export function PerguntaDaRedeDoVolume({ selos }: { selos: SeloForLd[] }) {
  const { pendente, pergunta } = useRedeDoVolume(selos);
  if (!pendente) return null;
  return <PerguntaDaRede {...pergunta} />;
}
