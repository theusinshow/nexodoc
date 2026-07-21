import { SeparatorGeneratorFlow } from "@/modules/separator-generator/components/SeparatorGeneratorFlow";
import { PageHeader } from "@/components/layout/page-header";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { buildCallbackPath, redirectToLogin } from "@/lib/auth-redirect";

interface SeparatrizesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function SeparatrizesPage({ searchParams }: SeparatrizesPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirectToLogin(buildCallbackPath("/separatrizes", params));
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  // Disciplinas pre-preenchidas (separadas por "|"), vindas do gerador de capas.
  const rawTitles = firstString(params.d);
  const initialTitles = rawTitles
    ? rawTitles
        .split("|")
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;
  const initialCodigo = firstString(params.codigo);
  const initialRevisao = firstString(params.rev);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        backHref="/"
        title="Folhas Separatrizes"
        description="Gere folhas de separacao de disciplinas para inserir dentro do volume. Uma folha limpa por disciplina, com o nome em destaque."
      />

      <SeparatorGeneratorFlow
        initialTitles={initialTitles}
        initialCodigo={initialCodigo}
        initialRevisao={initialRevisao}
      />
    </div>
  );
}
