import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminTrilho } from "@/components/admin/admin-trilho";
import { AdminTokenProvider } from "@/components/admin/admin-token";
import { PortaoDeTelaLarga } from "@/components/ui/portao-de-tela-larga";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/admin");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !access.isAdmin) {
    redirect("/");
  }

  /*
   * O TRILHO FICA FORA DO PORTAO, de proposito: ele é o caminho de volta.
   * Recusar a tela e ao mesmo tempo tirar o "Voltar" seria prender a pessoa
   * num aviso.
   *
   * O PROVEDOR DO TOKEN embrulha os dois. O token é do painel e não da tela
   * (ver [[components/admin/admin-token.tsx]]): o trilho o pede uma vez, e as
   * cinco telas o consomem. Antes, cada uma das sete tinha o seu campo de
   * senha, e era a primeira coisa que se via em todas elas.
   */
  return (
    <AdminTokenProvider>
      <div className="flex min-h-dvh bg-background text-foreground">
        <AdminTrilho />
        <div className="min-w-0 flex-1">
          <PortaoDeTelaLarga titulo="O painel administrativo lê tabelas densas — pessoas, auditorias, custo por obra — e uma coluna estreita esconderia as colunas que decidem.">
            {children}
          </PortaoDeTelaLarga>
        </div>
      </div>
    </AdminTokenProvider>
  );
}
