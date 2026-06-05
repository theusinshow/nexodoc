import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, FileArchive, FileText, Layers3, TableProperties } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectDetailActions } from "@/components/projects/project-detail-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getUserAccess } from "@/lib/access-control";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { assertProjectAccess, getUserActor, normalizeEmail } from "@/lib/project-store";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !isDatabaseConfigured()) {
    redirect("/projetos");
  }

  const { id } = await params;
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

  const moduleLinks = [
    { label: "Auditoria", href: `/audit?project=${project.id}`, icon: BookOpenCheck },
    { label: "LD", href: `/ld?project=${project.id}`, icon: TableProperties },
    { label: "Capas", href: `/capas?project=${project.id}`, icon: FileText },
    { label: "Volumes", href: `/volumes?project=${project.id}`, icon: Layers3 },
  ] as const;

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
        <Metric label="Uploads" value={project._count.uploads} />
        <Metric label="Artefatos" value={project._count.artifacts} />
        <Metric label="Eventos" value={project._count.events} />
      </section>

      <section className="flex flex-wrap gap-2">
        {moduleLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Button key={item.href} asChild variant="outline" size="sm">
              <Link href={item.href}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            </Button>
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
          title="Uploads"
          empty="Nenhum upload registrado."
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
              <p className="py-4 text-sm text-muted-foreground">Nenhum evento registrado.</p>
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
          <p className="text-sm text-muted-foreground">{empty}</p>
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
