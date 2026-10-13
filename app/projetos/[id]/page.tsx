import { notFound, redirect } from "next/navigation";

import { formatarDiaMes } from "@/lib/fuso-de-brasilia";
import { Moldura } from "@/components/moldura/moldura";
import { TelaProjeto, type ItemDaObra, type ObraAberta, type TarefaDaObra } from "@/components/telas/projeto/tela-projeto";
import { cidadeDoCliente } from "@/lib/cliente-do-projeto";
import { linkDoNexo } from "@/lib/contexto-da-url";
import { getPrisma } from "@/lib/db";
import { carregarMoldura } from "@/lib/moldura";
import { plural } from "@/lib/plural";
import { assertProjectAccess, getUserActor, normalizeEmail } from "@/lib/project-store";

/*
 * O PROJETO no sistema novo: tudo de uma obra. As quatro tarefas em tiles no
 * topo, com o estado lido dos artefatos (o mesmo critério da página de antes:
 * módulo ou prefixo do tipo), um painel com abas para documentos, arquivos,
 * gerados e eventos, e o lado com o que fazer agora ou o item escolhido.
 *
 * MONTAR VOLUME LEVA AO NEXO: a montagem manual (/volumes) saiu.
 */

const ROTULO_DO_EVENTO: Record<string, string> = {
  PROJECT_CREATED: "projeto",
  PROJECT_UPDATED: "projeto",
  STATUS_CHANGED: "situação",
  PROJECT_ARCHIVED: "situação",
  PROJECT_DELETED: "situação",
  DOCUMENT_ADDED: "documento",
  DOCUMENT_ARCHIVED: "documento",
  INPUT_UPLOADED: "arquivo",
  AUDIT_CREATED: "auditoria",
  AUDIT_COMPLETED: "auditoria",
  LD_DRAFT_CREATED: "LD",
  LD_GENERATED: "LD",
  COVER_GENERATED: "capa",
  VOLUME_GENERATED: "volume",
  ARTIFACT_CREATED: "gerado",
  NOTE_ADDED: "nota",
};

const ROTULO_DO_GERADO: Record<string, string> = {
  COVER_ODT: "Capa editável",
  COVER_PDF: "Capa",
  COVER_ZIP: "Capas (ZIP)",
  LD_ODT: "LD editável",
  LD_PDF: "Lista de documentos",
  LD_REPORT: "Registro da LD",
  LD_ZIP: "LD (ZIP)",
  AUDIT_MARKDOWN: "Parecer (texto)",
  AUDIT_PDF: "Parecer",
  VOLUME_REPORT: "Registro da montagem",
  VOLUME_PDF: "Volume",
  VOLUME_ZIP: "Volume (ZIP)",
  OTHER: "Outro",
};

