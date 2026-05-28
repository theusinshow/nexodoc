import { ShieldCheck } from "lucide-react";

export default function AdminLoading() {
  return (
    <main className="min-h-dvh bg-background px-5 py-5 text-foreground">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4">
        <header className="flex flex-col gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-primary">
              <ShieldCheck className="size-4" />
              Admin
            </div>
            <div className="mt-2 h-7 w-48 animate-pulse bg-muted" />
            <div className="mt-2 h-4 w-96 animate-pulse bg-muted" />
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-border bg-card p-4">
              <div className="h-3 w-20 animate-pulse bg-muted" />
              <div className="mt-4 h-8 w-12 animate-pulse bg-muted" />
              <div className="mt-2 h-3 w-28 animate-pulse bg-muted" />
            </div>
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-border bg-card p-4">
              <div className="size-5 animate-pulse bg-muted" />
              <div className="mt-4 h-5 w-24 animate-pulse bg-muted" />
              <div className="mt-2 h-4 w-full animate-pulse bg-muted" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
