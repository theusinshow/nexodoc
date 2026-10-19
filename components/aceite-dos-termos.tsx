"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AVISO_DE_RESPONSABILIDADE, ROTA_DOS_TERMOS, VERSAO_DOS_TERMOS } from "@/lib/aviso-de-responsabilidade";

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
  const idTitulo = useId();
  const idMarca = useId();
  const caixa = useRef<HTMLInputElement>(null);

  useEffect(() => {
    caixa.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResposta(false);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onResposta]);

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="nx-cut-8 w-full max-w-lg border border-border bg-card p-6 text-foreground"
      >
        <h2 id={idTitulo} className="text-lg font-medium">
          Antes da primeira auditoria
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{AVISO_DE_RESPONSABILIDADE}</p>
        <label htmlFor={idMarca} className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            id={idMarca}
            ref={caixa}
            checked={marcado}
            onChange={(e) => setMarcado(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Li e aceito os{" "}
            <Link href={ROTA_DOS_TERMOS} target="_blank" rel="noopener" className="text-primary underline underline-offset-2">
              termos de uso e a limitação de responsabilidade
            </Link>
            .
          </span>
        </label>
        {erro && (
          <p role="alert" className="mt-3 text-sm text-[var(--status-critical)]">
            {erro}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onResposta(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={!marcado || gravando} onClick={aceitar}>
            Aceitar e continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
