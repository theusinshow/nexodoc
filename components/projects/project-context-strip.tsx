import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectContext } from "@/lib/project-context";

export function ProjectContextStrip({ project }: { project: ProjectContext | null }) {
  if (!project) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-sm border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border bg-muted text-muted-foreground">
          <FolderKanban className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Projeto vinculado</Badge>
            <span className="font-mono text-xs font-medium text-muted-foreground">{project.code}</span>
          </div>
          <p className="mt-1 truncate text-sm font-medium">{project.name}</p>
          {project.client ? (
            <p className="truncate text-xs text-muted-foreground">{project.client}</p>
          ) : null}
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={`/projetos/${project.id}`}>
          Abrir projeto
          <ArrowUpRight className="size-3.5" />
        </Link>
      </Button>
    </section>
  );
}
