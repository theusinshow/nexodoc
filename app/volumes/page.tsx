import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FundoDoAmbiente } from "@/components/ambiente/fundo-do-ambiente";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectContextStrip } from "@/components/projects/project-context-strip";
import { getUserAccess } from "@/lib/access-control";
import { buildCallbackPath, redirectToLogin } from "@/lib/auth-redirect";
import { getProjectContextForUser } from "@/lib/project-context";
import { VolumeBuilderPage } from "@/modules/volume-builder/components/volume-builder-page";

export default async function VolumesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirectToLogin(buildCallbackPath("/volumes", params));
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/sem-acesso");
  }

  const { project } = params;
  const projectContext = await getProjectContextForUser(project, session.user);

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-clip px-4 py-4 sm:px-6 lg:px-8">
      {/* Atmosfera: sem orbe vivo nesta tela. Ver `campo-neural.tsx`. */}
      <FundoDoAmbiente />
      <PageHeader
        backHref="/"
        title="Organização de Volumes"
        description="Monte volumes tecnicos a partir de PDFs, selecione paginas, gere separatrizes, valide a montagem e exporte PDF ou ZIP."
      />

      <ProjectContextStrip project={projectContext} moduleName="Volumes" />

      <VolumeBuilderPage projectId={project} projectContext={projectContext} />
    </div>
  );
}
