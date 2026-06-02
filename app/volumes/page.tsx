import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { getUserAccess } from "@/lib/access-control";
import { VolumeBuilderPage } from "@/modules/volume-builder/components/volume-builder-page";

export default async function VolumesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-clip px-4 py-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Organização de Volumes"
        description="Monte volumes tecnicos a partir de PDFs, selecione paginas, gere separatrizes, valide a montagem e exporte PDF ou ZIP."
      />

      <VolumeBuilderPage />
    </div>
  );
}
