import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ProjectContext } from "@/lib/project-context";
import { cn } from "@/lib/utils";

type ProjectContextStripProps = {
  project: ProjectContext | null;
  moduleName?: string;
  className?: string;
};

export function ProjectContextStrip({
  project,
  moduleName = "Modulo",
  className,
}: ProjectContextStripProps) {
  if (!project) {
    return (
      <section
        className={cn(
          "flex flex-col gap-3 rounded-sm border border-dashed bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border bg-muted text-muted-foreground">
            <FolderKanban className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Modo independente</Badge>
              <span className="font-mono text-xs font-medium text-muted-foreground">
                {moduleName}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium">Nenhum projeto vinculado</p>
            <p className="text-xs text-muted-foreground">
              Saidas geradas aqui nao entram automaticamente no cockpit de projeto.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href="/projetos">
            Projetos
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-sm border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border bg-muted text-muted-foreground">
          <FolderKanban className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Projeto vinculado</Badge>
            <span className="font-mono text-xs font-medium text-muted-foreground">
              {moduleName}
            </span>
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
