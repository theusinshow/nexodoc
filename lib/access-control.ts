import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  AccessDenied,
  resolveActor,
  resolvePlatformAdmin,
  type Actor,
  type PlatformAdmin,
} from "@/lib/actor";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getAdminEmails() {
  return new Set(
    (process.env.NEXODOC_ADMIN_EMAILS ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return getAdminEmails().has(normalizeEmail(email));
}

/**
 * Resolve o acesso de um e-mail: ativo? admin? de onde veio essa resposta?
 *
 * ATENCAO — a promocao por ambiente e de MAO UNICA. Quem esta em
 * `NEXODOC_ADMIN_EMAILS` e promovido a `ADMIN` no banco (`shouldForceEnvAdmin`
 * abaixo), e nada aqui rebaixa. Tirar o e-mail da variavel NAO revoga o acesso:
 * o papel ficou gravado e a pessoa continua entrando. Para revogar de verdade,
 * mude o papel em `/admin/users` e so entao remova da variavel — na ordem
 * inversa, o proximo login promove de novo.
 *
 * Isso e deliberado (a variavel e o bootstrap do primeiro admin, quando ainda
 * nao ha ninguem para promover pela tela), mas e facil de confundir com um
 * mecanismo de revogacao — e confiar nele como tal deixaria um acesso aberto
 * achando que foi fechado.
 */
export async function getUserAccess(email: string | null | undefined, name?: string | null) {
  if (!email) {
    return {
      email: "",
      isActive: false,
      isAdmin: false,
      source: "none" as const,
    };
  }

  const normalizedEmail = normalizeEmail(email);
  const envAdmin = isAdminEmail(normalizedEmail);

  if (!isDatabaseConfigured()) {
    return {
      email: normalizedEmail,
      isActive: true,
      isAdmin: envAdmin,
      source: "env" as const,
    };
  }

  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  const shouldUpdateName = existing
    ? Boolean(name?.trim()) && existing.name !== name?.trim()
    : false;
  const shouldForceEnvAdmin = existing
    ? envAdmin && (existing.role !== "ADMIN" || !existing.isActive)
    : false;

  const user = !existing
    ? await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || normalizedEmail,
          passwordHash: "google-oauth",
          role: envAdmin ? "ADMIN" : "USER",
          isActive: true,
        },
      })
    : shouldUpdateName || shouldForceEnvAdmin
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            ...(shouldUpdateName ? { name: name!.trim() } : {}),
            ...(shouldForceEnvAdmin ? { role: "ADMIN", isActive: true } : {}),
          },
        })
      : existing;

  /*
   * AS DUAS LIGAÇÕES VALEM PARA QUEM ACABOU DE NASCER TAMBÉM, e é por isso que
   * elas ficam aqui embaixo, depois dos dois caminhos, em vez de dentro de cada
   * um.
   *
   * Estavam separadas, e o ramo de conta nova devolvia antes de chamar
   * `garantirEscritorioPadrao` — então o primeiro pedido de quem entra pela
   * primeira vez achava a conta criada e NENHUM vínculo, e o portão recusava com
   * "Você não faz parte de nenhum escritório.". O segundo pedido já passava,
   * porque aí a conta existia e o automático rodava. Um 403 que some ao recarregar
   * é pior que um 403 fixo: parece defeito de sorte, e nunca aparece em prova que
   * carregue uma página antes de chamar a API — que era o caso da nossa.
   *
   * A ORDEM É PARTE DA REGRA: o convite primeiro. Quem foi convidado como ADMIN
   * tem o vínculo virado para ACTIVE com o papel que a coordenação escolheu, e o
   * automático logo abaixo vê que já há vínculo e não faz nada. Invertidas, o
   * automático criaria um MEMBER e rebaixaria o convite.
   */
  await ativarConvitePendente(user.id, normalizedEmail);
  await garantirEscritorioPadrao(user.id, normalizedEmail, name);

  return {
    email: normalizedEmail,
    isActive: envAdmin || user.isActive,
    isAdmin: envAdmin || user.role === "ADMIN",
    source: envAdmin ? "env" as const : "database" as const,
  };
}

