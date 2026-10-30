import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getAdminEmails, requireActor } from "@/lib/access-control";
import { AccessDenied } from "@/lib/actor";
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

  /*
   * Já liberado? Então esta tela não é para ele — volta ao trabalho. A régua é
   * a MESMA do portão (`requireActor`), e não `access.isActive`: conta nova
   * nasce ativa mas pode não ter vínculo com escritório (cadastro automático
   * desligado). Com `isActive` aqui, /nexo mandava para cá, daqui para /nexo,
   * e o navegador parava em ERR_TOO_MANY_REDIRECTS (30/10/2026).
   */
  let liberado = false;
  try {
    await requireActor();
    liberado = true;
  } catch (err) {
    if (!(err instanceof AccessDenied)) throw err;
  }
  if (liberado) {
    redirect("/nexo");
  }

  return (
    <AvisoSemAcesso
      email={session.user.email ?? ""}
      admins={[...getAdminEmails()]}
    />
  );
}
