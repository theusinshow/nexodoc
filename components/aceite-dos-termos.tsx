"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { AvisoDeResponsabilidade } from "@/components/aviso-de-responsabilidade";
import { Botao } from "@/components/ds/basicos";
import { Camada } from "@/components/moldura/sobreposicoes";
import { ROTA_DOS_TERMOS, VERSAO_DOS_TERMOS } from "@/lib/aviso-de-responsabilidade";

import "./aviso-de-responsabilidade.css";

/*
 * O ACEITE ANTES DA PRIMEIRA AUDITORIA.
 *
 * A fonte da verdade é o banco (`User.termsAcceptedAt` / `termsVersion`, pela
 * rota /api/termos/aceite): vale por PESSOA, em qualquer aparelho. Só quando o
 * servidor responde `semBanco` (ambiente sem Postgres) o aceite cai para o
 * localStorage — e aí vale por NAVEGADOR, não por pessoa: trocar de aparelho
 * ou limpar os dados do site pede o aceite de novo, e duas pessoas no mesmo
 * navegador compartilham o aceite. É limitação conhecida, documentada.
 *
 * O portão é do cliente: a rota de auditoria não recusa quem não aceitou,
 * porque o motor de auditoria não é tocado por este recurso. Quem chamar a API
 * direto não passa pelo aceite.
 */
const CHAVE_LOCAL = "nexodoc:termos-aceitos";

type Estado = "desconhecido" | "aceito";
let cache: Estado = "desconhecido";

function aceitoNoNavegador() {
  try {
    return window.localStorage.getItem(CHAVE_LOCAL) === VERSAO_DOS_TERMOS;
  } catch {
    return false;
  }
}

async function jaAceitou(): Promise<boolean> {
  if (cache === "aceito") return true;
  try {
    const res = await fetch("/api/termos/aceite", { cache: "no-store" });
    if (!res.ok) return false;
    const corpo = (await res.json()) as { aceito?: boolean; semBanco?: boolean };
    const aceito = corpo.semBanco ? aceitoNoNavegador() : Boolean(corpo.aceito);
    if (aceito) cache = "aceito";
    return aceito;
  } catch {
    // Sem resposta do servidor não dá para provar o aceite: pede de novo.
    return false;
  }
}

async function registrarAceite(): Promise<boolean> {
  try {
    const res = await fetch("/api/termos/aceite", { method: "POST" });
    if (!res.ok) return false;
    const corpo = (await res.json()) as { ok?: boolean; semBanco?: boolean };
    if (!corpo.ok) return false;
    if (corpo.semBanco) {
      try {
        window.localStorage.setItem(CHAVE_LOCAL, VERSAO_DOS_TERMOS);
      } catch {
        // Armazenamento bloqueado: vale para esta sessão da aba (cache abaixo).
      }
    }
    cache = "aceito";
    return true;
  } catch {
    return false;
  }
}

/**
 * `exigirAceite()` resolve `true` se a pessoa já aceitou (ou aceita agora) e
 * `false` se desistiu. Renderize `modal` em qualquer lugar do componente.
 */
export function useAceiteDosTermos(): { exigirAceite: () => Promise<boolean>; modal: ReactNode } {
  const [aberto, setAberto] = useState(false);
  const resolver = useRef<((aceitou: boolean) => void) | null>(null);

  const exigirAceite = useCallback(async () => {
    if (await jaAceitou()) return true;
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setAberto(true);
    });
  }, []);

  const encerrar = useCallback((aceitou: boolean) => {
    setAberto(false);
    resolver.current?.(aceitou);
    resolver.current = null;
  }, []);

  useEffect(() => () => resolver.current?.(false), []);

  return {
    exigirAceite,
    modal: aberto ? <ModalDoAceite onResposta={encerrar} /> : null,
  };
}

function ModalDoAceite({ onResposta }: { onResposta: (aceitou: boolean) => void }) {
  const [marcado, setMarcado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idMarca = useId();
  const caixa = useRef<HTMLInputElement>(null);

  // Esc, clique fora e foco de volta ficam com a `Camada`; aqui só o foco de entrada.
  useEffect(() => {
    caixa.current?.focus();
  }, []);

  const cancelar = useCallback(() => onResposta(false), [onResposta]);

  async function aceitar() {
    setGravando(true);
    setErro(null);
    if (await registrarAceite()) {
      onResposta(true);
      return;
    }
    setGravando(false);
    setErro("Não foi possível registrar o aceite. Tente de novo.");
  }

  return (
    <Camada aberta onFechar={cancelar} rotulo="Antes da primeira auditoria" largura={480}>
      <header className="ar-cabeca">
        <h2>Antes da primeira auditoria</h2>
        <Botao variante="quiet" icone aria-label="Fechar" onClick={cancelar}>
          <X />
        </Botao>
      </header>
      <div className="ar-corpo">
        <AvisoDeResponsabilidade />
        <label htmlFor={idMarca} className="ar-aceite">
          <input id={idMarca} ref={caixa} type="checkbox" className="ar-marca" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
          <span>
            Li e aceito os{" "}
            <Link href={ROTA_DOS_TERMOS} target="_blank" rel="noopener" className="ar-link">
              termos de uso e a limitação de responsabilidade
            </Link>
            .
          </span>
        </label>
        {erro && (
          <p role="alert" className="ar-erro">
            {erro}
          </p>
        )}
        <div className="ar-acoes">
          <Botao variante="ghost" onClick={cancelar}>
            Cancelar
          </Botao>
          <Botao variante="primary" disabled={!marcado || gravando} onClick={aceitar}>
            Aceitar e continuar
          </Botao>
        </div>
      </div>
    </Camada>
  );
}
