import { ArrowLeft, ArrowRight, BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";
import { legacyModules } from "@/lib/modules";

export const metadata = {
  title: "Ferramentas antigas - Nexo",
};

/**
 * As telas de módulo único, fora do caminho principal.
 *
 * Elas saíram da entrada porque duas maneiras de fazer a mesma coisa é como o
 * produto ganha a fama de confuso — mas continuam AQUI, e de propósito: o Nexo
 * ainda não corrige tudo (o nº da prancha lido errado, por exemplo), e uma
 * saída de emergência que ninguém encontra não é saída. Esconder atrás de uma
 * URL decorada seria fingir que o problema não existe.
 *
 * Nada aqui é para evoluir. O que faltar ao Nexo vira trabalho no Nexo, não
 * conserto nestas telas. Ver docs/nexo-paridade-telas.md.
 */
export default async function FerramentasAntigasPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/ferramentas");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:px-7">
        <div>
          <Link
            href="/nexo"
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Voltar ao Nexo
          </Link>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.03em]">
            Ferramentas antigas
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            As telas de antes do Nexo, uma por documento. Continuam funcionando e
            gerando os mesmos arquivos — use quando precisar de um ajuste que o
            assistente ainda não faz, como corrigir à mão o número de uma prancha
            que o carimbo entregou errado.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            No dia a dia, o caminho é o Nexo: é lá que o trabalho fica registrado
            e conferido.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {legacyModules.map((module) => {
            const Icon = module.icon;

            return (
              <Card key={module.href} className="flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--nexodoc-recessed)] text-muted-foreground">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold tracking-[-0.01em]">
                      {module.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <Button asChild variant="outline" size="sm" className="w-fit">
                    <Link href={module.href}>
                      {module.label}
                      <ArrowRight />
                    </Link>
                  </Button>
                  {module.href === "/ld" ? (
                    <Link
                      href="/ld/historico"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      <BookOpenCheck className="size-3.5" />
                      Histórico
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </main>
  );
}
