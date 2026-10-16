"use client";

/**
 * O CARD DO MODELO DE CAPA (16/10/2026): a capa em ODT que o engenheiro anexou,
 * linha a linha, com o que o Nexo achou que cada uma é. Nada vira modelo antes
 * do "Usar este modelo" — o que a regra ou a IA errarem, ele corrige aqui.
 * Desenho: docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 */
import { FileText } from "lucide-react";
import { useState } from "react";

import { EVENTO_MODELO_DE_CAPA } from "@/lib/projeto-do-pedido";
import { aplicarRespostas } from "@/server/nexo/modelo-capa/regras";
import { CAMPOS_DA_CAPA, type CampoDaCapa, type ParagrafoClassificado } from "@/server/nexo/modelo-capa/tipos";

import { esquecerOdtPendente, odtPendente } from "../lib/capa-anexada";
import { useConversation } from "../state/conversation-store";
import type { ModeloDeCapaNaConversa } from "../types";

const ROTULO: Record<CampoDaCapa | "FIXO", string> = {
  ORGAO: "Órgão",
  SECRETARIA: "Secretaria",
  NOME_OBRA: "Obra",
  BAIRRO: "Bairro",
  FASE: "Fase",
  TITULO_CAPA: "Título",
  DISCIPLINA: "Disciplina",
  TOMO: "Tomo",
  VOLUME: "Volume",
  MES_ANO: "Mês/ano",
  CODIGO_EXIBIDO: "Código",
  FIXO: "Texto fixo",
};

const OPCOES: readonly (CampoDaCapa | "FIXO")[] = [...CAMPOS_DA_CAPA, "FIXO"];

/** Parágrafo partido em trechos (`Vol. VII`): mostra a leitura, sem seletor. */
function emTrechos(p: ParagrafoClassificado): boolean {
  return (p.trechos?.length ?? 0) > 1;
}

function campoDe(p: ParagrafoClassificado): CampoDaCapa | "FIXO" {
  return p.trechos?.[0]?.campo ?? "FIXO";
}

export function ModeloDeCapaCard({
  mensagemId,
  modelo,
}: {
  mensagemId: string;
  modelo: ModeloDeCapaNaConversa;
}) {
  const { atualizarMensagem, appendMessage, projectId } = useConversation();
  const [gravando, setGravando] = useState(false);
  const editavel = modelo.estado === "propondo" || modelo.estado === "recusado";
  const semTomo = !modelo.proposta.paragrafos.some((p) => p.trechos?.some((t) => t.campo === "TOMO"));

  function trocar(indice: number, campo: CampoDaCapa | "FIXO") {
    atualizarMensagem(mensagemId, {
      modeloDeCapa: { ...modelo, proposta: aplicarRespostas(modelo.proposta, [{ indice, campo }], "pessoa") },
    });
  }

  async function usar() {
    const arquivo = odtPendente(modelo.anexoId);
    if (!arquivo) {
      atualizarMensagem(mensagemId, {
        modeloDeCapa: { ...modelo, estado: "recusado", motivo: "Anexe a capa em ODT de novo para gravar — o arquivo não está mais nesta aba." },
      });
      return;
    }
    if (!projectId) {
      atualizarMensagem(mensagemId, {
        modeloDeCapa: { ...modelo, estado: "recusado", motivo: "A conversa ainda não está num projeto." },
      });
      return;
    }
    setGravando(true);
    try {
      const form = new FormData();
      form.set("arquivo", arquivo);
      form.set("proposta", JSON.stringify(modelo.proposta));
      const res = await fetch(`/api/nexo/modelo-capa?projeto=${encodeURIComponent(projectId)}`, {
        method: "PUT",
        body: form,
      });
      const corpo = (await res.json().catch(() => null)) as { error?: string; ensaiado?: boolean } | null;
      if (!res.ok) {
        atualizarMensagem(mensagemId, {
          modeloDeCapa: { ...modelo, estado: "recusado", motivo: corpo?.error ?? "Não consegui gravar o modelo." },
        });
        return;
      }
      esquecerOdtPendente(modelo.anexoId);
      atualizarMensagem(mensagemId, { modeloDeCapa: { ...modelo, estado: "gravado", motivo: undefined } });
      appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Pronto: as capas deste projeto saem deste modelo." +
          (corpo?.ensaiado === false ? " Não consegui ensaiar o transbordo agora (conversor de PDF fora do ar) — confira a primeira capa gerada." : ""),
      });
      window.dispatchEvent(new Event(EVENTO_MODELO_DE_CAPA));
    } finally {
      setGravando(false);
    }
  }

  function descartar() {
    esquecerOdtPendente(modelo.anexoId);
    atualizarMensagem(mensagemId, { modeloDeCapa: { ...modelo, estado: "descartado" } });
  }

  return (
    <section className="nx-ficha" aria-label="Modelo de capa">
      <header className="nx-ficha-cabeca">
        <FileText size={14} aria-hidden />
        <span className="nx-ficha-titulo">Modelo de capa</span>
        <span className="nx-ficha-arquivo" title={modelo.nome}>
          {modelo.nome}
        </span>
      </header>
      <div className="nx-ficha-linhas">
        <dl>
          {modelo.proposta.paragrafos.map((p) => (
            <div key={p.indice} className="nx-ficha-linha nx-modelo-linha">
              <dt title={p.texto}>
                <span className="nx-modelo-texto">{p.texto}</span>
              </dt>
              <dd>
                {emTrechos(p) ? (
                  <span className="nx-ficha-valor">
                    {p.trechos!.map((t) => (t.campo === "FIXO" ? t.texto : `[${ROTULO[t.campo]}]`)).join("")}
                  </span>
                ) : (
                  <select
                    className="nx-ficha-campo nx-modelo-campo"
                    aria-label={`O que é "${p.texto}"`}
                    value={campoDe(p)}
                    disabled={!editavel || gravando}
                    onChange={(e) => trocar(p.indice, e.target.value as CampoDaCapa | "FIXO")}
                  >
                    {OPCOES.map((c) => (
                      <option key={c} value={c}>
                        {ROTULO[c]}
                      </option>
                    ))}
                  </select>
                )}
                {p.origem === "ia" && campoDe(p) !== "FIXO" && <span className="nx-ficha-procedencia">sugerido</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {semTomo && editavel && (
        <p className="nx-ficha-aviso" role="note">
          <i aria-hidden />A capa não tem linha de tomo: volumes com mais de um tomo sairão sem o número do tomo.
        </p>
      )}
      {modelo.estado === "recusado" && modelo.motivo && (
        <p className="nx-ficha-aviso" role="alert">
          <i aria-hidden />
          {modelo.motivo}
        </p>
      )}
      <footer className="nx-modelo-acoes">
        {editavel ? (
          <>
            <button type="button" className="ds-btn ds-btn--primary ds-btn--sm" disabled={gravando} onClick={usar}>
              {gravando ? "Gravando…" : "Usar este modelo"}
            </button>
            <button type="button" className="ds-btn ds-btn--quiet ds-btn--sm" disabled={gravando} onClick={descartar}>
              Descartar
            </button>
          </>
        ) : (
          <span className="nx-ficha-procedencia">
            {modelo.estado === "gravado" ? "Modelo do projeto." : "Descartado."}
          </span>
        )}
      </footer>
    </section>
  );
}
