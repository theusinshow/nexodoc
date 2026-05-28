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
