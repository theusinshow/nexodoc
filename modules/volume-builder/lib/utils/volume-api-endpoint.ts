export function getVolumeApiEndpoint(path: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${apiUrl ?? ""}${normalizedPath}`;
}
