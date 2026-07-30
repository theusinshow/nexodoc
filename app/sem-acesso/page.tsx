import { ArrowLeft, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { getAdminEmails, getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

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
 * Nada quebrou aqui: a conta é boa, a porta é que é outra. Por isso o
 * vocabulário é `--signal-info`, e por isso a tela diz QUEM pode liberar — sem
 * isso o engenheiro não tem o próximo passo, só a negativa.
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

  const admins = [...getAdminEmails()];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-[560px]">
        <div
          className="rounded-md border p-6 sm:p-8"
          style={{
            background: "var(--signal-info-bg)",
            borderColor: "var(--signal-info-border)",
          }}
        >
          <div className="flex items-start gap-3">
            <ShieldQuestion
              className="mt-0.5 h-5 w-5 shrink-0"
              style={{ color: "var(--signal-info)" }}
              aria-hidden
            />
            <div className="min-w-0">
              <p
                className="font-mono text-[11px] uppercase tracking-[0.07em]"
                style={{ color: "var(--signal-info)" }}
              >
                Acesso ainda não liberado
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-[-0.01em]">
                Sua conta está certa — falta a liberação
              </h1>
              <p className="mt-3 text-sm leading-6 text-foreground">
                Você entrou como{" "}
                <span className="font-mono">{session.user.email}</span>. A conta é
                válida; ela só ainda não foi habilitada para este software.
              </p>
              {admins.length > 0 ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Quem libera no escritório:{" "}
                  {admins.map((e, i) => (
                    <span key={e} className="font-mono text-foreground">
                      {e}
                      {i < admins.length - 1 ? ", " : ""}
                    </span>
                  ))}
                  .
                </p>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Peça a liberação a quem administra o Nexo no escritório.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/login">
              <ArrowLeft />
              Entrar com outra conta
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
