import { Fragment } from "react";
import { ShieldQuestion } from "lucide-react";

import { MarcaViva } from "@/components/brand/marca-viva";

import { TrocarDeConta } from "./trocar-de-conta";

/**
 * O aviso, separado do guarda de acesso que decide quem o vê.
 *
 * A separação existe por uma razão prática: a página só renderiza para quem
 * tem sessão VÁLIDA e ainda não liberada — uma combinação que não se produz no
 * navegador sem mexer no banco. Com a vista isolada, ela pode ser conferida
 * como componente, e o que fica na página é só a regra de quem entra.
 *
 * O vocabulário é `--signal-info`: nada quebrou, a conta é boa, a porta é que
 * é outra. O info vive no ÍCONE e no rótulo, não no fundo do cartão inteiro —
 * um painel de 520px tingido de azul é o "cartão colorido" que a PRODUCT.md
 * rejeita, e gastar uma cor de sinal em área grande ensina a ignorá-la. A
 * superfície é o Nível 1 da §4: painel `--card` com borda de 1px.
 */
export function AvisoSemAcesso({
  email,
  admins,
}: {
  email: string;
  /** Quem pode liberar. Vazio quando o ambiente não declarou ninguém. */
  admins: string[];
}) {
  const assunto = encodeURIComponent("Liberação de acesso ao Nexo");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="nexodoc-enter w-full max-w-[520px]">
        {/* A marca situa a tela. Quem chega aqui foi empurrado por um redirect
            e precisa saber de qual software é a porta que não abriu. */}
        <MarcaViva size={24} comPalavra />

        <div className="mt-4 rounded-md border bg-card p-6">
          <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[0.05em] text-[var(--signal-info)]">
            <ShieldQuestion
              className="size-4 shrink-0"
              strokeWidth={1.5}
              aria-hidden
            />
            Acesso ainda não liberado
          </p>

          <h1 className="mt-3 text-2xl font-medium leading-[1.2] tracking-[-0.01em]">
            Sua conta está certa — falta a liberação
          </h1>

          <p className="mt-3 text-sm leading-6 text-foreground">
            {/* 13px: o degrau Mono Data da §3. Herdar os 14px do Sans em volta
                deixaria o mono num tamanho que não existe na escala. */}
            Você entrou como{" "}
            <span className="font-mono text-[13px]">{email}</span>. A conta
            é válida; ela só ainda não foi habilitada para este software.
          </p>

          {admins.length > 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Quem libera no escritório:{" "}
              {/* Endereço clicável, não texto para copiar à mão: a §7 pede um
                  próximo passo, e aqui ele é o e-mail já endereçado. Teal
                  porque é interativo (§2) — a única coisa clicável do texto. */}
              {admins.map((admin, i) => (
                <Fragment key={admin}>
                  <a
                    href={`mailto:${admin}?subject=${assunto}`}
                    className="rounded-md font-mono text-[13px] text-primary underline-offset-2 hover:underline"
                  >
                    {admin}
                  </a>
                  {i < admins.length - 1 ? ", " : "."}
                </Fragment>
              ))}
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Peça a liberação a quem administra o Nexo no escritório.
            </p>
          )}

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Depois de liberada, é a mesma conta: entre de novo por aqui.
          </p>

          <div className="mt-5 border-t pt-5">
            <TrocarDeConta />
          </div>
        </div>
      </div>
    </main>
  );
}
