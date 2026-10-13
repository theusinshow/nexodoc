import { Terminal } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { Botao } from "@/components/ds/basicos";
import { Aviso } from "@/components/entrada/aviso";
import { BotaoDoGoogle } from "@/components/entrada/botao-do-google";
import { PortaDeEntrada } from "@/components/entrada/porta";
import { Recado, type RespostaDoContato } from "@/components/entrada/recado";
import { falarComOResponsavel } from "@/lib/contato-do-responsavel";
import { normalizeAuthCallbackPath } from "@/lib/auth-redirect";
import { DEV_AUTH_PROVIDER_ID, getDevAuthUser, isDevAuthEnabled } from "@/lib/dev-auth";

export const metadata = {
  title: "Entrar - Nexo",
};

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

async function enviarRecado(dados: FormData): Promise<RespostaDoContato> {
  "use server";

  /* A origem é o teto de recados por pessoa: o cabeçalho do proxy primeiro,
     e "desconhecida" quando nem ele existe (ambiente local). O teto existe
     contra o formulário apertado em laço, não contra um adversário. */
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

/*
 * A ENTRADA, no sistema novo (aprovada em /lab/telas/entrada): à esquerda a
 * porta, à direita o filme do Nexo. O que a porta faz não mudou: Google, o
 * acesso de desenvolvimento (só quando `isDevAuthEnabled()`, falso em
 * produção) e o recado ao responsável, que fica sempre e não só no erro.
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
    <PortaDeEntrada>
      {/* NOTA, NÃO PORTÃO (G06): no celular o filme sai e esta nota entra.
          Quem recebe o link de um achado no telefone continua entrando. */}
      <div className="en-celular" role="note">
        <p>No celular, dá para ler e tratar achados.</p>
        <p>Para montar volumes e ver o documento lado a lado, use o computador.</p>
      </div>

      <h1 className="en-titulo">Entre no Nexo</h1>
      <p className="en-lede">Lê o carimbo das pranchas, monta o volume e audita o memorial.</p>

      {error ? (
        <Aviso tom="erro">O Google não confirmou a sua entrada. Tente de novo; se repetir, fale com o responsável logo abaixo.</Aviso>
      ) : null}

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
        }}
      >
        <BotaoDoGoogle descritoPor="en-nota" />
      </form>
      <p id="en-nota" className="en-nota">
        Use a conta Google do escritório. Se ela ainda não tiver acesso, o Nexo mostra a quem pedir.
      </p>

      {canUseDevAuth ? (
        /* DOIS ATORES: em branco entra como o e-mail do ambiente; com um
           e-mail, entra como outra pessoa, para testar trabalho em conjunto
           sem reiniciar o servidor no meio do teste. */
        <form
          className="en-dev"
          action={async (formData: FormData) => {
            "use server";
            const email = String(formData.get("email") ?? "").trim();
            await signIn(DEV_AUTH_PROVIDER_ID, {
              redirectTo,
              ...(email ? { email } : {}),
            });
          }}
        >
          <p className="en-dev-rotulo">
            <Terminal size={13} strokeWidth={1.75} aria-hidden />
            Acesso de desenvolvimento
          </p>
          <div className="en-dev-linha">
            <input id="login-dev-email-input" name="email" type="email" autoComplete="off" placeholder={`em branco: ${devUser?.email ?? ""}`} aria-label="Entrar como" />
            <Botao variante="ghost" tamanho="sm" type="submit">
              Entrar como dev
            </Botao>
          </div>
        </form>
      ) : null}

      <div className="en-rodape">
        <Recado enviarRecado={enviarRecado} />
      </div>
    </PortaDeEntrada>
  );
}
