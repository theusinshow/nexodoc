import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getAdminEmails, getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

import { AvisoSemAcesso } from "./aviso-sem-acesso";

export const metadata = {
  title: "Sem acesso - Nexo",
};

/**
 * SEM PERMISSÃO — informação, não falha.
 *
 * Antes, conta sem acesso era devolvida para `/login`, que é o pior lugar: a
 * pessoa acabou de entrar, a credencial dela é VÁLIDA, e a tela de login diz
 * exatamente o contrário disso. Ela tenta de novo, funciona de novo, e volta
 * para o login — um laço que faz parecer defeito.
 *
 * Aqui fica só o guarda: quem pode ver esta tela. A vista mora em
 * `AvisoSemAcesso` — e por isso pode ser conferida sem inventar uma sessão
 * válida-porém-bloqueada, que é uma combinação que não se produz no navegador
 * sem mexer no banco.
 */
export default async function SemAcessoPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/sem-acesso");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  // Já liberado? Então esta tela não é para ele — volta ao trabalho.
  if (access.isActive) {
    redirect("/nexo");
  }

  return (
    <AvisoSemAcesso
      email={session.user.email ?? ""}
      admins={[...getAdminEmails()]}
    />
  );
}
