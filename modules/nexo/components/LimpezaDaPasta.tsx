"use client";

/**
 * A LIMPEZA GUIADA DE UMA PASTA — o software encontra, a pessoa decide.
 *
 * A causa das conversas repetidas foi consertada em [[ultima-conversa.ts]]: o
 * F5 deixou de abrir conversa nova. Este painel é a outra metade — a bagunça
 * que já existe. Numa pasta real havia quatro conversas "MET" do mesmo volume;
 * noutra, dezessete "Nova conversa".
 *
 * NADA AQUI DECIDE. A regra (`candidatasDaPasta`) é pura, testada em node cru,
 * e devolve candidatas com o MOTIVO e o QUE CADA UMA PRODUZIU. Este componente
 * mostra e pergunta. "3 conversas" é uma contagem; "LD, capa e volume, 31/08
 * 10:28" é uma decisão — e é por isso que cada linha diz o que se perde.
 *
 * NADA VEM MARCADO. Uma caixa marcada por padrão transforma "revisar" em
 * "confirmar", e é o oposto do que este painel existe para fazer.
 */

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  candidatasDaPasta,
  type Candidata,
  type ConversaDaPasta,
} from "../lib/conversas-superadas";

/** "31/08 10:28" — data e hora, que é o que distingue conversas irmãs. */
function quando(ms: number): string {
  const d = new Date(ms);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} ${hora}`;
}

const ROTULO_DO_KIND: Record<string, string> = {
  ld: "LD",
  capa: "capa",
  separatriz: "separatriz",
  volume: "volume",
  auditoria: "auditoria",
  conferencia: "conferência",
};

/** O que a conversa produziu, em português e sem jargão de campo. */
function oQueProduziu(kinds: readonly string[]): string {
  if (kinds.length === 0) return "não produziu nada";
  return kinds.map((k) => ROTULO_DO_KIND[k] ?? k).join(" · ");
}

export function LimpezaDaPasta({
  pasta,
  idAberta,
  onApagar,
  onFechar,
}: {
  /** A chave da pasta; `null` é a região "Sem pasta". */
  pasta: string | null;
  idAberta?: string;
  onApagar: (ids: string[]) => void;
  onFechar: () => void;
}) {
  const [estado, setEstado] = useState<"lendo" | "pronto" | "erro">("lendo");
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    let vivo = true;
    /*
     * SEM `setEstado("lendo")` aqui: o estado JÁ nasce "lendo", e o componente
     * é montado de novo a cada pasta (a chamada passa `key`). Marcar de novo
     * seria escrever estado dentro do efeito para chegar ao valor que ele já
     * tem — e o lint recusa, com razão.
     */
    /*
     * `pasta ?? ""` e não omitir o parâmetro: a rota recusa a ausência com 400
     * de propósito, porque "sem parâmetro" lido como "todas as pastas" a faria
     * abrir o `data` de todas as conversas — o custo que este desenho evita.
     */
    fetch(`/api/nexo/conversas/limpeza?pasta=${encodeURIComponent(pasta ?? "")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((payload: { conversas?: ConversaDaPasta[] }) => {
        if (!vivo) return;
        setCandidatas(candidatasDaPasta(payload.conversas ?? [], { idAberta }));
        setEstado("pronto");
      })
      .catch(() => {
        if (vivo) setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [pasta, idAberta]);

  const alternar = (id: string) =>
    setMarcadas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  return (
    <div className="nx-cut-6 mt-1 bg-[var(--nexodoc-recessed)] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
          Limpar a pasta
        </span>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar a limpeza"
          className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
        </button>
      </div>

      {estado === "lendo" && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          procurando o que dá para apagar…
        </p>
      )}

      {estado === "erro" && (
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          Não deu para ler esta pasta agora. Nada foi alterado.
        </p>
      )}

      {/*
        O ESTADO VAZIO ENSINA, como manda a DESIGN.md: diz o que foi procurado,
        para "nada aqui" não virar dúvida sobre se a busca aconteceu.
      */}
      {estado === "pronto" && candidatas.length === 0 && (
        <p className="mt-2 text-[11.5px] leading-5 text-muted-foreground">
          Nada a apagar. Toda conversa desta pasta produziu algo que nenhuma
          outra, mais nova, já tem.
        </p>
      )}

      {estado === "pronto" && candidatas.length > 0 && (
        <>
          <ul className="mt-2 space-y-1">
            {candidatas.map((c) => {
              const marcada = marcadas.has(c.id);
              return (
                <li key={c.id}>
                  <label className="nx-edge-5 flex cursor-pointer items-start gap-2 px-2 py-1.5 [--nx-edge:transparent] [--nx-fill:transparent] hover:[--nx-fill:var(--accent)]">
                    <input
                      type="checkbox"
                      checked={marcada}
                      onChange={() => alternar(c.id)}
                      className="mt-0.5 size-3.5 shrink-0 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="flex-1 truncate text-[12.5px] text-foreground">
                          {c.title}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {quando(c.updatedAt)}
                        </span>
                      </span>
                      {/*
                        O QUE SE PERDE, embaixo do nome. Sem esta linha o painel
                        pediria uma decisão sobre um id.
                      */}
                      <span className="mt-0.5 block font-mono text-[11px] leading-4 text-muted-foreground">
                        {oQueProduziu(c.kinds)}
                        {c.motivo === "superada" && c.superadaPor
                          ? ` — já está numa mais nova (${quando(c.superadaPor.updatedAt)})`
                          : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={marcadas.size === 0}
              onClick={() => onApagar([...marcadas])}
              className="text-[var(--status-critical)]"
            >
              Apagar {marcadas.size > 0 ? marcadas.size : ""}
            </Button>
            <span className="font-mono text-[11px] text-muted-foreground">
              {candidatas.length} candidata{candidatas.length === 1 ? "" : "s"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
