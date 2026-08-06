import { Terminal } from "lucide-react";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { LogoNexo } from "@/components/brand/logo-nexo";
import { Button } from "@/components/ui/button";
import { normalizeAuthCallbackPath } from "@/lib/auth-redirect";
import {
  DEV_AUTH_PROVIDER_ID,
  getDevAuthUser,
  isDevAuthEnabled,
} from "@/lib/dev-auth";

export const metadata = {
  title: "Entrar - Nexo",
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

/**
 * O "G" do Google fica COLORIDO, e é a única cor fora do sistema em toda a tela.
 *
 * A §2 proíbe azul, e esta é a exceção que se assume: a marca é de terceiro e
 * serve de sinal de confiança — repintá-la na rampa teal a transformaria num
 * botão qualquer com um símbolo estranho, além de contrariar a diretriz de uso
 * do próprio Google. Ela vive em 16px dentro do botão; o orçamento de cor da
 * §2 governa a paleta do sistema, não o logotipo de quem autentica.
 */
function MarcaDoGoogle() {
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

/**
 * A PORTA — primeira tela do software e a única antes da credencial.
 *
 * O momento desta tela é a MARCA, não um cartão de venda: o degrau Display
 * (40px) da §3 existe só aqui, e a §6 define o logotipo como o orbe achatado
 * mais a palavra. Abaixo dele, um cartão com UMA ação.
 *
 * Saíram daqui a lista de vantagens ("sessão protegida", "PDFs processados") e
 * o cadeado num quadrado teal. As duas frases eram tom de landing page, que a
 * PRODUCT.md rejeita, e o cadeado gastava o acento interativo num enfeite
 * parado — a §2 reserva o teal para o que se clica, e nesta tela o que se
 * clica é o botão. O texto que sobrou é o que evita a surpresa seguinte: a
 * conta precisa estar liberada, e há uma tela dizendo quem libera.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;
  const redirectTo = normalizeAuthCallbackPath(callbackUrl);
  const devUser = getDevAuthUser();
  const canUseDevAuth = isDevAuthEnabled() && Boolean(devUser);

  if (session?.user) {
    redirect(redirectTo);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-foreground">
      {/* Um reveal só, no bloco inteiro. A §5 não coreografa entrada por
          elemento: isto é uma porta, não uma página que se assiste carregar. */}
      <div className="nexodoc-enter w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          {/* O símbolo é decorativo AO LADO da palavra: sem o aria-hidden o
              leitor de tela anuncia "Nexo" duas vezes seguidas. */}
          <span aria-hidden="true">
            <LogoNexo size={48} interativa={false} />
          </span>
          <h1 className="mt-5 text-[40px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Nexo
          </h1>
          <p className="mt-3 text-sm leading-6 text-balance text-muted-foreground">
            Documentação de projetos de engenharia — do carimbo ao volume.
          </p>
        </div>

        <div className="mt-8 rounded-md border bg-card p-6">
          <h2 className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-foreground">
            Entrar
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Use a conta Google do escritório. Se ela ainda não estiver liberada,
            a tela seguinte diz quem libera.
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-md border border-[var(--status-critical)]/30 bg-[var(--status-critical-bg)] px-3 py-2.5 text-sm leading-6 text-[var(--status-critical)]"
            >
              Não foi possível autenticar com o Google. Tente novamente.
            </p>
          ) : null}

          <form
            className="mt-5"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <Button type="submit" className="w-full">
              <MarcaDoGoogle />
              Continuar com Google
            </Button>
          </form>

          {canUseDevAuth ? (
            /* Atalho de desenvolvimento, separado por régua de 1px em largura
               inteira (§11) — não por faixa lateral nem por cor. O e-mail fica
               FORA do botão: espremido lá dentro ele era truncado, e um dado
               que não se lê inteiro não é dado. */
            <div className="mt-5 border-t pt-5">
              <form
                action={async () => {
                  "use server";
                  await signIn(DEV_AUTH_PROVIDER_ID, { redirectTo });
                }}
              >
                <Button type="submit" variant="outline" className="w-full">
                  <Terminal strokeWidth={1.5} />
                  Entrar como dev
                </Button>
              </form>
              <p className="mt-2 truncate text-center font-mono text-[13px] text-muted-foreground">
                {devUser?.email}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
