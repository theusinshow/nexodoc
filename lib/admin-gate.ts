/**
 * A REGRA DE ENTRADA DE `/api/admin/*`, num lugar só.
 *
 * Ela morava copiada em sete rotas — sete cópias do mesmo `getBearerToken` e da
 * mesma comparação. Sete cópias é a forma exata que deixa a oitava sair errada,
 * e "errada" aqui significa painel administrativo aberto.
 *
 * SÃO DOIS FATORES, e nenhum substitui o outro:
 *
 *  · a SESSÃO precisa ser de administrador de plataforma. Antes disto, as
 *    páginas de `/admin` checavam `isAdmin` (`app/admin/layout.tsx`) mas as
 *    ROTAS não checavam nada além do token — quem tivesse o token entrava sem
 *    sessão alguma;
 *  · o TOKEN continua exigido. Ele é digitado à mão e guardado no
 *    `sessionStorage`, e é o que protege contra sessão de administrador
 *    esquecida aberta numa máquina.
 *
 * Devolve um resultado em vez de uma `Response` porque as rotas formatam erro de
 * jeitos diferentes — algumas embrulham CORS, outras não. Impor um formato aqui
 * mudaria silenciosamente o contrato de metade delas.
 */
import { requirePlatformAdmin } from "@/lib/access-control";
import { AccessDenied } from "@/lib/actor";
import { isDatabaseConfigured } from "@/lib/db";

export type AdminGateResult =
  | { ok: true; email: string }
  | { ok: false; status: number; message: string };

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";

  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function checkAdminRequest(request: Request): Promise<AdminGateResult> {
  /*
   * A sessão primeiro. Se a pessoa não é administrador, dizer "token inválido"
   * a ensinaria que existe um token a adivinhar.
   */
  let email: string;
  try {
    const admin = await requirePlatformAdmin();
    email = admin.email;
  } catch (err) {
    if (err instanceof AccessDenied) {
      return { ok: false, status: err.status, message: err.message };
    }
    throw err;
  }

  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) {
    return { ok: false, status: 500, message: "NEXODOC_ADMIN_TOKEN não configurado." };
  }

  if (getBearerToken(request) !== adminToken) {
    return { ok: false, status: 401, message: "Acesso admin negado." };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, status: 500, message: "DATABASE_URL não configurada." };
  }

  return { ok: true, email };
}
