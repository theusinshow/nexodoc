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
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-15 [background-image:linear-gradient(var(--nexodoc-grid)_1px,transparent_1px),linear-gradient(90deg,var(--nexodoc-grid)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_65%)]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-10 flex flex-col items-center text-center nexodoc-enter">
          <Image
            src="/assets/logo.svg"
            alt="NexoDoc"
            width={48}
            height={48}
            priority
            className="size-12 rounded-sm object-cover"
          />
          <h1 className="mt-4 font-mono text-xl font-semibold">NexoDoc</h1>
          <p className="mt-1 font-mono text-xs tracking-[0.15em] text-muted-foreground">
            AUDITORIA DOCUMENTAL
          </p>
        </div>

        <div className="nexodoc-enter rounded-sm border bg-card p-6 sm:p-8">
          <div className="flex size-10 items-center justify-center rounded-sm border border-primary/20 bg-primary/5 text-primary">
            <LockKeyhole className="size-5" />
          </div>

          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
            Acessar workspace
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
            Entre com sua conta Google autorizada para iniciar auditorias documentais.
          </p>

          {error ? (
            <div className="mt-5 rounded-sm border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
              Não foi possível autenticar com o Google. Tente novamente.
            </div>
          ) : null}

          <form
            className="mt-6"
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
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-6 space-y-2 border-t pt-5 text-sm text-muted-foreground">
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

        <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
          ACESSO RESTRITO / NEXODOC
        </p>
      </div>
    </main>
  );
}
