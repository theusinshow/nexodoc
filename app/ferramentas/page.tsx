import { ArrowLeft, ArrowRight, BookOpenCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
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
    redirect("/sem-acesso");
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
              /* A cor de LEGADO vive só na casca — moldura, selo e rótulo.
                 Nunca no miolo: a tela lá dentro funciona, e tingir o conteúdo
                 a faria parecer quebrada. */
              <Card
                key={module.href}
                className="flex flex-col gap-4 border-[var(--legacy-border)] p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-[var(--legacy-border)] bg-[var(--legacy-bg)] text-[var(--legacy)]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="mb-1.5">
                      <Badge variant="legacy">Ferramenta antiga</Badge>
                    </div>
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
                  {/* Idem: o histórico das LDs é do servidor, e quem o lê é o
                      painel admin. */}
                  {module.href === "/capas" ? (
                    <Link
                      href="/admin/lds"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      <BookOpenCheck className="size-3.5" />
                      Histórico de LDs
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
