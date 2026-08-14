import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PainelDoUsuario } from "@/components/home/painel-do-usuario";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

/*
 * A RAIZ É O PAINEL.
 *
 * Ela era uma grade de cartões de módulo, e antes disso um redirecionamento
 * para o Nexo. O comentário que ficava aqui dizia que "um menu com um item só é
 * uma parada no caminho, então quem entra já entra trabalhando" — e continua
 * verdade. O que mudou é o que significa "trabalhando": com projeto nascendo de
 * documento e achado virando pendência de alguém, a primeira pergunta de quem
 * entra deixou de ser "qual ferramenta" e passou a ser "onde eu estava".
 *
 * Os três módulos que restavam não sumiram, mudaram de lugar: o Nexo é o orbe
 * do centro, e Volumes e Projetos vivem no menu da conta — são LUGARES, e
 * lugar não merece cartão na primeira tela.
 *
 * Desenho: `Nexo - Painel v2.dc.html`, do projeto "Design de interface Nexo".
 * Descrição: `docs/superpowers/specs/2026-08-14-painel-do-usuario-design.md`.
 */
export default async function PainelPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/sem-acesso");
  }

  /*
   * `access.email` e nao `session.user.email`: o do portao ja veio normalizado e
   * NAO e anulavel. O da sessao e `string | null | undefined`, e cair para ""
   * aqui produziria as iniciais "?" para quem tem conta legitima.
   */
  const nome = session.user.name?.trim() || access.email;

  return (
    <PainelDoUsuario
      nome={primeiroNome(nome)}
      iniciais={iniciaisDe(nome)}
      escritorio="PROSUL"
      ehAdmin={access.isAdmin}
    />
  );
}

/*
 * O cabeçalho tem espaço para um nome, e não para um endereço.
 *
 * Quem entra por Google sem nome no perfil cai no e-mail — e
 * `matheusmendes077@gmail.com` estourou a linha e empurrou o avatar. O primeiro
 * nome basta para a pessoa reconhecer que a sessão é dela, que é a única
 * pergunta que este texto responde.
 */
function primeiroNome(valor: string) {
  const local = valor.includes("@") ? valor.split("@")[0] : valor;

  return local.trim().split(/\s+/)[0] || valor;
}

function iniciaisDe(valor: string) {
  const local = valor.includes("@") ? valor.split("@")[0] : valor;
  // Só letras: `matheusmendes077` não pode virar as iniciais "M7".
  const partes = local.split(/[\s._-]+/).filter((p) => /^\p{L}/u.test(p));

  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
