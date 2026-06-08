export const DEV_AUTH_PROVIDER_ID = "nexodoc-dev";

export function isDevAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXODOC_DEV_AUTH === "true"
  );
}

export function getDevAuthUser() {
  const email = process.env.NEXODOC_DEV_AUTH_EMAIL?.trim().toLowerCase();

  if (!isDevAuthEnabled() || !email) {
    return null;
  }

  return {
    id: email,
    email,
    name: process.env.NEXODOC_DEV_AUTH_NAME?.trim() || "Usuário Dev",
  };
}
