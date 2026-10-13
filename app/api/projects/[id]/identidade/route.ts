/**
 * A IDENTIDADE GUARDADA DO PROJETO (09/10/2026).
 *
 * PUT com origem `capa` vem do memorial GERAL: grava, recalcula nome e
 * cliente, e CONFERE as auditorias já feitas contra a obra da capa — regra
 * determinística, sem modelo, sem reauditar. PUT com origem `usuario` vem da
 * ficha corrigida. O corpo do memorial nunca chega aqui. Ver
 * [[lib/identidade-do-projeto.ts]].
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { clienteDaCapa } from "@/lib/cliente-do-projeto";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  aplicarGravacao,
  CAMPOS_DA_IDENTIDADE,
  conferirAuditoria,
  lerIdentidadeDoProjeto,
  type CampoDaIdentidade,
  type ConferenciaDaAuditoria,
} from "@/lib/identidade-do-projeto";
import { createProjectEvent } from "@/lib/project-store";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

async function projetoDoEscritorio(id: string, organizationId: string) {
  return getPrisma().project.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: { id: true, client: true, clientKey: true, identidade: true },
  });
}

export async function GET(_req: Request, { params }: Contexto) {
  try {
    const actor = await requireActor();
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    const projeto = await projetoDoEscritorio((await params).id, actor.organizationId);
    if (!projeto) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    return NextResponse.json({ identidade: lerIdentidadeDoProjeto(projeto.identidade) });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function PUT(req: Request, { params }: Contexto) {
  try {
    const actor = await requireActor();
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    }
    const corpo = (await req.json().catch(() => null)) as {
      origem?: unknown;
      fonte?: unknown;
      campos?: Record<string, unknown>;
    } | null;
    const origem = corpo?.origem;
    if (origem !== "capa" && origem !== "usuario") {
      return NextResponse.json({ error: "origem deve ser capa ou usuario." }, { status: 400 });
    }
    const fonte = typeof corpo?.fonte === "string" ? corpo.fonte.trim().slice(0, 300) : "";
    const campos: Partial<Record<CampoDaIdentidade, string>> = {};
    for (const campo of CAMPOS_DA_IDENTIDADE) {
      const v = corpo?.campos?.[campo];
      if (typeof v === "string" && v.trim()) campos[campo] = v.trim().slice(0, 300);
    }

    const prisma = getPrisma();
    const projeto = await projetoDoEscritorio((await params).id, actor.organizationId);
    if (!projeto) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

    const em = new Date().toISOString();
    const r = aplicarGravacao(lerIdentidadeDoProjeto(projeto.identidade), {
      origem,
      fonte,
      em,
      ...(origem === "usuario" && actor.userId ? { por: actor.userId } : {}),
      campos,
    });
    let identidade = r.identidade;

    /*
     * A CONFERÊNCIA RETROATIVA — só quando a capa trouxe a obra. Cada auditoria
     * concluída do projeto é comparada pela obra com que rodou (`report.obra`).
     */
    const conferidas: Array<ConferenciaDaAuditoria & { auditId: string; quando: string }> = [];
    if (r.obraDaCapa) {
      const auditorias = await prisma.audit.findMany({
        where: { projectId: projeto.id, status: "COMPLETED" },
        select: { id: true, createdAt: true, report: true },
        orderBy: { createdAt: "asc" },
      });
      const conferencias = { ...identidade.conferencias };
      for (const a of auditorias) {
        const obra = (a.report as { obra?: unknown } | null)?.obra;
        if (typeof obra !== "string" || !obra.trim()) continue;
        const c = conferirAuditoria(obra.trim(), r.obraDaCapa, em);
        conferencias[a.id] = c;
        conferidas.push({ ...c, auditId: a.id, quando: a.createdAt.toISOString() });
      }
      identidade = { ...identidade, conferencias };
    }

    /*
     * NOME E CLIENTE derivam da identidade quando a CAPA fala. O nome do
     * cadastro não é sobrescrito por correção de ficha — só pela capa. O
     * cliente também: capa vence e avisa (`clienteDaCapa`).
     */
    const dados: Prisma.ProjectUpdateInput = {
      identidade: identidade as unknown as Prisma.InputJsonValue,
    };
    if (r.obraDaCapa) dados.name = r.obraDaCapa;
    const cliente =
      origem === "capa" && (campos.orgao || campos.municipio)
        ? clienteDaCapa({
            atual: projeto.client,
            atualKey: projeto.clientKey,
            lido: campos.orgao ?? "",
            municipioLido: campos.municipio ?? "",
          })
        : null;
    if (cliente) {
      dados.client = cliente.client;
      dados.clientKey = cliente.clientKey;
    }
    await prisma.project.update({ where: { id: projeto.id }, data: dados });

    if (cliente?.divergencia) {
      await createProjectEvent(prisma, {
        projectId: projeto.id,
        actor: { id: actor.userId, email: actor.email, name: actor.name },
        type: "PROJECT_UPDATED",
        title: "Cliente trocado pela capa do geral",
        summary: `O cadastro dizia "${cliente.divergencia.cadastrado}"; a capa diz "${cliente.divergencia.lido}".`,
        details: cliente.divergencia,
      });
    }

    for (const d of r.divergencias) {
      await createProjectEvent(prisma, {
        projectId: projeto.id,
        actor: { id: actor.userId, email: actor.email, name: actor.name },
        type: "PROJECT_UPDATED",
        title: "Capa do geral difere do que estava declarado",
        summary: `${d.campo}: era "${d.anterior.valor}" (${d.anterior.origem}); a capa diz "${d.nova.valor}".`,
        details: d as unknown as Prisma.InputJsonValue,
      });
    }

    return NextResponse.json({ identidade, divergencias: r.divergencias, conferidas });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
