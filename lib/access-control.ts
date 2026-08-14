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

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || normalizedEmail,
        passwordHash: "google-oauth",
        role: envAdmin ? "ADMIN" : "USER",
        isActive: true,
      },
    });

    return {
      email: normalizedEmail,
      isActive: created.isActive,
      isAdmin: envAdmin || created.role === "ADMIN",
      source: envAdmin ? "env" as const : "database" as const,
    };
  }

  const shouldUpdateName = Boolean(name?.trim()) && existing.name !== name?.trim();
  const shouldForceEnvAdmin = envAdmin && (existing.role !== "ADMIN" || !existing.isActive);
  const user =
    shouldUpdateName || shouldForceEnvAdmin
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            ...(shouldUpdateName ? { name: name!.trim() } : {}),
            ...(shouldForceEnvAdmin ? { role: "ADMIN", isActive: true } : {}),
          },
        })
      : existing;

  return {
    email: normalizedEmail,
    isActive: envAdmin || user.isActive,
    isAdmin: envAdmin || user.role === "ADMIN",
    source: envAdmin ? "env" as const : "database" as const,
  };
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
