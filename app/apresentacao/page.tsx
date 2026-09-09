import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

import { Palco } from "./palco";
import { SLIDES } from "./slides";

/**
 * A APRESENTAÇÃO À DIRETORIA — o deck mora no produto, e não num arquivo solto.
 *
 * POR QUE AQUI. A demonstração ao vivo acontece neste mesmo aplicativo. Um deck
 * em PowerPoint obrigaria a alternar de janela no meio do argumento; aqui o
 * slide e a coisa demonstrada são a mesma superfície, e é isso que sustenta a
 * abertura escolhida ("isto existe e funciona").
 *
 * PORTÃO DE ADMIN, E NÃO DE MEMBRO. O conteúdo cita um episódio real — projeto
 * devolvido, procuradoria — e lista achados por disciplina. É material dirigido
 * ao diretor. Projetista da PROSUL com login não deve tropeçar nele: seria ler
 * sobre o próprio erro por acidente, sem o enquadramento que a narração dá.
 *
 * FORA DA BARRA LATERAL, pelo mesmo motivo. Rota conhecida por quem apresenta,
 * não item de menu.
 *
 * O PREÇO NÃO ESTÁ NESTAS FOLHAS. Valor do piloto e propriedade do software
 * vivem em `/apresentacao/valores`, e chega-se lá pelo BOTÃO da folha 17 —
 * nunca por uma seta a mais no fim do deck. Até 08/09/2026 aquilo era um
 * `.html` solto em `docs/`, que o `.dockerignore` exclui: existia numa máquina
 * só e nunca chegava a produção, que é de onde a apresentação de fato roda.
 *
 * A FONTE DO CONTEÚDO é `docs/superpowers/specs/2026-08-24-apresentacao-diretoria-design.md`,
 * onde cada número tem a origem escrita. Mudou número aqui, mude lá.
 */

export const metadata: Metadata = {
  title: "NexoDoc — Apresentação à diretoria",
  robots: { index: false, follow: false },
};

export default async function ApresentacaoPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/apresentacao");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !access.isAdmin) {
    redirect("/");
  }

  return <Palco slides={SLIDES} />;
}
