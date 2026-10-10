"use client";

/**
 * A FICHA DO MEMORIAL no chat: o que a capa trouxe, uma linha por campo, e um
 * lápis em cada linha para corrigir ali mesmo.
 *
 * Corrigir é um gesto curto e local: a linha vira campo, Enter salva, Esc
 * desiste. Não abre conversa com o agente — o agente não tem ação de corrigir a
 * identidade, e a régua da auditoria é a ficha (ver `lib/ficha-do-memorial.ts`).
 */
import { Check, FileText, Pencil, X } from "lucide-react";
import { useRef, useState } from "react";

import { DicaDeUmaVez } from "@/components/telas/comum/dica-de-uma-vez";

import { marcarDica } from "../lib/dicas-da-auditoria";
import { ROTULOS_DO_MEMORIAL, type CampoDoMemorial, type FichaDoMemorial, type LinhaDoMemorial } from "../lib/ficha-do-memorial";
import { useCorrecaoDoMemorial } from "../state/correcao-do-memorial";

/**
 * A PROCEDÊNCIA que vale dizer (09/10/2026). Capa e arquivo são o esperado e
 * ficam calados; o projeto e o texto do memorial não: o texto é só sugestão —
 * no 040-26 o rodapé trazia a obra de outro projeto.
 */
const PROCEDENCIA: Partial<Record<NonNullable<LinhaDoMemorial["origem"]>, string>> = {
  projeto: "do projeto",
  corpo: "do texto — confira",
};

function Linha({
  linha,
  semCapa,
  onSalvar,
}: {
  linha: LinhaDoMemorial;
  semCapa: boolean;
  onSalvar: ((campo: CampoDoMemorial, valor: string) => void) | null;
}) {
  const procedencia = !linha.corrigido && linha.origem ? PROCEDENCIA[linha.origem] : undefined;
  const rotulo = ROTULOS_DO_MEMORIAL[linha.campo];
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const lapis = useRef<HTMLButtonElement>(null);

  function abrir() {
    // Foi ao lápis: entendeu o que a dica da obra ensinava.
    marcarDica("ficha-da-obra");
    setRascunho(linha.valor ?? "");
    setEditando(true);
  }
  function fechar() {
    setEditando(false);
    // O foco volta ao lápis da mesma linha: quem corrige pelo teclado não se perde.
    requestAnimationFrame(() => lapis.current?.focus());
  }
  function salvar() {
    const valor = rascunho.trim();
    if (valor && valor !== linha.valor && onSalvar) onSalvar(linha.campo, valor);
    fechar();
  }

  return (
    <div className="nx-ficha-linha" data-campo={linha.campo} data-corrigida={linha.corrigido ? "" : undefined} data-editando={editando ? "" : undefined}>
      <dt>{rotulo}</dt>
      <dd>
        {editando ? (
          <input
            className="nx-ficha-campo"
            aria-label={`${rotulo} correto`}
            value={rascunho}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                salvar();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                fechar();
              }
            }}
          />
        ) : (
          <>
            {linha.valor ? (
              <span className="nx-ficha-valor">{linha.valor}</span>
            ) : (
              <span className="nx-ficha-vazio">{semCapa ? "a capa vem no geral — preencha se souber" : "não veio na capa"}</span>
            )}
            {linha.corrigido && <span className="nx-ficha-corrigido">{linha.origem === "usuario" ? "você preencheu" : "corrigido"}</span>}
            {procedencia && linha.valor && (
              <span className="nx-ficha-procedencia" title={linha.fonte}>
                {procedencia}
              </span>
            )}
            {/* O nome da obra é a régua da auditoria: o selo pede o olhar antes do clique. */}
            {linha.campo === "obra" && !linha.corrigido && linha.valor && <span className="ds-pill ds-pill--decide nx-ficha-confira">confira</span>}
          </>
        )}
      </dd>
      {onSalvar && (
        <span className="nx-ficha-acoes">
          {editando ? (
            <>
              <button type="button" className="nx-ficha-botao nx-ficha-botao--salvar" aria-label={`Salvar ${rotulo.toLowerCase()}`} title="Salvar (Enter)" disabled={!rascunho.trim()} onClick={salvar}>
                <Check size={14} aria-hidden />
              </button>
              <button type="button" className="nx-ficha-botao" aria-label="Cancelar" title="Cancelar (Esc)" onClick={fechar}>
                <X size={14} aria-hidden />
              </button>
            </>
          ) : (
            <button ref={lapis} type="button" className="nx-ficha-botao" aria-label={`${linha.valor ? "Corrigir" : "Preencher"} ${rotulo.toLowerCase()}`} title={linha.valor ? `Corrigir ${rotulo.toLowerCase()}` : `Preencher ${rotulo.toLowerCase()}`} onClick={abrir}>
              <Pencil size={13} aria-hidden />
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function FichaDoMemorialCard({
  mensagemId,
  ficha,
  ultima = true,
}: {
  mensagemId: string;
  ficha: FichaDoMemorial;
  /** A ficha mais recente da conversa: só nela a dica da obra aparece. */
  ultima?: boolean;
}) {
  const corrigir = useCorrecaoDoMemorial();
  const onSalvar = corrigir ? (campo: CampoDoMemorial, valor: string) => corrigir(mensagemId, campo, valor) : null;

  return (
    <section className="nx-ficha" aria-label="Ficha do memorial">
      <header className="nx-ficha-cabeca">
        <FileText size={14} aria-hidden />
        <span className="nx-ficha-titulo">Memorial descritivo</span>
        <span className="nx-ficha-arquivo" title={ficha.arquivo}>
          {ficha.arquivo}
        </span>
      </header>
      {/*
        A DICA DA OBRA (10/10/2026, M2 do doc 08) mora logo abaixo da linha que
        ela explica, uma vez. Por isso a lista se parte em duas: um <dl> só não
        aceita a nota no meio das linhas.
      */}
      <div className="nx-ficha-linhas">
        <dl>
          {ficha.linhas.slice(0, 1).map((l) => (
            <Linha key={l.campo} linha={l} semCapa={Boolean(ficha.semCapa)} onSalvar={onSalvar} />
          ))}
        </dl>
        <DicaDeUmaVez id="ficha-da-obra" titulo="Confira o nome da obra" quando={ultima && Boolean(onSalvar) && ficha.linhas[0]?.campo === "obra"}>
          <p>É por ele que o Nexo descobre trecho copiado de outro projeto. Errado? Corrija no lápis antes de auditar.</p>
        </DicaDeUmaVez>
        <dl>
          {ficha.linhas.slice(1).map((l) => (
            <Linha key={l.campo} linha={l} semCapa={Boolean(ficha.semCapa)} onSalvar={onSalvar} />
          ))}
        </dl>
      </div>
      {ficha.divergencia && (
        <p className="nx-ficha-aviso" role="note">
          <i aria-hidden />
          {ficha.divergencia}
        </p>
      )}
    </section>
  );
}
