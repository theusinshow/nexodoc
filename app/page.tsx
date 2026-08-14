import { ArrowRight, Files, Gauge, LayoutGrid } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardShortcuts } from "@/components/dashboard-shortcuts";
import { FilaDoUsuario } from "@/components/home/fila-do-usuario";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";
import { legacyModules, projetosModule, type ModuleDef } from "@/lib/modules";

/*
 * "Conferência documental" saiu da lista faz tempo: a auditoria mora no Nexo, e
 * o card dele já a anuncia. Com a `/audit` redirecionando, os dois levariam ao
 * mesmo lugar. O atalho Ctrl+A continua existindo e aponta para o Nexo.
 */
const availableModules: readonly ModuleDef[] = [...legacyModules, projetosModule];

function ShortcutHint({ keys }: { keys: string }) {
  return (
    <span className="hidden items-center gap-1 sm:inline-flex" aria-hidden="true">
      {keys.split(" ").map((key) => (
        <kbd
          key={key}
          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border bg-[var(--nexodoc-recessed)] px-1.5 font-mono text-[11px] text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

/*
 * A ENTRADA DEIXOU DE SER O NEXO — e o motivo antigo continua valendo.
 *
 * O que estava escrito aqui: "este painel listava seis módulos como se fossem
 * seis produtos... um menu com um item só é uma parada no caminho, então quem
 * entra já entra trabalhando". Continua verdade, e é POR ISSO que esta home não
 * é um menu: ela mostra o que está esperando por você, e some quando não há
 * nada — a `FilaDoUsuario` não renderiza seção vazia.
 *
 * O PREÇO, assumido: quem nunca recebe achado ganha um clique a mais até o
 * Nexo. A alternativa — redirecionar só quando não há pendência — faria a
 * entrada do produto mudar de lugar dependendo do dia, o que é pior do que um
 * clique.
 *
 * O painel de módulos abaixo da fila deixou de ser só o kill-switch da flag e
 * passou a ser visto todo dia — antes, com o redirect, ninguém o via com o Nexo
 * ligado. Ele continua servindo de saída de emergência quando a flag cai, e
 * agora também de caminho para quem chegou sem pendência nenhuma.
 */
export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/sem-acesso");
  }

  const isAdmin = access.isAdmin;

  const modules = availableModules;
  const primaryModule = modules.find((m) => m.emphasis) ?? modules[0];
  const secondaryModules = modules.filter((m) => m.title !== primaryModule.title);
  const PrimaryIcon = primaryModule.icon;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(var(--nexodoc-grid)_1px,transparent_1px),linear-gradient(90deg,var(--nexodoc-grid)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_42%_24%,black,transparent_68%)]"
      />

      <header className="relative border-b border-border bg-card/65 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/logo.svg"
              alt="Nexo"
              width={40}
              height={40}
              priority
              className="size-10 rounded-sm object-cover"
            />
            <div>
              <p className="font-mono text-sm font-semibold">Nexo</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Plataforma documental
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin ? (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href="/admin">
                  <Gauge />
                  Painel admin
                </Link>
              </Button>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{session.user.name ?? "Usuário"}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {session.user.email ?? "Sessão ativa"}
              </p>
            </div>
            <SignOutButton compact />
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-7xl flex-col gap-9 px-5 py-8 sm:px-7 lg:py-12">
        {/*
          O QUE EXIGE AÇÃO SUA vem primeiro, acima de qualquer coisa que o
          produto tenha a dizer sobre si mesmo. Quando não há pendência, este
          componente não renderiza nada e a tela é a de antes.
        */}
        <FilaDoUsuario />

        <section className="max-w-3xl nexodoc-enter">
          <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/8 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--nexodoc-accent)]">
            <LayoutGrid className="size-3.5" />
            Painel de módulos
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Produção documental em um só ambiente.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            Escolha a operação para iniciar. Todos os módulos estão disponíveis no
            mesmo workspace autenticado.
          </p>
        </section>

        <section aria-labelledby="available-title" className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Files className="size-4 text-primary" />
            <h2 id="available-title" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Operações disponíveis
            </h2>
          </div>

          <Card className="group relative overflow-hidden border-primary/45 p-6 transition-colors duration-200 hover:border-ring sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-[var(--nexodoc-accent)]">
                  <PrimaryIcon className="size-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {primaryModule.beta ? (
                      <Badge variant="warning">Beta</Badge>
                    ) : (
                      <Badge variant="ok">Ativo</Badge>
                    )}
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Fluxo principal
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                    {primaryModule.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                    {primaryModule.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-end">
                {primaryModule.shortcut ? <ShortcutHint keys={primaryModule.shortcut} /> : null}
                <Button asChild className="w-full sm:w-fit">
                  <Link href={primaryModule.href}>
                    {primaryModule.label}
                    <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {secondaryModules.map((module) => {
              const Icon = module.icon;

              return (
                <Card
                  key={module.title}
                  className="group flex min-h-[230px] flex-col border-border p-5 transition-colors duration-200 hover:border-ring"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex size-11 items-center justify-center rounded-md border border-border bg-[var(--nexodoc-recessed)] text-muted-foreground transition-colors group-hover:text-[var(--nexodoc-accent)]">
                      <Icon className="size-5" />
                    </div>
                    {module.beta ? (
                      <Badge variant="warning">Beta</Badge>
                    ) : module.shortcut ? (
                      <ShortcutHint keys={module.shortcut} />
                    ) : (
                      <Badge variant="ok">Ativo</Badge>
                    )}
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.02em]">{module.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <Button asChild variant="outline" className="w-fit">
                      <Link href={module.href}>
                        {module.label}
                        <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {isAdmin ? (
          <section className="flex flex-wrap items-center justify-between gap-4 border border-primary/35 bg-card p-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary">
                Administração
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe execução, qualidade, custos e configuração dos provedores.
              </p>
            </div>
            <Button asChild variant="default" size="sm">
              <Link href="/admin">
                <Gauge />
                Abrir painel admin
              </Link>
            </Button>
          </section>
        ) : null}
      </div>
      <DashboardShortcuts isAdmin={isAdmin} />
    </main>
  );
}