function tamanho(bytes: number | null) {
  if (!bytes) return undefined;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

const iso = (d: Date) => d.toISOString();
const primeiroNome = (nome: string | null | undefined, email: string) => (nome?.trim() || email.split("@")[0]).split(/\s+/)[0];

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await carregarMoldura(`/projetos/${encodeURIComponent(id)}`);
  if (dados.semBanco) redirect("/projetos");

  const actor = await getUserActor(normalizeEmail(dados.usuario.email), dados.usuario.nome);
  try {
    await assertProjectAccess(id, actor);
  } catch {
    notFound();
  }

  const prisma = getPrisma();
  const projeto = await prisma.project.findUnique({
    where: { id },
    include: {
      documents: { orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } } } },
      uploads: { orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } } } },
      artifacts: { orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { name: true } } } },
      events: { orderBy: { createdAt: "desc" }, take: 60 },
      audits: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, title: true, createdAt: true, user: { select: { name: true, email: true } } } },
      _count: { select: { documents: true, uploads: true, artifacts: true, events: true, audits: true } },
    },
  });
  if (!projeto || projeto.deletedAt) notFound();

  const primeiro = await prisma.projectEvent.findFirst({ where: { projectId: projeto.id }, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const abertos = await prisma.auditFeedback.findMany({
    where: { resolvedAt: null, assigneeEmail: { not: null }, audit: { projectId: projeto.id } },
    select: { assigneeEmail: true, findingId: true, audit: { select: { id: true, title: true } } },
  });
  const comVoce = abertos.filter((a) => a.assigneeEmail?.toLowerCase() === actor.email.toLowerCase());

  const de = (modulo: string, prefixo: string) => projeto.artifacts.filter((a) => a.module === modulo || a.kind.startsWith(prefixo));
  const lds = de("ld", "LD_");
  const capas = de("capas", "COVER_");
  const volumes = de("volumes", "VOLUME_");
  const ultimaAuditoria = projeto.audits[0] ?? null;

  /*
   * "A CONVERSA DA OBRA" — para onde ela leva quem clica (08/10/2026). A
   * conversa com o Nexo é pessoal; o parecer, os achados e os arquivos são da
   * obra. Então: a SUA conversa daqui, se houver; senão o parecer mais recente
   * (abre numa conversa sua, com os achados do escritório); só sem nada, uma
   * conversa nova já endereçada à obra.
   */
  const minhaConversa = await prisma.nexoConversation.findFirst({
    where: { projectId: projeto.id, userEmail: actor.email },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true },
  });
  const dia = (d: Date) => formatarDiaMes(d);
  const autorDoParecer = ultimaAuditoria?.user
    ? ultimaAuditoria.user.email?.toLowerCase() === actor.email
      ? "você"
      : primeiroNome(ultimaAuditoria.user.name, ultimaAuditoria.user.email ?? "")
    : null;
  const conversa = minhaConversa
    ? { href: `/nexo?conversa=${encodeURIComponent(minhaConversa.id)}`, rotulo: "Continuar a sua conversa", dica: `A sua conversa desta obra, de ${dia(minhaConversa.updatedAt)}.` }
    : ultimaAuditoria
      ? {
          href: `/nexo?auditoria=${encodeURIComponent(ultimaAuditoria.id)}`,
          rotulo: "Abrir o parecer da obra",
          dica: `Auditado${autorDoParecer ? ` por ${autorDoParecer}` : ""} em ${dia(ultimaAuditoria.createdAt)}. Abre numa conversa sua, com os achados da equipe.`,
        }
      : { href: linkDoNexo({ projeto: projeto.id }), rotulo: "Começar a conversa da obra", dica: "Nada foi feito nesta obra ainda." };

  const tarefas: TarefaDaObra[] = [
    {
      id: "auditoria",
      nome: "Auditoria",
      feito: Boolean(ultimaAuditoria),
      estado: abertos.length ? plural(abertos.length, "aberto", "abertos") : ultimaAuditoria ? plural(projeto._count.audits, "parecer", "pareceres") : "ainda não",
      detalhe: ultimaAuditoria ? ultimaAuditoria.title : "nenhum memorial auditado",
      quando: ultimaAuditoria ? iso(ultimaAuditoria.createdAt) : null,
      acao: ultimaAuditoria ? "Abrir o resultado" : "Auditar documentos",
      href: ultimaAuditoria ? `/nexo?auditoria=${encodeURIComponent(ultimaAuditoria.id)}` : linkDoNexo({ projeto: projeto.id, intencao: "auditar" }),
      aviso: abertos.length > 0,
    },
    {
      id: "ld",
      nome: "Lista de documentos",
      feito: lds.length > 0,
      estado: lds.length ? plural(lds.length, "arquivo", "arquivos") : "ainda não",
      detalhe: lds.length ? lds[0].fileName : "nenhuma prancha lida",
      quando: lds.length ? iso(lds[0].createdAt) : null,
      acao: lds.length ? "Ver no Nexo" : "Montar LD",
      href: linkDoNexo({ projeto: projeto.id, intencao: "ld" }),
      aviso: false,
    },
    {
      id: "capas",
      nome: "Capas",
      feito: capas.length > 0,
      estado: capas.length ? plural(capas.length, "arquivo", "arquivos") : "ainda não",
      detalhe: capas.length ? capas[0].fileName : "nenhuma capa gerada",
      quando: capas.length ? iso(capas[0].createdAt) : null,
      acao: capas.length ? "Ver no Nexo" : "Gerar capas",
      href: linkDoNexo({ projeto: projeto.id, intencao: "capa" }),
      aviso: false,
    },
    {
      id: "volume",
      nome: "Volume",
      feito: volumes.length > 0,
      estado: volumes.length ? plural(volumes.length, "arquivo", "arquivos") : "não montado",
      detalhe: volumes.length ? volumes[0].fileName : lds.length ? "a LD existe; falta juntar" : "nada para juntar",
      quando: volumes.length ? iso(volumes[0].createdAt) : null,
      acao: "Montar volume",
      href: linkDoNexo({ projeto: projeto.id, intencao: "montar" }),
      aviso: false,
    },
  ];

  const documentos: ItemDaObra[] = projeto.documents.map((d) => ({
    id: d.id,
    nome: d.fileName,
    tipo: d.documentType || d.module,
    situacao: d.status === "ARCHIVED" ? "arquivado" : d.pageCount ? plural(d.pageCount, "página", "páginas") : undefined,
    tamanho: tamanho(d.sizeBytes),
    quando: d.createdAt.toISOString(),
    quem: primeiroNome(d.user?.name, d.userEmail),
  }));
  const arquivos: ItemDaObra[] = projeto.uploads.map((u) => ({
    id: u.id,
    nome: u.fileName,
    tipo: u.mimeType === "application/pdf" ? "PDF" : u.mimeType.split("/").pop() || u.mimeType,
    tamanho: tamanho(u.sizeBytes),
    origem: u.source === "manual" ? u.module : u.source,
    quando: u.createdAt.toISOString(),
    quem: primeiroNome(u.user?.name, u.userEmail),
  }));
  const gerados: ItemDaObra[] = projeto.artifacts.map((a) => ({
    id: a.id,
    nome: a.fileName,
    tipo: ROTULO_DO_GERADO[a.kind] ?? a.kind,
    situacao:
      a.status !== "AVAILABLE"
        ? "indisponível"
        : a.storageKey && a.storageProvider !== "none"
          ? tamanho(a.sizeBytes)
          : // Gerado antes de 08/10/2026: só o registro veio; o arquivo ficou no navegador de quem gerou.
            [tamanho(a.sizeBytes), "sem cópia no servidor"].filter(Boolean).join(" · "),
    tom: a.status === "AVAILABLE" ? undefined : "aviso",
    quando: a.createdAt.toISOString(),
    quem: primeiroNome(a.user?.name, a.userEmail),
    // Só o que está no cofre tem o que baixar; o resto é histórico (nome e tamanho).
    baixar: a.storageKey && a.storageProvider !== "none" ? `/api/artefatos/${a.id}` : (a.downloadUrl ?? undefined),
    parecer: a.auditId ?? undefined,
  }));
  const eventos: ItemDaObra[] = projeto.events.map((e) => ({
    id: e.id,
    nome: e.title,
    tipo: ROTULO_DO_EVENTO[e.type] ?? e.type,
    situacao: e.summary || undefined,
    quando: e.createdAt.toISOString(),
    quem: primeiroNome(e.actorName, e.actorEmail),
  }));

  const obra: ObraAberta = {
    id: projeto.id,
    codigo: projeto.code,
    nome: projeto.name,
    cliente: projeto.client,
    cidade: cidadeDoCliente(projeto.client),
    observacoes: projeto.description,
    arquivada: projeto.status === "ARCHIVED",
    arquivadaEm: projeto.archivedAt?.toISOString() ?? null,
    contagens: { documentos: projeto._count.documents, arquivos: projeto._count.uploads, gerados: projeto._count.artifacts, eventos: projeto._count.events },
    primeiroEvento: primeiro?.createdAt.toISOString() ?? null,
    comVoce: comVoce.length,
    parecerComVoce: comVoce[0]?.audit.id ?? null,
    achadoComVoce: comVoce[0]?.findingId ?? null,
    tituloDoParecerComVoce: comVoce[0]?.audit.title ?? null,
    conversa,
  };

  return (
    <Moldura dados={dados} atual="Projetos">
      <TelaProjeto obra={obra} tarefas={tarefas} itens={{ documentos, arquivos, gerados, eventos }} />
    </Moldura>
  );
}
