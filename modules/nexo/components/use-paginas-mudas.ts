"use client";

/**
 * QUANTAS FOLHAS DESTE MEMORIAL NÃO TÊM TEXTO — perguntado ao pdf.js, aqui
 * mesmo, sem gastar modelo nenhum.
 *
 * Existe para a decisão que hoje é cega. O `114_19_VOLUME ÚNICO.pdf` entrou na
 * auditoria com 25 das 31 folhas ilegíveis — o texto delas está desenhado na
 * página, não escrito —, a análise leu um décimo do memorial e o parecer saiu
 * sem uma palavra sobre isso. Quem clicou "auditar" não tinha como saber, nem
 * antes nem depois.
 *
 * O diagnóstico roda ANTES do upload, e não no meio da corrida: o motor é SSE
 * com cancelamento e retomada pós-F5, e pausá-lo para esperar um clique seria
 * uma máquina de estados nova. Ver [[pagina-muda-render.ts]].
 */

import { useEffect, useState } from "react";

import type { DiagnosticoDoArquivo } from "../lib/pagina-muda-render";

export type EstadoDasPaginasMudas =
  | { estado: "ausente" }
  | { estado: "lendo" }
  | { estado: "pronto"; dados: DiagnosticoDoArquivo };

export function usePaginasMudas(memorial: File | null): EstadoDasPaginasMudas {
  /*
   * Só a RESPOSTA é guardada, carimbada com a chave que a produziu — "lendo" e
   * "ausente" são derivados dela. É o mesmo desenho de [[use-delta-do-memorial.ts]],
   * e pelo mesmo motivo: guardar os estados intermediários obrigaria a chamar
   * `setState` no corpo do efeito, que é render em cascata.
   */
  const [resposta, setResposta] = useState<{
    chave: string;
    dados: DiagnosticoDoArquivo | null;
  } | null>(null);

  const chave = memorial
    ? `${memorial.name}|${memorial.size}|${memorial.lastModified}`
    : null;

  useEffect(() => {
    if (!chave || !memorial) return;
    let vivo = true;
    /*
     * O import é DINÂMICO porque o módulo abre o pdf.js, e o pdf.js é pesado.
     * Carregá-lo estaticamente o poria no bundle de toda tela que renderiza o
     * cartão de confirmação, inclusive as que nunca veem um memorial.
     */
    import("../lib/pagina-muda-render")
      .then((mod) => mod.diagnosticarArquivo(memorial))
      .then((dados) => {
        if (vivo) setResposta({ chave, dados });
      })
      .catch((err) => {
        /*
         * Falhar aqui NÃO bloqueia a auditoria. O portão é um aviso antes de
         * decidir; sem ele o cartão volta a ser o de sempre e a análise roda
         * como sempre rodou — e a cobertura do parecer continua acusando as
         * folhas mudas, porque o servidor as conta por conta própria.
         */
        console.warn("[pagina-muda] diagnóstico falhou", err);
        if (vivo) setResposta({ chave, dados: null });
      });
    return () => {
      vivo = false;
    };
    // `memorial` entra pela `chave`: o objeto File é recriado a cada render do
    // dono, e depender dele refaria o diagnóstico para sempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (!chave) return { estado: "ausente" };
  if (resposta?.chave !== chave) return { estado: "lendo" };
  if (!resposta.dados) return { estado: "ausente" };
  return { estado: "pronto", dados: resposta.dados };
}
