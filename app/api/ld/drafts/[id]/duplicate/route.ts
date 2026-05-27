import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";

function getUser(session: Session | null) {
  const email = session?.user?.email?.trim().toLocaleLowerCase("pt-BR");

  return email ? { email, name: session?.user?.name ?? null } : null;
}

function copyJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const user = getUser(session);

  if (!user) {
    return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
  }

  const { id } = await params;
  const source = await getPrisma().ldDraft.findFirst({
    where: {
      id,
      userEmail: user.email,
    },
  });

  if (!source) {
    return NextResponse.json({ error: "LD não encontrada." }, { status: 404 });
  }

  const duplicate = await getPrisma().ldDraft.create({
    data: {
      userEmail: user.email,
      userName: user.name,
      title: `${source.title} (cópia)`,
      projectCode: source.projectCode,
      workName: source.workName,
      status: "DRAFT",
      activeStep: source.activeStep,
      ldData: copyJson(source.ldData),
      rows: copyJson(source.rows),
      tomos: copyJson(source.tomos),
      referenceTotal: source.referenceTotal,
      manualTotal: source.manualTotal,
      uploadedFileNames: copyJson(source.uploadedFileNames),
      generatedFileNames: [],
      events: {
        create: {
          actorEmail: user.email,
          actorName: user.name,
          action: "DUPLICATED",
          summary: `LD duplicada a partir de "${source.title}".`,
          details: {
            sourceId: source.id,
          },
        },
      },
    },
  });

  return NextResponse.json({
    draft: {
      ...duplicate,
      createdAt: duplicate.createdAt.toISOString(),
      updatedAt: duplicate.updatedAt.toISOString(),
      generatedAt: null,
    },
  });
}
