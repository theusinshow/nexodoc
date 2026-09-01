"use client";

/**
 * A CONVERSA DE UM ACHADO — a lista, o campo de escrever e os envolvidos.
 *
 * Arquivo PRÓPRIO, e não mais trezentas linhas em `audit-result.tsx`. Aquele
 * arquivo tem 4.859 linhas, e o componente `AuditResult` sozinho passa de três
 * mil — é exatamente assim que se chega a 4.859 linhas.
 *
 * Assíncrono de propósito: recarrega ao montar e depois de cada ação, e nada
 * mais. Sem SSE e sem polling — o defeito que este trabalho conserta é ausência
 * de canal, não latência.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LinhaLegivel } from "@/lib/conversa-do-achado";

import { LinhaDaConversa } from "./linha-da-conversa";

type Envolvido = { email: string; nome: string };
type Membro = { email: string; name?: string | null };

export function ConversaDoAchado({
  auditId,
  findingId,
  membros,
}: {
  auditId: string;
  findingId: string;
  membros: readonly Membro[];
}) {
  const [linhas, setLinhas] = useState<LinhaLegivel[]>([]);
  const [envolvidos, setEnvolvidos] = useState<Envolvido[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /*
   * PEDIR A CARGA DE NOVO — um contador, e não uma função chamada de fora.
   *
   * É o mesmo padrão de `releituras` em [[components/audit-result.tsx]], e pela
   * mesma razão: o React Compiler barra `setState` chamado direto do corpo de um
   * efeito, e a barra tem razão — o que muda depois de enviar é a INTENÇÃO de
   * reler, não a chamada.
   */
  const [releituras, setReleituras] = useState(0);

  const base = `/api/audits/${encodeURIComponent(auditId)}/achados/${encodeURIComponent(findingId)}`;

  useEffect(() => {
    let vivo = true;

    async function carregar() {
      try {
        const r = await fetch(`${base}/conversa`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const p = (await r.json()) as { linhas?: LinhaLegivel[]; envolvidos?: Envolvido[] };
        if (!vivo) return;
        setLinhas(p.linhas ?? []);
        setEnvolvidos(p.envolvidos ?? []);
        setErro(null);
      } catch {
        /* A conversa é acessória ao parecer: falhar aqui não pode derrubar a
         * tela do achado. Diz o que houve e deixa o resto de pé. */
        if (vivo) setErro("Não deu para carregar a conversa.");
      }
    }

    void carregar();

    return () => {
      vivo = false;
    };
  }, [base, releituras]);

  async function enviar() {
    const corpo = texto.trim();
    if (!corpo || ocupado) return;
    setOcupado(true);
    try {
      const r = await fetch(`${base}/conversa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: corpo }),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Não deu para enviar.");
      }
      setTexto("");
      setReleituras((n) => n + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para enviar.");
    } finally {
      setOcupado(false);
    }
  }

  async function mexerNoEnvolvido(email: string, nome: string, entra: boolean) {
    setOcupado(true);
    try {
      await fetch(`${base}/envolvidos`, {
        method: entra ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, nome }),
      });
      setReleituras((n) => n + 1);
    } finally {
      setOcupado(false);
    }
  }

  const disponiveis = membros.filter(
    (m) => !envolvidos.some((e) => e.email === m.email.toLowerCase()),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
          Acompanham
        </span>
        {envolvidos.length === 0 ? (
          <span className="text-[11.5px] text-muted-foreground">ninguém ainda</span>
        ) : (
          envolvidos.map((e) => (
            <button
              key={e.email}
              type="button"
              disabled={ocupado}
              onClick={() => void mexerNoEnvolvido(e.email, e.nome, false)}
              className="nx-edge-6 px-2 py-0.5 text-[11.5px] [--nx-edge:var(--border)] hover:[--nx-fill:var(--accent)] disabled:opacity-50"
              title="Tirar dos envolvidos"
            >
              {e.nome} ×
            </button>
          ))
        )}
        {disponiveis.length > 0 ? (
          <Select
            className="h-8 w-44"
            value=""
            disabled={ocupado}
            onChange={(ev) => {
              const m = disponiveis.find((x) => x.email === ev.target.value);
              if (m) void mexerNoEnvolvido(m.email, m.name ?? "", true);
            }}
          >
            <option value="">+ envolver alguém</option>
            {disponiveis.map((m) => (
              <option key={m.email} value={m.email}>
                {m.name || m.email}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {linhas.length === 0 ? (
        <p className="m-0 text-[11.5px] text-muted-foreground">
          Nada dito ainda sobre este achado.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {linhas.map((l, i) => (
            <LinhaDaConversa key={`${l.createdAt}-${i}`} linha={l} />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva para quem está neste achado…"
          rows={2}
        />
        <div className="flex items-center justify-between gap-2">
          {erro ? (
            <span className="text-[11.5px] text-muted-foreground">{erro}</span>
          ) : (
            <span />
          )}
          <Button onClick={() => void enviar()} disabled={ocupado || !texto.trim()}>
            Enviar
          </Button>
        </div>
      </div>
    </section>
  );
}
