import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  resumoDoRegistro,
  validarRegistro,
  type RegistroDaConversa,
  type ResumoDaConversa,
} from "@/server/nexo/conversa-remota";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

/**
 * AS CONVERSAS DO NEXO NO SERVIDOR — lista e gravação.
 *
 * O `id` é um UUID gerado no navegador: ele IDENTIFICA, não autentica. Toda
 * consulta filtra também pelo e-mail da sessão — sem isso, adivinhar um id
 * daria a conversa de outra pessoa. Mesmo motivo do `/api/nexo/usage`.
 *
 * Os bytes dos artefatos NÃO passam por aqui. Não há provedor de armazenamento
 * (`NEXODOC_STORAGE_PROVIDER=none`), então ODT, PDF e ZIP seguem no navegador
 * de quem gerou. O registro guarda a referência (`blobKey`) e o tamanho, e o
 * cliente marca o artefato como "não está nesta máquina" quando o blob não
 * aparece — o que não pode acontecer é sumir calado.
 */

function semBanco() {
  // Sem `DATABASE_URL` o Nexo continua inteiro no IndexedDB: é como ele sempre
  // funcionou. 503 aqui viraria erro na tela por uma função acessória.
  return NextResponse.json({ conversas: [], sincronizando: false });
}

async function guarda() {
  if (!isNexoEnabled()) {
    return { erro: NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 }) };
  }
  /*
   * O PORTAO no lugar da checagem de sessao.
   *
   * Aqui deu para trocar de vez, e nao somar: a guarda so precisava do e-mail,
   * e o ator ja o traz garantido. `requireActor` recusa quem nao e membro ativo
   * de escritorio -- pergunta que "tem sessao?" nunca fez.
   */
  try {
    const actor = await requireActor();
    return { userEmail: actor.email };
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return { erro: negado };
    throw err;
  }
}

export async function GET() {
  const g = await guarda();
  if (g.erro) return g.erro;
  if (!isDatabaseConfigured()) return semBanco();

  try {
    const linhas = await getPrisma().nexoConversation.findMany({
      where: { userEmail: g.userEmail },
      orderBy: { updatedAt: "desc" },
      // A lista lê SÓ as colunas de fora. Puxar `data` de cem conversas para
      // desenhar a barra lateral seria arrastar megabytes por nada.
      select: {
        id: true,
        title: true,
        folderKey: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
        auditoriaPendente: true,
        tipo: true,
      },
    });

    const conversas: ResumoDaConversa[] = linhas.map((l) => ({
      id: l.id,
      title: l.title,
      createdAt: l.createdAt.getTime(),
      updatedAt: l.updatedAt.getTime(),
      ...(l.folderKey ? { folderKey: l.folderKey } : {}),
      ...(l.projectId ? { projectId: l.projectId } : {}),
      // Só "volume"/"auditoria" viram tipo: a coluna é String e um valor
      // estranho no banco não pode virar uma terceira seção na barra lateral.
      ...(l.tipo === "volume" || l.tipo === "auditoria" ? { tipo: l.tipo } : {}),
      ...(l.auditoriaPendente ? { temAuditoriaPendente: true } : {}),
    }));

    return NextResponse.json({ conversas, sincronizando: true });
  } catch (error) {
    console.error("[nexo-conversas] falha ao listar", error);
    return semBanco();
  }
}

export async function PUT(req: NextRequest) {
  const g = await guarda();
  if (g.erro) return g.erro;
  if (!isDatabaseConfigured()) return semBanco();

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const veredito = validarRegistro(corpo);
  if (!veredito.ok) {
    // 400 e 413 chegam na tela com o motivo. Aceitar calado seria pior: o
    // testador acharia que salvou.
    const grande = veredito.motivo.startsWith("conversa grande demais");
    return NextResponse.json({ error: veredito.motivo }, { status: grande ? 413 : 400 });
  }

  const r: RegistroDaConversa = veredito.registro;
  const resumo = resumoDoRegistro(r);

  try {
    const dono = await getPrisma().nexoConversation.findUnique({
      where: { id: r.id },
      select: { userEmail: true, updatedAt: true },
    });
    /*
     * Conversa de outra pessoa com o mesmo id: 409, nunca sobrescrever. É
     * improvável (UUID v4), mas "improvável" não é uma regra de acesso.
     */
    if (dono && dono.userEmail !== g.userEmail) {
      return NextResponse.json({ error: "conversa de outro usuário" }, { status: 409 });
    }
    /*
     * Gravação mais VELHA que a guardada é descartada em silêncio, e aqui o
     * silêncio é certo: acontece quando duas abas da mesma pessoa gravam fora
     * de ordem, e a resposta honesta é "o servidor já tem coisa melhor".
     */
    if (dono && dono.updatedAt.getTime() > resumo.updatedAt) {
      return NextResponse.json({ ok: true, ignorada: "servidor tem versão mais nova" });
    }

    const campos = {
      userEmail: g.userEmail,
      title: resumo.title,
      folderKey: resumo.folderKey ?? null,
      projectId: resumo.projectId ?? null,
      createdAt: new Date(resumo.createdAt),
      updatedAt: new Date(resumo.updatedAt),
      auditoriaPendente: resumo.temAuditoriaPendente === true,
      tipo: resumo.tipo ?? null,
      data: r as never,
      syncedAt: new Date(),
    };

    await getPrisma().nexoConversation.upsert({
      where: { id: r.id },
      create: { id: r.id, ...campos },
      update: campos,
    });

    return NextResponse.json({ ok: true, bytes: veredito.bytes });
  } catch (error) {
    console.error("[nexo-conversas] falha ao gravar", error);
    return NextResponse.json({ error: "falha ao gravar no servidor" }, { status: 500 });
  }
}
