import { redirect } from "next/navigation";

export function buildLoginPath(callbackPath = "/") {
  return `/login?callbackUrl=${encodeURIComponent(callbackPath)}`;
}

export function buildCallbackPath(
  pathname: string,
  params?: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    } else if (typeof value === "string") {
      query.set(key, value);
    }
  }

  const serialized = query.toString();

  return serialized ? `${pathname}?${serialized}` : pathname;
}

export function redirectToLogin(callbackPath = "/"): never {
  redirect(buildLoginPath(callbackPath));
}

export function normalizeAuthCallbackPath(value?: string | null) {
  if (!value) {
    return "/";
  }

  try {
    const parsed = new URL(value, "http://nexodoc.local");
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/login")) {
      return "/";
    }

    return path;
  } catch {
    return "/";
  }
}
