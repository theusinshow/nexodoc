import { CoverGeneratorFlow } from "@/modules/cover-generator/components/CoverGeneratorFlow";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectContextStrip } from "@/components/projects/project-context-strip";
import { decodeLdData } from "@/modules/ld-interop";
import type { InitialData } from "@/modules/cover-generator/hooks/useCoverGenerator";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { buildCallbackPath, redirectToLogin } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";
import { getProjectContextForUser } from "@/lib/project-context";

interface CapasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CapasPage({ searchParams }: CapasPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirectToLogin(buildCallbackPath("/capas", params));
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  const ldData = decodeLdData(params);
  const projectId = typeof params.project === "string" ? params.project : undefined;
  const projectContext = await getProjectContextForUser(projectId, session.user);

  const initialData: InitialData | undefined = ldData
    ? {
        codigoInterno: ldData.codigoInterno,
        codigoExibido: ldData.codigoExibido,
        revisao: ldData.revisao,
        nomeObra: ldData.nomeObra,
        fase: ldData.fase,
        orgao: ldData.orgao,
        volume: ldData.volume,
        tomos: ldData.tomos,
      }
    : projectContext
      ? {
          codigoInterno: projectContext.code,
          codigoExibido: projectContext.code,
          nomeObra: projectContext.name,
          orgao: projectContext.client,
        }
      : undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Gerador de Capas"
        description="Gere capas tecnicas padronizadas a partir de templates ODT. Modulo independente, com integracao opcional ao Criador de LDs."
      >
        <Button asChild variant="outline" size="sm">
          <Link href="/ld">
            Testar integracao LD
          </Link>
        </Button>
      </PageHeader>

      <ProjectContextStrip project={projectContext} moduleName="Capas" />

      <CoverGeneratorFlow initialData={initialData} projectId={projectId} />
    </div>
  );
}
