import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";
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
   * A BARRA FICA FORA DO PORTAO, de proposito: ela é o caminho de volta.
   * Recusar a tela e ao mesmo tempo tirar o "Voltar" seria prender a pessoa
   * num aviso.
   */
  return (
    <>
      <AdminNav />
      <PortaoDeTelaLarga titulo="O painel administrativo lê tabelas densas — pessoas, auditorias, custo por obra — e uma coluna estreita esconderia as colunas que decidem.">
        {children}
      </PortaoDeTelaLarga>
    </>
  );
}
