"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, Save, Trash2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ProjectStatus = "ACTIVE" | "ARCHIVED";

type ProjectEditable = {
  id: string;
  code: string;
  name: string;
  client: string;
  description: string;
  status: ProjectStatus;
};

export function ProjectDetailActions({ project }: { project: ProjectEditable }) {
  const router = useRouter();
  const [form, setForm] = useState({
    code: project.code,
    name: project.name,
    client: project.client,
    description: project.description,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function patchProject(payload: Record<string, string>) {
    setError("");
    setNotice("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Nao foi possivel atualizar o projeto.");
        }

        setNotice("Projeto atualizado.");
        router.refresh();
      } catch (patchError) {
        setError(patchError instanceof Error ? patchError.message : "Nao foi possivel atualizar o projeto.");
      }
    });
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.code.trim() || !form.name.trim()) {
      setError("Codigo e nome sao obrigatorios.");
      return;
    }

    patchProject({
      code: form.code.trim(),
      name: form.name.trim(),
      client: form.client.trim(),
      description: form.description.trim(),
    });
  }

  function handleStatusChange(status: ProjectStatus) {
    patchProject({ status });
  }

  function handleDelete() {
    const confirmed = window.confirm("Excluir este projeto? Os registros ficam preservados como historico soft-delete.");

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/projects/${project.id}`, {
          method: "DELETE",
        });
        const data = (await response.json().catch(() => null)) as { error?: string } | null;

        if (!response.ok) {
          throw new Error(data?.error ?? "Nao foi possivel excluir o projeto.");
        }

        router.push("/projetos");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel excluir o projeto.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Controle do projeto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajuste os dados operacionais e o status do dossie consolidado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.status === "ARCHIVED" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("ACTIVE")} disabled={isPending}>
                <Undo2 className="size-4" />
                Reativar
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => handleStatusChange("ARCHIVED")} disabled={isPending}>
                <Archive className="size-4" />
                Arquivar
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={handleDelete} disabled={isPending}>
              <Trash2 className="size-4" />
              Excluir
            </Button>
          </div>
        </div>

        <form className="grid gap-4 lg:grid-cols-[180px_1fr_1fr] lg:items-end" onSubmit={handleSave}>
          <div className="space-y-2">
            <Label htmlFor="detail-code">Codigo</Label>
            <Input
              id="detail-code"
              value={form.code}
              onChange={(event) => updateForm("code", event.target.value.toLocaleUpperCase("pt-BR"))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-name">Nome</Label>
            <Input id="detail-name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="detail-client">Cliente</Label>
            <Input id="detail-client" value={form.client} onChange={(event) => updateForm("client", event.target.value)} />
          </div>
          <div className="space-y-2 lg:col-span-3">
            <Label htmlFor="detail-description">Observacoes</Label>
            <Textarea
              id="detail-description"
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-3 sm:flex-row sm:items-center">
            <Button disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar alteracoes
            </Button>
            {notice ? <span className="text-sm text-[var(--status-ok)]">{notice}</span> : null}
            {error ? <span className="text-sm text-destructive">{error}</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