/**
 * O convite espera a pessoa; o primeiro login o confirma.
 *
 * Não há tela de "aceitar convite" de propósito: para um escritório, o aceite
 * já aconteceu fora do sistema, quando contrataram. O que falta é ligar o
 * vínculo à conta — e o momento em que a conta passa a existir é este.
 *
 * `updateMany` e não `update` porque um mesmo e-mail pode ter vínculo em mais
 * de um escritório no futuro, e nenhum deles deve ficar pendurado.
 */
async function ativarConvitePendente(userId: string, email: string) {
  await getPrisma().organizationMember.updateMany({
    where: { email, status: "INVITED" },
    data: { userId, status: "ACTIVE" },
  });

  /*
   * E religa o `userId` de quem já estava ACTIVE sem conta — o caso de quem foi
   * criado pelo backfill a partir de um projeto antigo, cujo dono nunca tinha
   * `User`. Sem isto, `actor.userId` seguiria nulo para sempre, e a auditoria
   * gravada por essa pessoa ficaria sem autor.
   */
  await getPrisma().organizationMember.updateMany({
    where: { email, userId: null },
    data: { userId },
  });
}

/**
 * TODO MUNDO QUE ENTRA É DA PROSUL.
 *
 * Decisão do mantenedor, tomada em 14/08/2026 com a consequência na mão: existe
 * um escritório só, e enquanto for assim conta sem vínculo não é proteção, é uma
 * pessoa levando 403 sem motivo. Quem chega sem convite entra como `MEMBER`.
 *
 * O QUE ISTO ABRE, escrito para não virar surpresa: o login é Google, então esta
 * porta não é só para gente contratada — qualquer pessoa com conta Google que
 * abrir o site vira membro e passa a enxergar os projetos. O freio é o
 * `NEXODOC_ESCRITORIO_PADRAO`: definido e VAZIO, desliga o automático e o
 * sistema volta a exigir convite, sem precisar de deploy de código.
 *
 * DUAS TRAVAS, e as duas existem por um caso concreto:
 *
 *  · só cria quando NÃO HÁ vínculo nenhum — nem ACTIVE, nem INVITED, nem
 *    DISABLED. Quem foi desligado a mão voltaria a entrar no login seguinte, e
 *    o desligamento é justamente o gesto que não pode ser desfeito sozinho;
 *
 *  · `MEMBER`, nunca `ADMIN`. Alçada de cadastrar projeto define centro de
 *    custo, e centro de custo errado manda achado para a fila de outro projeto.
 *    Papel maior continua sendo concessão de gente.
 */
async function garantirEscritorioPadrao(
  userId: string,
  email: string,
  name?: string | null,
) {
  const prisma = getPrisma();

  /*
   * O VÍNCULO EXISTENTE É CONSULTADO PRIMEIRO, e a ordem tem uma razão: é o
   * único jeito de as duas desistências abaixo saberem que estão desistindo de
   * ALGUÉM. Sem isso elas seriam mudas por obrigação — avisar em toda visita de
   * quem já é membro encheria o log de nada.
   */
  const jaTemVinculo = await prisma.organizationMember.findFirst({
    where: { email },
    select: { id: true },
  });

  if (jaTemVinculo) {
    return;
  }

  const organizationId = escritorioPadrao();

  /*
   * AS DUAS DESISTÊNCIAS FALAM, e é por isso que estas linhas existem.
   *
   * Aconteceu em produção: quem entrava levava "Você não faz parte de nenhum
   * escritório." e o servidor não dizia uma palavra sobre o porquê — do lado de
   * fora, o automático simplesmente não existia. Levou uma leitura do banco de
   * produção para descobrir que o vínculo nunca tinha sido criado, e o código
   * sozinho não distinguia "o freio está puxado" de "o código não subiu".
   *
   * `warn` e não `error`: nenhuma das duas é falha do programa. A primeira é uma
   * decisão de quem configurou (o freio do `NEXODOC_ESCRITORIO_PADRAO`), a
   * segunda é banco sem seed. As duas viram 403 logo em seguida, e a única coisa
   * que faltava era o log dizer qual delas foi.
   */
  if (!organizationId) {
    console.warn(
      `[escritório] ${email} não tem vínculo e o escritório padrão está ` +
        `desligado (NEXODOC_ESCRITORIO_PADRAO definida e vazia). Vai levar 403.`,
    );
    return;
  }

  /*
   * Num banco sem seed o escritório não existe, e `create` estouraria por chave
   * estrangeira no meio de um login. Preferir deixar a pessoa sem vínculo a
   * derrubar a entrada dela: sem escritório, o portão recusa com 403, que é uma
   * resposta — o estouro não seria.
   */
  const escritorio = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!escritorio) {
    console.warn(
      `[escritório] ${email} não tem vínculo e o escritório padrão ` +
        `"${organizationId}" não existe neste banco. Vai levar 403.`,
    );
    return;
  }

  /*
   * `upsert` com `update` vazio, e não `create`: duas abas abrindo o site ao
   * mesmo tempo entram aqui juntas, as duas leem "não tem vínculo", e a segunda
   * bateria no unique `(organizationId, email)` — derrubando o login de quem só
   * abriu o site duas vezes. O `update: {}` também garante que a corrida não
   * reescreva papel nem status de um vínculo que a outra acabou de criar.
   */
  await prisma.organizationMember.upsert({
    where: { organizationId_email: { organizationId, email } },
    create: {
      organizationId,
      email,
      name: name?.trim() || null,
      userId,
      role: "MEMBER",
      status: "ACTIVE",
    },
    update: {},
  });
}

