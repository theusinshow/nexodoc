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
