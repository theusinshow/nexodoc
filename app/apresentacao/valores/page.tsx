import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

import { Palco } from "../palco";
import { VALORES } from "./slides-valores";

/**
 * OS VALORES — a proposta comercial, em rota própria.
 *
 * POR QUE ROTA E NÃO ARQUIVO SOLTO. Até 08/09/2026 isto era
 * `docs/anexo-proposta.html`, e `docs/` está no `.dockerignore`: o anexo existia
 * numa máquina só e nunca chegava a produção — que é de onde a apresentação de
 * fato roda. Um preço que só abre no computador de casa não serve à sala.
 *
 * POR QUE SEPARADA DE `/apresentacao`, E NÃO MAIS FOLHAS NO FIM DELA. O que a
 * decisão original protegia era o MOMENTO: valor não pode escapar por avançar a
 * seta no fim do deck. Aqui só se chega pelo BOTÃO da folha 21, que é um gesto —
 * a mão sai do teclado e vai ao mouse. A fricção é a decisão.
 *
 * MESMO PORTÃO DE ADMIN da `/apresentacao`, e pelo mesmo motivo, mais um: aqui
 * há o preço e a declaração de propriedade do software. Projetista da PROSUL
 * com login não deve tropeçar nisto por acidente.
 *
 * FORA DA BARRA LATERAL. Rota conhecida por quem apresenta, não item de menu.
 */

export const metadata: Metadata = {
  title: "NexoDoc — Os valores",
  robots: { index: false, follow: false },
};

export default async function ValoresPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/apresentacao/valores");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !access.isAdmin) {
    redirect("/");
  }

  return <Palco slides={VALORES} />;
}
