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
    <main className="login-split-shell bg-background text-foreground">
      <section className="login-auth-panel" aria-labelledby="login-title">
        <div className="nexodoc-enter login-auth-content">
          <div className="login-brand-lockup">
            <span aria-hidden="true">
              <LogoNexo size={48} interativa={false} />
            </span>
            <h1 id="login-title" className="login-title">
              Entre no Nexo
            </h1>
            <p className="login-lead">
              Documentação de projetos de engenharia, do carimbo ao volume.
            </p>
          </div>

          <div className="login-auth-block">
            <h2 className="login-kicker">Entrar</h2>
            <p className="login-copy">
              Use a conta Google do escritório. Depois da autenticação, o Nexo
              confere se essa conta está liberada para acessar o ambiente.
            </p>

            {error ? (
              <p role="alert" className="login-error">
                Não foi possível autenticar com o Google. Tente novamente.
              </p>
            ) : null}

            <form
              className="login-form"
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <Button
                type="submit"
                variant="google"
                size="lg"
                className="w-full"
                aria-describedby="login-access-note"
              >
                <MarcaDoGoogle />
                Entrar com Google
              </Button>
            </form>

            <p id="login-access-note" className="login-access-note">
              Se a conta ainda não estiver liberada, a próxima tela informa quem
              pode autorizar o acesso.
            </p>

            {canUseDevAuth ? (
              <div className="login-dev-auth">
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
                <p className="login-dev-email">{devUser?.email}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="login-media-panel" aria-label="Prévia do Nexo">
        <div className="login-media-poster" aria-hidden="true">
          <div className="login-media-chrome">
            <span />
            <span />
            <span />
          </div>
          <div className="login-media-workspace">
            <div className="login-media-sidebar">
              <span className="is-active" />
              <span />
              <span />
              <span />
            </div>
            <div className="login-media-canvas">
              <div className="login-media-node login-media-node--source" />
              <div className="login-media-node login-media-node--review" />
              <div className="login-media-node login-media-node--volume" />
              <div className="login-media-thread" />
            </div>
            <div className="login-media-report">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </aside>

      <section className="login-narrow-notice" aria-labelledby="login-narrow-title">
        <span aria-hidden="true">
          <LogoNexo size={48} interativa={false} />
        </span>
        <h1 id="login-narrow-title" className="login-narrow-title">
          Use o Nexo no desktop
        </h1>
        <p className="login-narrow-copy">
          A análise técnica de PDFs, o mapa do volume e a revisão lado a lado
          exigem uma tela maior.
        </p>
      </section>
    </main>
  );
}
