"use client";

import { FileSpreadsheet, Search, Trash2, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  AdminError,
  AdminMetricStrip,
  TituloDaSecao,
} from "@/components/admin/admin-page-shell";
import { useAdminToken } from "@/components/admin/admin-token";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { rotuloDeLd } from "@/lib/rotulos-de-status";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

type LdRecord = {
  id: string;
  title: string;
  projectCode: string;
  workName: string;
  userEmail: string;
  userName: string | null;
  status: "DRAFT" | "GENERATED" | "ARCHIVED";
  activeStep: number;
  rowCount: number;
  tomoCount: number;
  uploadedFileCount: number;
  eventCount: number;
  updatedAt: string;
  generatedAt: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

/** A variante do `<Badge>`, e nao as classes: ver `scripts/prova-badge-a-mao.mjs`. */
function statusVariant(status: LdRecord["status"]) {
  if (status === "GENERATED") return "ok" as const;
  if (status === "ARCHIVED") return "secondary" as const;
  return "warning" as const;
}

export function CorpoDasLds() {
  /*
   * O token vem do trilho, nao desta tela. `registrarResposta` e o que responde
   * "o token foi aceito?": lista vazia nao responde, porque "nenhum resultado" e
   * "nunca carregou" sao o mesmo array.
   */
  const { token, restaurado, recarga, registrarResposta } = useAdminToken();
  const [lds, setLds] = useState<LdRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [user, setUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const totals = useMemo(
    () => ({
      generated: lds.filter((ld) => ld.status === "GENERATED").length,
      rows: lds.reduce((sum, ld) => sum + ld.rowCount, 0),
      events: lds.reduce((sum, ld) => sum + ld.eventCount, 0),
    }),
    [lds],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === lds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(lds.map((ld) => ld.id)));
    }
  }

  async function handleDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`Excluir permanentemente ${plural(selected.size, "LD selecionada", "LDs selecionadas")}? Esta ação remove todos os eventos vinculados.`)) return;

    setDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/lds", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: [...selected] }),
      });

      const payload = (await response.json().catch(() => null)) as { deleted?: number; error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Erro ao excluir LDs.");

      setLds((prev) => prev.filter((ld) => !selected.has(ld.id)));
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir LDs.");
    } finally {
      setDeleting(false);
    }
  }

  async function loadLds(nextToken = token) {
    if (!nextToken.trim()) {
      setError("Informe o token admin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") params.set("status", status);
      if (user.trim()) params.set("user", user.trim());

      const response = await fetch(`/api/admin/lds?${params}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${nextToken.trim()}` },
      });
      const payload = (await response.json().catch(() => null)) as { lds?: LdRecord[]; error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar LDs.");
      registrarResposta(true);
      setLds(payload?.lds ?? []);
      setSelected(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar LDs.");
      registrarResposta(false);
    } finally {
      setLoading(false);
    }
  }

  /*
   * Busca quando houver token e quando o trilho pedir recarga. `restaurado`
   * evita o pedido do primeiro render, antes de o `sessionStorage` ter sido
   * lido.
   */
  useEffect(() => {
    if (!restaurado || !token.trim()) return;
    /*
     * `queueMicrotask` porque a carga chama `setState` no corpo dela, e o
     * React Compiler barra `setState` sincrono dentro de efeito. E o mesmo
     * contorno que este arquivo ja usava na restauracao do token.
     */
    queueMicrotask(() => void loadLds(token));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, restaurado, recarga]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLds();
  }

  return (
    <section className="flex flex-col gap-4">
      <TituloDaSecao
        icon={FileSpreadsheet}
        titulo="Operação de LDs"
        /*
         * "Em montagem" saiu com a tela de montagem: o rascunho contínuo era
         * dela. O que chega aqui agora é LD GERADA, pelo Nexo — descrever um
         * estado que não se produz mais faria o filtro parecer quebrado.
         */
        descricao="As LDs geradas, por usuário — é o registro do servidor, o mesmo que o Nexo alimenta. PDFs anexados não são armazenados."
      />
        <AdminError message={error} />
        <AdminMetricStrip
          metrics={[
            { label: "LDs", value: lds.length },
            { label: "Geradas", value: totals.generated },
            { label: "Pranchas", value: totals.rows },
            { label: "Eventos", value: totals.events },
          ]}
        />
        <form onSubmit={submit} className="grid gap-2 nx-edge-8 p-3 md:grid-cols-[1fr_180px_250px_auto]">
          <div className="nx-edge-7 relative [--nx-fill:var(--nexodoc-recessed)]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código ou obra" className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none" />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10">
            <option value="all">Todos status</option><option value="DRAFT">Rascunho</option><option value="GENERATED">Gerada</option><option value="ARCHIVED">Arquivada</option>
          </Select>
          <div className="nx-edge-7 relative [--nx-fill:var(--nexodoc-recessed)]">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="Usuário" className="h-10 w-full bg-transparent pl-9 pr-3 text-sm outline-none" />
          </div>
          <Button type="submit" disabled={loading}>Filtrar</Button>
        </form>

        {selected.size > 0 && (
          <div className="flex items-center justify-between border border-destructive/30 bg-destructive/8 px-4 py-3">
            <span className="text-sm text-destructive">{plural(selected.size, "LD selecionada", "LDs selecionadas")}</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {deleting ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </div>
        )}

        <section className="nx-edge-8 min-w-0 overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={lds.length > 0 && selected.size === lds.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 accent-primary"
                  />
                </th>
                <th className="px-3 py-3">Projeto / obra</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Usuário</th>
                <th className="px-3 py-3 text-right">Pranchas</th><th className="px-3 py-3 text-right">PDFs</th><th className="px-3 py-3 text-right">Tomos</th><th className="px-3 py-3 text-right">Eventos</th><th className="px-3 py-3">Atualizada</th>
              </tr>
            </thead>
            <tbody>
              {lds.length ? lds.map((ld) => (
                <tr key={ld.id} className={cn("border-t border-border", selected.has(ld.id) ? "bg-primary/5" : "hover:bg-muted/30")}>
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(ld.id)}
                      onChange={() => toggleSelect(ld.id)}
                      className="h-4 w-4 accent-primary"
                    />
                  </td>
                  <td className="max-w-[320px] px-3 py-3"><p className="font-mono font-semibold">{ld.projectCode || "-"}</p><p className="truncate text-muted-foreground">{ld.workName || "Obra não preenchida"}</p></td>
                  <td className="px-3 py-3"><Badge variant={statusVariant(ld.status)}>{rotuloDeLd(ld.status)}</Badge></td>
                  <td className="max-w-[250px] px-3 py-3"><p className="truncate">{ld.userName || ld.userEmail}</p><p className="truncate text-xs text-muted-foreground">{ld.userEmail}</p></td>
                  <td className="px-3 py-3 text-right font-mono">{ld.rowCount}</td><td className="px-3 py-3 text-right font-mono">{ld.uploadedFileCount}</td><td className="px-3 py-3 text-right font-mono">{ld.tomoCount}</td><td className="px-3 py-3 text-right font-mono">{ld.eventCount}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-muted-foreground">{formatDate(ld.updatedAt)}</td>
                </tr>
              )) : (
                /*
                 * O vazio ENSINA (DESIGN.md): dizer só "nenhuma LD encontrada"
                 * deixa o admin sem saber se o filtro está apertado, se ninguém
                 * gerou nada ainda, ou se a tela quebrou.
                 */
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      icon={FileSpreadsheet}
                      label="Nenhuma LD"
                      description="As listas geradas no Nexo aparecem aqui, com quem gerou e quantas pranchas entraram. Se você filtrou por código, obra ou usuário, limpe o filtro para ver todas."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
    </section>
  );
}
