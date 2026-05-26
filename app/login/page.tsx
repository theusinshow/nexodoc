import { ArrowRight, FileSearch, LockKeyhole, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 18 18">
      <path
        d="M17.64 9.2c0-.63-.06-1.23-.16-1.8H9v3.4h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.58Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.87-3.04.87-2.35 0-4.34-1.58-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.6.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.34L15.02 2.34A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { error } = await searchParams;

  if (session?.user) {
    redirect("/");
  }

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_17%_12%,rgba(0,166,147,0.14),transparent_32%),radial-gradient(circle_at_88%_78%,rgba(220,120,88,0.12),transparent_27%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(var(--nexodoc-grid)_1px,transparent_1px),linear-gradient(90deg,var(--nexodoc-grid)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_76%)]"
      />

      <section className="relative hidden w-[53%] flex-col justify-between border-r px-12 py-10 lg:flex xl:px-16">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/logo.svg"
            alt=""
            width={48}
            height={48}
            priority
            className="size-12 rounded-sm border border-[var(--nexodoc-tertiary-strong)]/35 object-cover"
          />
          <div>
            <p className="font-mono text-lg font-semibold">NexoDoc</p>
            <p className="font-mono text-xs text-muted-foreground">AUDIT WORKSPACE / v0.1</p>
          </div>
        </div>

        <div className="max-w-xl nexodoc-enter">
          <p className="mb-5 font-mono text-xs tracking-[0.22em] text-primary">
            AUDITORIA DOCUMENTAL
          </p>
          <h1 className="max-w-lg text-5xl font-semibold leading-[1.08] tracking-[-0.055em] text-foreground">
            Documentos técnicos sob revisão precisa.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">
            Analise memoriais, pranchas e listas de documentos em uma bancada segura,
            rastreável e orientada a evidências.
          </p>
        </div>

        <div className="grid max-w-xl grid-cols-3 gap-px border bg-border">
          {[
            ["01", "Anexe PDFs"],
            ["02", "Execute a auditoria"],
            ["03", "Revise achados"],
          ].map(([number, label]) => (
            <div key={number} className="bg-[var(--nexodoc-panel)] px-4 py-4">
              <p className="font-mono text-xs text-primary">{number}</p>
              <p className="mt-2 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-[420px] nexodoc-enter">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Image
              src="/assets/logo.svg"
              alt=""
              width={44}
              height={44}
              priority
              className="size-11 rounded-sm border border-[var(--nexodoc-tertiary-strong)]/35 object-cover"
            />
            <div>
              <p className="font-mono text-base font-semibold">NexoDoc</p>
              <p className="font-mono text-[11px] text-muted-foreground">AUDIT WORKSPACE</p>
            </div>
          </div>

          <div className="rounded-md border bg-card p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-8">
            <div className="flex size-11 items-center justify-center rounded-sm border border-primary/25 bg-[var(--status-ok-bg)] text-primary">
              <LockKeyhole className="size-5" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.045em]">Acessar workspace</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Entre com sua conta Google autorizada para iniciar auditorias documentais.
            </p>

            {error ? (
              <div className="mt-5 rounded-sm border border-destructive/35 bg-[var(--status-critical-bg)] px-3 py-2.5 text-sm text-destructive">
                Não foi possível autenticar com o Google. Tente novamente.
              </div>
            ) : null}

            <form
              className="mt-7"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <Button type="submit" size="lg" className="w-full justify-between px-5">
                <span className="flex items-center gap-3">
                  <GoogleMark />
                  Continuar com Google
                </span>
                <ArrowRight />
              </Button>
            </form>

            <div className="mt-7 space-y-3 border-t pt-6 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-primary" />
                Sessão protegida e acesso único por identidade Google.
              </p>
              <p className="flex items-center gap-2">
                <FileSearch className="size-4 shrink-0 text-primary" />
                PDFs processados para conferência documental técnica.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center font-mono text-[11px] text-muted-foreground">
            ACESSO RESTRITO / NEXODOC AUDITORIA DOCUMENTAL
          </p>
        </div>
      </section>
    </main>
  );
}
