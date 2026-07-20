import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectConsole, type ProjectConsoleItem } from "@/components/projects/project-console";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { getUserActor, normalizeEmail } from "@/lib/project-store";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/projetos");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  if (!isDatabaseConfigured()) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 sm:px-7">
        <PageHeader
          backHref="/"
          title="Projetos"
          description="DATABASE_URL nao esta configurada. Configure o banco para consultar projetos."
        />
      </main>
    );
  }

  const actor = await getUserActor(normalizeEmail(session.user.email ?? ""), session.user.name);
  const projects = await getPrisma().project.findMany({
    where: {
      deletedAt: null,
      OR: [
        { ownerEmail: actor.email },
        {
          organization: {
            members: {
              some: {
                email: actor.email,
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    },
    include: {
      _count: {
        select: {
          documents: true,
          uploads: true,
          artifacts: true,
          events: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 sm:px-7">
      <PageHeader
        backHref="/"
        title="Projetos"
        description="Base consolidada de projetos, documentos, uploads, artefatos e eventos gerados pelos modulos."
      />

      <ProjectConsole initialProjects={projects.map(serializeProject)} />
    </main>
  );
}

function serializeProject(project: {
  id: string;
  code: string;
  name: string;
  client: string;
  description: string;
  status: string;
  updatedAt: Date;
  _count: {
    documents: number;
    uploads: number;
    artifacts: number;
    events: number;
  };
}): ProjectConsoleItem {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    client: project.client,
    description: project.description,
    status: project.status,
    updatedAt: project.updatedAt.toISOString(),
    counts: {
      documents: project._count.documents,
      uploads: project._count.uploads,
      artifacts: project._count.artifacts,
      events: project._count.events,
    },
  };
}
