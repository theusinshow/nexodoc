import { Terminal } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { SeloDoProduto } from "@/components/brand/selo-do-produto";
import { VERSAO_DO_BUILD } from "@/lib/versao-do-build";
import { MalhaDeSondagem } from "@/components/ambiente/malha-de-sondagem";
import { MarcaViva } from "@/components/brand/marca-viva";
import { BoasVindas } from "@/components/login/boas-vindas";
import {
  ContatoDoResponsavel,
  type RespostaDoContato,
} from "@/components/login/contato-do-responsavel";
import { Button } from "@/components/ui/button";
import { falarComOResponsavel } from "@/lib/contato-do-responsavel";
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
 * O RECADO DE QUEM NÃO CONSEGUIU ENTRAR.
 *
 * É uma server action e NÃO uma rota em `app/api`, por duas razões que puxam
 * para o mesmo lado. A primeira é de vizinhança: ela existe só para esta tela e
 * morre com ela. A segunda é a `prova:rotas`, que varre `app/api` exigindo um
 * portão em cada handler — este é deliberadamente sem sessão (quem o usa é
 * justamente quem não tem uma), e entrar na lista de exceções da prova daria a
 * uma decisão pequena o mesmo peso do `/api/auth`.
 *
 * O que faz dela segura não é o lugar, é a guarda: destino fixo, teto por
 * origem, tamanho limitado e escape de HTML, tudo em
 * [[lib/contato-do-responsavel]].
 */
async function enviarRecado(dados: FormData): Promise<RespostaDoContato> {
  "use server";

  /* O IP vem do cabeçalho que o proxy escreve. Ele é falsificável por quem
     fala direto com o processo, e o teto sabe disso — ele existe contra o
     formulário apertado em laço, não contra um adversário determinado. */
  const cabecalhos = await headers();
  const origem =
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabecalhos.get("x-real-ip")?.trim() ||
    "desconhecida";

  const resultado = await falarComOResponsavel({
    email: String(dados.get("email") ?? ""),
    mensagem: String(dados.get("mensagem") ?? ""),
    origem,
    contexto: "falha de autenticação na tela de login",
  });

  return resultado.ok
    ? { ok: true, estado: resultado.estado as "enviado" | "gravado" | "nao-configurado" }
    : { ok: false, motivo: resultado.motivo, erro: resultado.erro };
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
              <MarcaViva size={48} />
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
                Não foi possível autenticar com o Google. Tente novamente ou use
                o contato no fim desta coluna.
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
              /*
                DOIS ATORES, e é por isso que há um campo aqui.

                O acesso dev entrava sempre como o e-mail do ambiente, um só.
                Testar trabalho em conjunto — alguém atribui, outro alguém
                resolve — exige duas pessoas ao mesmo tempo, e reiniciar o
                servidor no meio do teste para trocar de identidade não é
                testar: é encenar duas sessões que nunca coexistiram.

                Em branco, continua valendo o e-mail do ambiente. Só aparece
                quando `isDevAuthEnabled()`, que é falso em produção.
              */
              <div className="login-dev-auth">
                <form
                  action={async (formData: FormData) => {
                    "use server";
                    const email = String(formData.get("email") ?? "").trim();
                    await signIn(DEV_AUTH_PROVIDER_ID, {
                      redirectTo,
                      ...(email ? { email } : {}),
                    });
                  }}
                >
                  <label className="sr-only" htmlFor="login-dev-email-input">
                    E-mail
                  </label>
                  <input
                    id="login-dev-email-input"
                    name="email"
                    type="email"
                    autoComplete="off"
                    placeholder="entrar como outra pessoa"
                    className="login-dev-email-input"
                  />
                  <Button type="submit" variant="outline" className="w-full">
                    <Terminal strokeWidth={1.5} />
                    Entrar como dev
                  </Button>
                </form>
              </div>
            ) : null}

            {/*
              O CANAL FICA SEMPRE, e isto reverte a versão anterior desta tela.

              Ele nascia do erro, com o argumento de que suporte permanente numa
              tela de login é ruído. O argumento estava incompleto: quem precisa
              falar com o responsável nem sempre chega aqui por um erro do
              Google — chega por conta que o escritório ainda não liberou, que
              é o caso comum deste produto e que NÃO produz `?error=`. Fazer o
              canal depender do erro era escondê-lo justamente de quem mais
              precisa dele.

              Fica no rodapé, atrás de um clique e em variante fantasma: presente
              para quem procura, sem disputar com o botão de entrar.
            */}
            <div className="login-rodape">
              <ContatoDoResponsavel enviarRecado={enviarRecado} />
            </div>
          </div>
        </div>
      </section>

      <aside className="login-media-panel" aria-label="Prévia do Nexo">
        {/*
          O CAMPO ATRÁS DO ORBE.

          Aqui havia uma grade de 56px desenhada em `::before` — imóvel, e nada
          além de textura. A malha põe a mesma grade de pé: os pontos acendem e
          cedem sob o ponteiro, e ficam absolutamente parados enquanto ninguém
          mexe o mouse.

          É essa parada que a autoriza ao lado do orbe vivo, onde o
          `CampoNeural` é proibido: a regra do §6 veta movimento AUTÔNOMO, e
          esta malha não tem nenhum — o laço de animação nem existe em repouso.
          Reação ao ponteiro é a pessoa mexendo a própria mão.

          Não precisa de `next/dynamic`: ela só toca `window` dentro do efeito,
          então atravessa o SSR desta página de servidor sem o invólucro que o
          `ogl` do campo exige.
        */}
        <MalhaDeSondagem className="login-malha" />

        {/*
          A ALMA ACESA NA PORTA DE ENTRADA.

          O §6 já previa o orbe 3D em "Palco / entrada", e o login É a entrada.
          `size="hero"`, e não `compact`: sem o poster do workspace ao lado, o
          orbe é o painel inteiro — o maior degrau que já existe na escada em
          vez de um número inventado à parte.

          `interactive={false}` porque não há o que ativar: sem `onActivate` o
          componente já vira `role="img"`, e um hover aceso prometeria um clique
          que não existe. Sem WebGL, o próprio `AgentOrb` cai no `OrbGlow`.

          Um orbe vivo por tela: esta é a única instância do login (o lockup e o
          aviso de tela estreita usam o SVG estático).

          O orbe e a saudação saem juntos de `BoasVindas`, e não daqui: enquanto
          a frase se decifra o orbe está em `responding` acompanhando o
          progresso dela. Montá-los como irmãos nesta página deixaria os dois
          sem como conversar.
        */}
        <div className="login-media-stack">
          <BoasVindas />
        </div>

        {/*
          O CARIMBO DO PRÓPRIO PRODUTO, no canto.

          Um software sobre carimbo de prancha que não carimba a própria porta
          de entrada deixa a primeira impressão para a ilustração. Fica no
          CANTO, e não ao lado do orbe: o painel é do orbe vivo (um por tela,
          §6), e dois objetos disputando o centro quebrariam a escada de
          reduções.
        */}
        <div className="pointer-events-none absolute bottom-6 right-6 z-10">
          <SeloDoProduto versao={VERSAO_DO_BUILD} />
        </div>
      </aside>

      <section className="login-narrow-notice" aria-labelledby="login-narrow-title">
        <span aria-hidden="true">
          <MarcaViva size={48} />
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
