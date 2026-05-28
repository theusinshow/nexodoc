import { CoverGeneratorFlow } from "@/modules/cover-generator/components/CoverGeneratorFlow";
import { PageHeader } from "@/components/layout/page-header";
import { decodeLdData } from "@/modules/ld-interop";
import type { InitialData } from "@/modules/cover-generator/hooks/useCoverGenerator";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { Button } from "@/components/ui/button";

interface CapasPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CapasPage({ searchParams }: CapasPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  const params = await searchParams;
  const ldData = decodeLdData(params);

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

      <CoverGeneratorFlow initialData={initialData} />
    </div>
  );
}
