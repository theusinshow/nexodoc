"use client";

import { Check, Search, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  ADMIN_TOKEN_STORAGE_KEY,
  AdminError,
  AdminMetricStrip,
  AdminPageHeader,
  AdminPageShell,
  AdminTokenForm,
} from "@/components/admin/admin-page-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
  auditCount: number;
  sessionCount: number;
  ldDraftCount: number;
  ldGeneratedCount: number;
  createdAt: string;
  updatedAt: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function roleClass(role: AdminUser["role"]) {
  return role === "ADMIN"
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-border bg-muted text-muted-foreground";
}

function statusClass(isActive: boolean) {
  return isActive
    ? "border-[var(--status-ok)]/30 bg-[var(--status-ok-bg)] text-[var(--status-ok)]"
    : "border-destructive/30 bg-background text-destructive";
}

export default function AdminUsersPage() {
  const [token, setToken] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AdminUser["role"]>("USER");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  const allSelected = users.length > 0 && selectedIds.size === users.length;
  const someSelected = selectedIds.size > 0;
  const totals = useMemo(
    () => ({
      active: users.filter((user) => user.isActive).length,
      admins: users.filter((user) => user.role === "ADMIN" && user.isActive).length,
      lds: users.reduce((sum, user) => sum + user.ldDraftCount, 0),
      audits: users.reduce((sum, user) => sum + user.auditCount, 0),
    }),
    [users],
  );

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  }, [allSelected, users]);

  async function batchUpdateUsers(updates: Partial<Pick<AdminUser, "role" | "isActive">>) {
    if (selectedIds.size === 0) return;

    setBatchBusy(true);
    setError("");

    try {
      const ids = Array.from(selectedIds);
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids, ...updates }),
      });
      const payload = (await response.json().catch(() => null)) as { updatedCount?: number; error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível atualizar usuários em lote.");
      setUsers((current) =>
        current.map((user) =>
          ids.includes(user.id) ? { ...user, ...updates } : user,
        ),
      );
      setSelectedIds(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível atualizar usuários em lote.");
    } finally {
      setBatchBusy(false);
    }
  }

  async function loadUsers(nextToken = token) {
    const trimmedToken = nextToken.trim();

    if (!trimmedToken) {
      setError("Informe o token admin.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (role !== "all") params.set("role", role);
      if (status !== "all") params.set("status", status);

      const response = await fetch(`/api/admin/users?${params}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${trimmedToken}` },
      });
      const payload = (await response.json().catch(() => null)) as { users?: AdminUser[]; error?: string } | null;

      if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar usuários.");
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmedToken);
      setToken(trimmedToken);
      setUsers(payload?.users ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar usuários.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveUser(user: AdminUser) {
    setBusyId(user.id);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(user),
      });
      const payload = (await response.json().catch(() => null)) as { user?: AdminUser; error?: string } | null;

      if (!response.ok || !payload?.user) throw new Error(payload?.error ?? "Não foi possível salvar usuário.");
      setUsers((current) => current.map((item) => (item.id === payload.user!.id ? payload.user! : item)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar usuário.");
    } finally {
      setBusyId("");
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token.trim()) {
      setError("Informe o token admin antes de adicionar usuário.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newEmail,
          name: newName,
          role: newRole,
          isActive: true,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { user?: AdminUser; error?: string } | null;

      if (!response.ok || !payload?.user) throw new Error(payload?.error ?? "Não foi possível adicionar usuário.");
      sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token.trim());
      setUsers((current) => [payload.user!, ...current.filter((user) => user.id !== payload.user!.id)]);
      setNewEmail("");
      setNewName("");
      setNewRole("USER");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível adicionar usuário.");
    } finally {
      setLoading(false);
    }
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadUsers();
  }

  useEffect(() => {
    const storedToken = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "";
    if (storedToken) queueMicrotask(() => void loadUsers(storedToken));
    // Initial token restoration only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminPageShell>
      <AdminPageHeader
        icon={UsersRound}
        title="Usuários e permissões"
        description="Admins acessam todos os painéis. Remover usuário desativa o acesso sem apagar histórico."
        actions={
          <AdminTokenForm
            token={token}
            loading={loading}
            onTokenChange={setToken}
            onSubmit={submitFilters}
          />
        }
      />

        <AdminError message={error} />

        <AdminMetricStrip
          metrics={[
            { label: "Usuários", value: users.length },
            { label: "Ativos", value: totals.active },
            { label: "Admins", value: totals.admins },
            { label: "LDs", value: totals.lds },
          ]}
        />

        <form onSubmit={createUser} className="grid gap-2 border border-border bg-card p-3 lg:grid-cols-[1fr_1fr_160px_auto]">
          <div className="relative">
            <UserPlus className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="email@empresa.com" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
          </div>
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome" className="h-10 rounded-md border bg-background px-3 text-sm" />
          <select value={newRole} onChange={(event) => setNewRole(event.target.value as AdminUser["role"])} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="USER">Usuário</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button type="submit" disabled={loading || !newEmail.trim()}><UserPlus /> Adicionar</Button>
        </form>

        <form onSubmit={submitFilters} className="grid gap-2 border border-border bg-card p-3 md:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome ou e-mail" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
          </div>
          <select value={role} onChange={(event) => setRole(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">Todos papéis</option>
            <option value="ADMIN">Admins</option>
            <option value="USER">Usuários</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">Todos status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Desativados</option>
          </select>
          <Button type="submit" disabled={loading}>Filtrar</Button>
        </form>

        {someSelected ? (
          <div className="flex flex-wrap items-center gap-2 border border-primary/30 bg-card p-3">
            <span className="font-mono text-xs text-muted-foreground">
              {selectedIds.size} selecionado(s)
            </span>
            <Button
              type="button"
              size="sm"
              disabled={batchBusy}
              onClick={() => void batchUpdateUsers({ role: "ADMIN" })}
            >
              <ShieldCheck className="size-3.5" />
              Tornar admins
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={batchBusy}
              onClick={() => void batchUpdateUsers({ isActive: false })}
            >
              <X className="size-3.5" />
              Desativar
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={batchBusy}
              onClick={() => void batchUpdateUsers({ isActive: true })}
            >
              <Check className="size-3.5" />
              Ativar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Limpar seleção
            </Button>
          </div>
        ) : null}

        <section className="overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[1210px] border-collapse text-sm">
            <thead className="bg-[var(--nexodoc-recessed)] text-left font-mono text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="px-3 py-3">Usuário</th>
                <th className="px-3 py-3">Papel</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Auditorias</th>
                <th className="px-3 py-3 text-right">LDs</th>
                <th className="px-3 py-3 text-right">Geradas</th>
                <th className="px-3 py-3">Atualizado</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? users.map((user) => (
                <tr key={user.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(user.id)}
                      onChange={() => toggleSelect(user.id)}
                      aria-label={`Selecionar ${user.name}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="max-w-[320px] px-3 py-3">
                    <p className="truncate font-medium">{user.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-3 py-3"><span className={cn("border px-2 py-1 font-mono text-xs", roleClass(user.role))}>{user.role}</span></td>
                  <td className="px-3 py-3"><span className={cn("border px-2 py-1 font-mono text-xs", statusClass(user.isActive))}>{user.isActive ? "ATIVO" : "DESATIVADO"}</span></td>
                  <td className="px-3 py-3 text-right font-mono">{user.auditCount}</td>
                  <td className="px-3 py-3 text-right font-mono">{user.ldDraftCount}</td>
                  <td className="px-3 py-3 text-right font-mono">{user.ldGeneratedCount}</td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-muted-foreground">{formatDate(user.updatedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void saveUser({ ...user, role: user.role === "ADMIN" ? "USER" : "ADMIN" })}
                        disabled={busyId === user.id}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs transition hover:bg-muted disabled:opacity-50"
                      >
                        <ShieldCheck className="size-3.5" />
                        {user.role === "ADMIN" ? "Tornar usuário" : "Tornar admin"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveUser({ ...user, isActive: !user.isActive })}
                        disabled={busyId === user.id}
                        className="inline-flex h-9 items-center gap-1 rounded-md border border-border px-3 text-xs transition hover:bg-muted disabled:opacity-50"
                      >
                        <Check className="size-3.5" />
                        {user.isActive ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={9} className="p-10 text-center text-muted-foreground">Nenhum usuário encontrado.</td></tr>}
            </tbody>
          </table>
        </section>
    </AdminPageShell>
  );
}
