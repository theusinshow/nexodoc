import {
  ArrowRight,
  BookOpenCheck,
  Files,
  FolderCog,
  Gauge,
  LayoutGrid,
  Layers3,
  TableProperties,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DashboardShortcuts } from "@/components/dashboard-shortcuts";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { getUserAccess } from "@/lib/access-control";

const availableModules = [
  {
    title: "Conferência documental",
    description:
      "Analise memoriais, pranchas e volumes; compare evidências e identifique inconsistências.",
    href: "/audit",
    label: "Abrir conferência",
    icon: BookOpenCheck,
    emphasis: true,
  },
  {
    title: "Montagem de LDs",
    description:
      "Leia selos de pranchas, revise dados e gere Listas de Documentos organizadas por tomo.",
    href: "/ld",
    label: "Abrir montagem",
    icon: TableProperties,
    emphasis: false,
  },
  {
    title: "Montagem de capas",
    description:
      "Gere capas padronizadas em ODT, PDF ou ZIP a partir de templates por prefeitura.",
    href: "/capas",
    label: "Abrir capas",
    icon: FolderCog,
    emphasis: false,
  },
] as const;

const futureModules = [
  {
    title: "Organização de volumes",
    description: "Junção, ordenação e conferência final dos volumes de projeto.",
    icon: Layers3,
  },
] as const;

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  const isAdmin = access.isAdmin;

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
              alt="NexoDoc"
              width={40}
              height={40}
              priority
              className="size-10 rounded-sm object-cover"
            />
            <div>
              <p className="font-mono text-sm font-semibold">NexoDoc</p>
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
        <section className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div className="max-w-3xl nexodoc-enter">
            <div className="inline-flex items-center gap-2 border border-primary/30 bg-primary/8 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--nexodoc-accent)]">
              <LayoutGrid className="size-3.5" />
              Painel de módulos
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
              Produção documental em um só ambiente.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Escolha a operação para iniciar. A conferência documental segue como fluxo
              principal; LDs e capas já estão disponíveis no mesmo workspace autenticado.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border lg:w-[290px]">
            <div className="bg-card p-4">
              <p className="font-mono text-[11px] uppercase text-muted-foreground">Disponíveis</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-[var(--status-ok)]">03</p>
            </div>
            <div className="bg-card p-4">
              <p className="font-mono text-[11px] uppercase text-muted-foreground">Planejados</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-muted-foreground">01</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="available-title">
          <div className="mb-4 flex items-center gap-3">
            <Files className="size-4 text-primary" />
            <h2 id="available-title" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Operações disponíveis
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {availableModules.map((module) => {
              const Icon = module.icon;

              return (
                <article
                  key={module.title}
                  className={`group flex min-h-[250px] flex-col border bg-card p-5 transition-colors duration-200 hover:border-ring sm:p-6 ${
                    module.emphasis ? "border-primary/45" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className={`flex size-12 items-center justify-center border ${
                        module.emphasis
                          ? "border-primary/30 bg-primary/10 text-[var(--nexodoc-accent)]"
                          : "border-border bg-[var(--nexodoc-recessed)] text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-6" />
                    </div>
                    <span className="border border-[var(--status-ok)]/25 bg-[var(--status-ok-bg)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--status-ok)]">
                      Ativo
                    </span>
                  </div>
                  <h3 className="mt-7 text-2xl font-semibold tracking-[-0.03em]">{module.title}</h3>
                  <p className="mt-3 max-w-lg flex-1 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                  <Button asChild variant={module.emphasis ? "default" : "outline"} className="mt-6 w-fit">
                    <Link href={module.href}>
                      {module.label}
                      <ArrowRight />
                    </Link>
                  </Button>
                  {module.href === "/ld" ? (
                    <Link
                      href="/ld/historico"
                      className="mt-3 inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                    >
                      <BookOpenCheck className="size-4" />
                      Consultar histórico de LDs
                    </Link>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="roadmap-title">
          <div className="mb-4 flex items-center gap-3">
            <Layers3 className="size-4 text-muted-foreground" />
            <h2 id="roadmap-title" className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Próximos módulos
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {futureModules.map((module) => {
              const Icon = module.icon;

              return (
                <article key={module.title} className="flex gap-4 border border-dashed bg-card/55 p-5 text-muted-foreground">
                  <div className="flex size-11 shrink-0 items-center justify-center border border-border bg-[var(--nexodoc-recessed)]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium text-foreground/75">{module.title}</h3>
                      <span className="border border-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
                        Futuro
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6">{module.description}</p>
                  </div>
                </article>
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