/**
 * `undefined` (variável ausente) mantém a PROSUL; definida e VAZIA desliga o
 * automático. Um `|| "org-prosul"` teria tratado vazio como ausente, e o freio
 * não existiria.
 */
function escritorioPadrao() {
  const bruto = process.env.NEXODOC_ESCRITORIO_PADRAO;

  if (bruto === undefined) {
    return "org-prosul";
  }

  const limpo = bruto.trim();

  return limpo.length > 0 ? limpo : null;
}

/**
 * O PORTÃO. Toda rota sob `app/api/` começa por aqui.
 *
 * NÃO é `middleware.ts`, e isso é decisão e não descuido: middleware roda em
 * runtime de borda e não alcança o Prisma de forma confiável. O `authorized` de
 * [[../auth.ts]] continua fazendo o que sabe fazer — distinguir logado de
 * deslogado. Quem está logado pode não ter escritório, e essa pergunta só o
 * banco responde. Autorização precisa do banco; autenticação não.
 *
 * Quem quiser saber POR QUE cada recusa acontece, a regra está em
 * [[actor.ts]], testável sem banco nenhum.
 */
export async function requireActor(): Promise<Actor> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const access = email ? await getUserAccess(email, session?.user?.name) : null;

  /*
   * Sem banco não há membro para consultar, e `resolveActor` vai recusar com
   * 403. É o certo: um ambiente sem banco não tem escritório, e deixar passar
   * "porque não deu para verificar" é como tratar falha de checagem por
   * permissão concedida.
   */
  if (!access?.email || !isDatabaseConfigured()) {
    return resolveActor({ access: access ?? null, member: null });
  }

  const member = await getPrisma().organizationMember.findFirst({
    where: { email: access.email },
    select: {
      userId: true,
      name: true,
      organizationId: true,
      role: true,
      status: true,
    },
  });

  return resolveActor({ access, member });
}

/**
 * O PORTÃO DA PLATAFORMA, para `/api/admin/*`.
 *
 * NÃO substitui o `NEXODOC_ADMIN_TOKEN` que aquelas rotas já exigem — soma-se a
 * ele. Hoje o token é a única barreira da API administrativa: as PÁGINAS de
 * `/admin` checam `isAdmin` da sessão (`app/admin/layout.tsx`), mas as ROTAS
 * checam só o Bearer. Quem tiver o token entra sem sessão nenhuma, e o token
 * mora no `sessionStorage` do navegador de quem o digitou.
 *
 * Com os dois, são dois fatores independentes: uma sessão de administrador e um
 * segredo digitado. Perder um não abre a porta.
 */
export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const access = email ? await getUserAccess(email, session?.user?.name) : null;

  return resolvePlatformAdmin(access ?? null);
}

/**
 * Traduz a recusa em resposta.
 *
 * Devolve `null` quando o erro NÃO é de acesso, e quem chama re-lança. Engolir
 * exceção de banco aqui faria falha de infraestrutura parecer falta de
 * permissão — e o usuário passaria a tarde pedindo um acesso que já tem,
 * enquanto o Postgres continua fora do ar sem ninguém saber.
 */
export function accessDeniedResponse(err: unknown) {
  if (err instanceof AccessDenied) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }

  return null;
}
