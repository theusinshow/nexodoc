// A GUARDA DO BANCO: a bateria apaga tabelas, e só pode fazer isso num banco.
// Decide pelo NOME do banco na URL, antes de qualquer conexão.

const PERMITIDO = "nexodoc_teste";

export function bancoDaBateria(url) {
  let alvo;
  try {
    alvo = new URL(url);
  } catch {
    return { ok: false, motivo: "DATABASE_URL_BATERIA ausente ou não é uma URL" };
  }
  const banco = decodeURIComponent(alvo.pathname.replace(/^\//, ""));
  if (banco !== PERMITIDO) {
    return {
      ok: false,
      motivo: `a bateria só roda no banco ${PERMITIDO}, e a URL aponta para "${banco || "(vazio)"}"`,
    };
  }
  return { ok: true, banco };
}

/** O pooler do Neon não aceita CREATE DATABASE nem o lock da migração. */
export function semOPooler(url) {
  const alvo = new URL(url);
  alvo.hostname = alvo.hostname.replace("-pooler.", ".");
  return alvo.toString();
}
