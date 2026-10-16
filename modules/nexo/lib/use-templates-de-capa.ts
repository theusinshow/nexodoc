"use client";

import { useEffect, useState } from "react";

import {
  EVENTO_MODELO_DE_CAPA,
  EVENTO_PROJETO_MUDOU,
  cabecalhosDeGeracao,
} from "@/lib/projeto-do-pedido";

/**
 * OS MODELOS DE CAPA, com o do PROJETO na frente quando ele tem um
 * (16/10/2026). A lista vem de `/api/capas/templates`, que só acrescenta o
 * modelo do projeto quando recebe o projeto da conversa — por isso o pedido
 * leva `cabecalhosDeGeracao()` e se refaz quando o projeto muda ou quando um
 * modelo novo é gravado.
 */
export function useTemplatesDeCapa<T>(): T[] {
  const [templates, setTemplates] = useState<T[]>([]);
  useEffect(() => {
    let vivo = true;
    const buscar = () => {
      fetch("/api/capas/templates", { headers: cabecalhosDeGeracao() })
        .then((r) => r.json())
        .then((d: { templates?: T[] }) => {
          if (vivo) setTemplates(d.templates ?? []);
        })
        .catch(() => {});
    };
    buscar();
    window.addEventListener(EVENTO_PROJETO_MUDOU, buscar);
    window.addEventListener(EVENTO_MODELO_DE_CAPA, buscar);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO_PROJETO_MUDOU, buscar);
      window.removeEventListener(EVENTO_MODELO_DE_CAPA, buscar);
    };
  }, []);
  return templates;
}
