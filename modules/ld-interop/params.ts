import type { LdIntegrationData } from "./types";

export function encodeLdData(data: LdIntegrationData): URLSearchParams {
  const params = new URLSearchParams();

  if (data.codigoInterno) params.set("codigoInterno", data.codigoInterno);
  if (data.codigoExibido) params.set("codigoExibido", data.codigoExibido);
  if (data.revisao) params.set("revisao", data.revisao);
  if (data.nomeObra) params.set("nomeObra", data.nomeObra);
  if (data.fase) params.set("fase", data.fase);
  if (data.orgao) params.set("orgao", data.orgao);
  if (data.tituloLd) params.set("tituloLd", data.tituloLd);
  if (data.volume) params.set("volume", data.volume);

  if (data.tomos && data.tomos.length > 0) {
    params.set("tomos", data.tomos.join(","));
  }

  params.set("fromLd", "1");

  return params;
}

export function decodeLdData(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): LdIntegrationData | null {
  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    const val = searchParams[key];
    return Array.isArray(val) ? val[0] : val;
  };

  const fromLd = get("fromLd");
  if (fromLd !== "1") return null;

  const tomosStr = get("tomos");
  const tomos = tomosStr
    ? tomosStr.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    codigoInterno: get("codigoInterno"),
    codigoExibido: get("codigoExibido"),
    revisao: get("revisao"),
    nomeObra: get("nomeObra"),
    fase: get("fase"),
    orgao: get("orgao"),
    tituloLd: get("tituloLd"),
    volume: get("volume"),
    tomos,
  };
}
