import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, FileArchive, FileText, Layers3, TableProperties } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectDetailActions } from "@/components/projects/project-detail-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { assertProjectAccess, getUserActor, normalizeEmail } from "@/lib/project-store";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirectToLogin(`/projetos/${encodeURIComponent(id)}`);
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !isDatabaseConfigured()) {
    redirect("/projetos");
  }

  const actor = await getUserActor(normalizeEmail(session.user.email ?? ""), session.user.name);

  try {
    await assertProjectAccess(id, actor);
  } catch {
    notFound();
  }

  const project = await getPrisma().project.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" }, take: 20 },
      uploads: { orderBy: { createdAt: "desc" }, take: 20 },
      artifacts: { orderBy: { createdAt: "desc" }, take: 30 },
      events: { orderBy: { createdAt: "desc" }, take: 30 },
      _count: {
        select: {
          documents: true,
          uploads: true,
          artifacts: true,
          events: true,
        },
      },
    },
  });

  if (!project || project.deletedAt) {
    notFound();
  }

  const hasAuditOutput = project.artifacts.some((artifact) =>
    artifact.module === "audit" || artifact.kind.toString().startsWith("AUDIT_"),
  );
  const hasLdOutput =
    project.artifacts.some((artifact) =>
      artifact.module === "ld" || artifact.kind.toString().startsWith("LD_"),
    ) || project.documents.some((document) => document.module === "ld");
  const hasCoverOutput = project.artifacts.some((artifact) =>
    artifact.module === "capas" || artifact.kind.toString().startsWith("COVER_"),
  );
  const hasVolumeOutput = project.artifacts.some((artifact) =>
    artifact.module === "volumes" || artifact.kind.toString().startsWith("VOLUME_"),
  );

  const moduleLinks = [
    {
      label: "Auditoria",
      action: "Auditar documentos",
      description: "Checar memoriais, capas, LDs, pranchas e divergencias documentais.",
      href: `/audit?project=${project.id}`,
      icon: BookOpenCheck,
      completed: hasAuditOutput,
    },
    {
      label: "LD",
      action: "Montar LD",
      description: "Ler selos, revisar pranchas, ajustar tomos e gerar pacote final.",
      href: `/ld?project=${project.id}`,
      icon: TableProperties,
      completed: hasLdOutput,
    },
    {
      label: "Capas",
      action: "Gerar capas",
      description: "Gerar capas tecnicas a partir dos dados confirmados do projeto.",
      href: `/capas?project=${project.id}`,
      icon: FileText,
      completed: hasCoverOutput,
    },
    {
      label: "Volumes",
      action: "Montar volume",
      description: "Classificar arquivos, organizar paginas, conferir e exportar o volume.",
      href: `/volumes?project=${project.id}`,
      icon: Layers3,
      completed: hasVolumeOutput,
    },
  ] as const;
  const nextModule = moduleLinks.find((item) => !item.completed) ?? moduleLinks[0];
  const NextIcon = nextModule.icon;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 sm:px-7">
      <PageHeader
        title={project.name}
        description={`${project.code} · ${project.ownerEmail}`}
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/projetos">
            <ArrowLeft className="size-4" />
            Projetos
          </Link>
        </Button>
      </PageHeader>

      <ProjectDetailActions
        project={{
          id: project.id,
          code: project.code,
          name: project.name,
          client: project.client,
          description: project.description,
          status: project.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
        }}
      />

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="Documentos" value={project._count.documents} />
        <Metric label="Arquivos enviados" value={project._count.uploads} />
        <Metric label="Artefatos" value={project._count.artifacts} />
        <Metric label="Eventos" value={project._count.events} />
      </section>

      <section className="rounded-sm border bg-card px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase text-muted-foreground">Próxima ação</p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-semibold">
              <NextIcon className="size-4 text-primary" />
              {nextModule.action}
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{nextModule.description}</p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={nextModule.href}>
              Abrir
              <NextIcon className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {moduleLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.href}>
              <CardContent className="flex h-full flex-col gap-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border bg-muted text-primary">
                    <Icon className="size-4" />
                  </div>
                  <Badge variant={item.completed ? "secondary" : "outline"}>
                    {item.completed ? "Com registros" : "Pendente"}
                  </Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold">{item.label}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full justify-between">
                  <Link href={item.href}>
                    {item.action}
                    <Icon className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <DataTable
        title="Artefatos"
        empty="Nenhum artefato registrado."
        headers={["Arquivo", "Modulo", "Tipo", "Storage", "Data"]}
        rows={project.artifacts.map((artifact) => [
          artifact.fileName,
          artifact.module,
          artifact.kind,
          artifact.storageProvider,
          formatDate(artifact.createdAt),
        ])}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <DataTable
          title="Arquivos enviados"
          empty="Nenhum arquivo enviado ainda."
          headers={["Arquivo", "Modulo", "Origem", "Tamanho", "Data"]}
          rows={project.uploads.map((upload) => [
            upload.fileName,
            upload.module,
            upload.source,
            formatBytes(upload.sizeBytes),
            formatDate(upload.createdAt),
          ])}
        />
        <DataTable
          title="Documentos"
          empty="Nenhum documento registrado."
          headers={["Arquivo", "Modulo", "Tipo", "Status", "Data"]}
          rows={project.documents.map((document) => [
            document.fileName,
            document.module,
            document.documentType,
            document.status,
            formatDate(document.createdAt),
          ])}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex items-center gap-2">
            <FileArchive className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Eventos recentes</h2>
          </div>
          <div className="divide-y divide-border">
            {project.events.length === 0 ? (
              <EmptyState description="Nenhum evento registrado." className="py-8" />
            ) : (
              project.events.map((event) => (
                <div key={event.id} className="grid gap-1 py-3 md:grid-cols-[180px_1fr_auto] md:items-center">
                  <Badge variant="outline">{event.type}</Badge>
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.summary || "Sem resumo"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="font-mono text-[11px] uppercase text-muted-foreground">{label}</p>
        <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function DataTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string;
  empty: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <h2 className="text-base font-semibold">{title}</h2>
        {rows.length === 0 ? (
          <EmptyState description={empty} className="py-8" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={`${title}-${rowIndex}-${cellIndex}`} className="max-w-[260px] truncate">
                      {cell || "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatBytes(value: number | null) {
  if (!value) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
