"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Database, FolderKanban, Loader2, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Ima } from "@/components/ambiente/ima";

export type ProjectConsoleItem = {
  id: string;
  code: string;
  name: string;
  client: string;
  description: string;
  status: string;
  updatedAt: string;
  counts: {
    documents: number;
    uploads: number;
    artifacts: number;
    events: number;
  };
};

type FormState = {
  code: string;
  name: string;
  client: string;
  description: string;
};

const initialForm: FormState = {
  code: "",
  name: "",
  client: "",
  description: "",
};

export function ProjectConsole({ initialProjects }: { initialProjects: ProjectConsoleItem[] }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) =>
      [project.code, project.name, project.client]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [projects, query]);

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      client: form.client.trim(),
      description: form.description.trim(),
    };

    if (!payload.code || !payload.name) {
      setError("Informe codigo e nome do projeto.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json().catch(() => null)) as
          | { project?: { id: string }; error?: string }
          | null;

        if (!response.ok || !data?.project) {
          throw new Error(data?.error ?? "Nao foi possivel criar o projeto.");
        }

        setForm(initialForm);
        router.push(`/projetos/${data.project.id}`);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Nao foi possivel criar o projeto.");
      }
    });
  }

  function updateForm(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Card>
        <CardContent className="space-y-5 py-5">
          <div>
            <h2 className="text-base font-semibold">Novo projeto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie o dossie para vincular auditoria, LD, capas e volumes ao mesmo registro.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleCreateProject}>
            <div className="space-y-2">
              <Label htmlFor="project-code">Codigo</Label>
              <Input
                id="project-code"
                value={form.code}
                onChange={(event) => updateForm("code", event.target.value.toLocaleUpperCase("pt-BR"))}
                placeholder="EX: 2026-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Nome do projeto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-client">Cliente</Label>
              <Input
                id="project-client"
                value={form.client}
                onChange={(event) => updateForm("client", event.target.value)}
                placeholder="Orgao, prefeitura ou contratante"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Observacoes</Label>
              <Textarea
                id="project-description"
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                rows={4}
                placeholder="Escopo, fase, lote ou detalhes operacionais"
              />
            </div>

            {error ? (
              <p className="border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {/* O segundo (e último) controle com ímã no produto. `w-full` sobe
                para o invólucro, senão o botão perde a largura ao ganhar um pai
                `inline-flex`. */}
            <Ima className="w-full">
              <Button className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Criar projeto
              </Button>
            </Ima>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-[340px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar por codigo, nome ou cliente"
              className="pl-9"
            />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {filteredProjects.length} de {projects.length} projeto(s)
          </span>
        </div>

        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-6">
              <Database className="size-5 text-muted-foreground" />
              <div>
                <h2 className="text-base font-semibold">Nenhum projeto encontrado</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajuste o filtro ou crie um projeto para iniciar o fluxo consolidado.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredProjects.map((project) => (
              <Card key={project.id}>
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="size-4 text-primary" />
                        <h2 className="truncate text-lg font-semibold">{project.name}</h2>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{project.code}</p>
                    </div>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-px overflow-hidden border border-border bg-border text-center">
                    <Metric label="Docs" value={project.counts.documents} />
                    <Metric label="Uploads" value={project.counts.uploads} />
                    <Metric label="Artefatos" value={project.counts.artifacts} />
                    <Metric label="Eventos" value={project.counts.events} />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                      Atualizado em {formatDate(project.updatedAt)}
                    </span>
                    <Button asChild size="sm">
                      <Link href={`/projetos/${project.id}`}>
                        Abrir
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
