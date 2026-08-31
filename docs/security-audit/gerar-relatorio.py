#!/usr/bin/env python3
"""Gera o relatorio de auditoria de seguranca do NexoDoc.

Uso (a partir da raiz do repositorio):
    python docs/security-audit/gerar-relatorio.py

Dependencias: reportlab e matplotlib.
"""

from __future__ import annotations

import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "security-audit"
OUT_FILE = OUT_DIR / "relatorio-auditoria-seguranca.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 2 * cm
MARGIN_TOP = 2.25 * cm
MARGIN_BOTTOM = 1.9 * cm

INK = colors.HexColor("#17212B")
MUTED = colors.HexColor("#5B6875")
LINE = colors.HexColor("#D7DEE5")
PAPER = colors.HexColor("#F7F9FA")
CRITICAL = colors.HexColor("#B91C1C")
HIGH = colors.HexColor("#EA580C")
MEDIUM = colors.HexColor("#D97706")
LOW = colors.HexColor("#2563EB")
STRONG = colors.HexColor("#059669")
NAVY = colors.HexColor("#17324D")


def register_fonts() -> tuple[str, str, str]:
    candidates = [
        (Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf"), Path("C:/Windows/Fonts/consola.ttf")),
        (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")),
    ]
    for regular, bold, mono in candidates:
        if regular.exists() and bold.exists() and mono.exists():
            pdfmetrics.registerFont(TTFont("AuditSans", str(regular)))
            pdfmetrics.registerFont(TTFont("AuditSansBold", str(bold)))
            pdfmetrics.registerFont(TTFont("AuditMono", str(mono)))
            return "AuditSans", "AuditSansBold", "AuditMono"
    return "Helvetica", "Helvetica-Bold", "Courier"


FONT, FONT_BOLD, FONT_MONO = register_fonts()


class AuditDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            rightMargin=MARGIN_X,
            leftMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="Relatorio de Auditoria de Seguranca - NexoDoc",
            author="Auditoria tecnica automatizada",
            subject="Revisao de isolamento, autorizacao, IDOR, segredos e XSS",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates(PageTemplate(id="content", frames=[frame], onPage=self._header_footer))

    def _header_footer(self, canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.5)
            canvas.line(MARGIN_X, PAGE_H - 1.35 * cm, PAGE_W - MARGIN_X, PAGE_H - 1.35 * cm)
            canvas.setFont(FONT_BOLD, 7.5)
            canvas.setFillColor(NAVY)
            canvas.drawString(MARGIN_X, PAGE_H - 1.12 * cm, "RELATORIO DE AUDITORIA DE SEGURANCA - NEXODOC")
            canvas.setFont(FONT, 7.5)
            canvas.setFillColor(MUTED)
            canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 1.12 * cm, "31/08/2026")
        canvas.setStrokeColor(LINE)
        canvas.line(MARGIN_X, 1.15 * cm, PAGE_W - MARGIN_X, 1.15 * cm)
        canvas.setFont(FONT, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, 0.78 * cm, "Escopo: codigo, configuracao, deploy, bundle e historico Git")
        canvas.drawRightString(PAGE_W - MARGIN_X, 0.78 * cm, f"Pagina {doc.page}")
        canvas.restoreState()


base = getSampleStyleSheet()
styles = {
    "cover_kicker": ParagraphStyle("cover_kicker", fontName=FONT_BOLD, fontSize=10, leading=13, textColor=STRONG, spaceAfter=12),
    "cover_title": ParagraphStyle("cover_title", fontName=FONT_BOLD, fontSize=27, leading=32, textColor=NAVY, spaceAfter=16),
    "cover_meta": ParagraphStyle("cover_meta", fontName=FONT, fontSize=10.5, leading=16, textColor=INK, spaceAfter=6),
    "h1": ParagraphStyle("h1", fontName=FONT_BOLD, fontSize=19, leading=23, textColor=NAVY, spaceBefore=5, spaceAfter=12),
    "h2": ParagraphStyle("h2", fontName=FONT_BOLD, fontSize=13, leading=17, textColor=NAVY, spaceBefore=10, spaceAfter=7),
    "h3": ParagraphStyle("h3", fontName=FONT_BOLD, fontSize=10.5, leading=14, textColor=INK, spaceBefore=7, spaceAfter=4),
    "body": ParagraphStyle("body", fontName=FONT, fontSize=9.2, leading=13.2, textColor=INK, spaceAfter=7),
    "small": ParagraphStyle("small", fontName=FONT, fontSize=7.8, leading=10.5, textColor=MUTED, spaceAfter=4),
    "table": ParagraphStyle("table", fontName=FONT, fontSize=7.2, leading=9.4, textColor=INK),
    "table_bold": ParagraphStyle("table_bold", fontName=FONT_BOLD, fontSize=7.1, leading=9.2, textColor=INK),
    "code": ParagraphStyle("code", fontName=FONT_MONO, fontSize=6.8, leading=9.3, textColor=colors.HexColor("#263746"), backColor=PAPER, borderColor=LINE, borderWidth=0.6, borderPadding=7, spaceAfter=7),
    "issue": ParagraphStyle("issue", fontName=FONT_MONO, fontSize=6.7, leading=9.2, textColor=INK, backColor=colors.HexColor("#F2F5F7"), borderColor=LINE, borderWidth=0.8, borderPadding=9, spaceAfter=8),
    "callout": ParagraphStyle("callout", fontName=FONT, fontSize=9, leading=13, textColor=INK, backColor=colors.HexColor("#EEF8F5"), borderColor=STRONG, borderWidth=0.8, borderPadding=9, spaceAfter=8),
    "warning": ParagraphStyle("warning", fontName=FONT, fontSize=9, leading=13, textColor=INK, backColor=colors.HexColor("#FFF5EC"), borderColor=HIGH, borderWidth=0.8, borderPadding=9, spaceAfter=8),
    "center": ParagraphStyle("center", fontName=FONT, fontSize=8, leading=11, alignment=TA_CENTER, textColor=MUTED),
}


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, styles[style])


def safe(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")


def code(text: str) -> Paragraph:
    return p(safe(text), "code")


def severity_chip(label: str) -> Paragraph:
    color_map = {
        "CRITICA": CRITICAL,
        "ALTA": HIGH,
        "MEDIA": MEDIUM,
        "BAIXA": LOW,
        "INFORMATIVA": MUTED,
    }
    color = color_map[label]
    return Paragraph(
        f'<font color="{color.hexval()}"><b>{label}</b></font>',
        ParagraphStyle("chip", parent=styles["table_bold"], alignment=TA_CENTER),
    )


def donut_chart() -> Image:
    values = [1, 4, 2]
    labels = ["Critica 1", "Alta 4", "Media 2"]
    colors_ = ["#B91C1C", "#EA580C", "#D97706"]
    fig, ax = plt.subplots(figsize=(4.1, 2.9), dpi=170)
    wedges, _ = ax.pie(values, colors=colors_, startangle=90, wedgeprops=dict(width=0.34, edgecolor="white", linewidth=2))
    ax.text(0, 0.06, "7", ha="center", va="center", fontsize=22, fontweight="bold", color="#17324D")
    ax.text(0, -0.17, "achados", ha="center", va="center", fontsize=8, color="#5B6875")
    ax.legend(wedges, labels, loc="lower center", bbox_to_anchor=(0.5, -0.18), ncol=3, frameon=False, fontsize=7.5)
    ax.set(aspect="equal")
    fig.tight_layout(pad=0.2)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=7.2 * cm, height=5.1 * cm)


def category_chart() -> Image:
    labels = ["Banco", "Permissao\nno navegador", "IDOR", "Chaves", "XSS"]
    values = [3, 0, 3, 1, 0]
    bar_colors = ["#17324D", "#93A1AE", "#B91C1C", "#EA580C", "#D97706"]
    fig, ax = plt.subplots(figsize=(5.2, 2.9), dpi=170)
    bars = ax.bar(labels, values, color=bar_colors, width=0.62)
    ax.set_ylim(0, 3.6)
    ax.set_yticks([0, 1, 2, 3])
    ax.grid(axis="y", color="#D7DEE5", linewidth=0.7)
    ax.set_axisbelow(True)
    ax.spines[["top", "right", "left"]].set_visible(False)
    ax.spines["bottom"].set_color("#AAB5BF")
    ax.tick_params(axis="y", labelsize=7, colors="#5B6875", length=0)
    ax.tick_params(axis="x", labelsize=7.2, colors="#253746", length=0)
    for bar, value in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, value + 0.08, str(value), ha="center", fontsize=8, fontweight="bold", color="#253746")
    fig.tight_layout(pad=0.6)
    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True, bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=8.2 * cm, height=4.6 * cm)


def finding_card(fid: str, title: str, severity: str, category: str, summary: str, condition: str, evidence: list[tuple[str, str]]):
    content = [
        Table(
            [[p(f"<b>{fid}</b> - {title}", "h3"), severity_chip(severity)]],
            colWidths=[14.1 * cm, 2.2 * cm],
            style=TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.8, LINE),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]),
        ),
        Spacer(1, 5),
        p(f"<b>Categoria:</b> {category}. {summary}"),
        p(f"<b>Status de remediacao em 31/08/2026:</b> {remediation_status[fid]}", "callout"),
        p(f"<b>Condicao de explorabilidade:</b> {condition}", "small"),
    ]
    for label, snippet in evidence:
        content.append(p(f"<b>Evidencia - {label}</b>", "small"))
        content.append(code(snippet))
    content.append(Spacer(1, 7))
    return content


findings = [
    {
        "id": "F-01", "sev": "CRITICA", "cat": "Banco sem tranca",
        "title": "Qualquer conta Google vira membro ativo da organizacao padrao",
        "desc": "O login Google nao aplica allowlist de dominio ou e-mail. No primeiro acesso, getUserAccess chama garantirEscritorioPadrao; se NEXODOC_ESCRITORIO_PADRAO estiver ausente, o codigo escolhe org-prosul e cria um vinculo MEMBER/ACTIVE. O render.yaml atual nao declara a variavel, portanto o caminho padrao esta ativo no deploy descrito pelo repositorio. Depois disso, o novo membro passa pelo mesmo isolamento por organizacao usado para projetos e auditorias.",
        "condition": "Exploravel quando a aplicacao e o OAuth Google sao acessiveis externamente e NEXODOC_ESCRITORIO_PADRAO esta ausente. Definir a variavel como string vazia desliga o comportamento.",
        "evidence": [
            ("auth.ts:11-36", "11: export const { auth, handlers, signIn, signOut } = NextAuth({\n12:   providers: [\n13:     Google({ ... }),\n20:     ...(isDevAuthEnabled() ? [Credentials(...)] : []),\n36:   ],"),
            ("lib/access-control.ts:121-122, 255-264, 274-279", "121: await ativarConvitePendente(user.id, normalizedEmail);\n122: await garantirEscritorioPadrao(user.id, normalizedEmail, name);\n255: await prisma.organizationMember.upsert({\n256:   where: { organizationId_email: { organizationId, email } },\n257:   create: { organizationId, email, name: ..., userId,\n262:     role: \"MEMBER\",\n263:     status: \"ACTIVE\" },\n274: function escritorioPadrao() {\n275:   const bruto = process.env.NEXODOC_ESCRITORIO_PADRAO;\n277:   if (bruto === undefined) {\n278:     return \"org-prosul\";"),
        ],
    },
    {
        "id": "F-02", "sev": "ALTA", "cat": "Banco sem tranca",
        "title": "Historico recente e qualidade agregam auditorias de todas as organizacoes",
        "desc": "Depois de requireActor, a listagem executa audit.findMany sem where de project.organizationId e devolve report, result, nomes de arquivos e IDs. O endpoint de qualidade faz groupBy global de AuditFeedback. Isso ignora o mecanismo canonico do projeto, que e membership + organizationId. Em producao os dois dependem de NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true; fora de producao ficam ativos automaticamente.",
        "condition": "Exploravel em qualquer ambiente nao-production, ou em producao quando NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true. Exige ao menos duas organizacoes com dados, ou dados legados de pessoas diferentes.",
        "evidence": [
            ("app/api/audits/recent/route.ts:10-14, 58-85", "10: function isRecentHistoryEnabled() {\n11:   return (\n12:     process.env.NODE_ENV !== \"production\" ||\n13:     process.env.NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY === \"true\"\n14:   );\n58: const audits = await getPrisma().audit.findMany({\n59:   take: getLimit(request),\n60:   orderBy: { createdAt: \"desc\" },\n63:   select: { id: true, ... result: true, report: true, ... files: {...} }\n85: });"),
            ("app/api/audits/quality/route.ts:31-34", "31: const grouped = await getPrisma().auditFeedback.groupBy({\n32:   by: [\"verdict\"],\n33:   _count: { _all: true },\n34: });"),
        ],
    },
    {
        "id": "F-03", "sev": "ALTA", "cat": "IDOR",
        "title": "Chat aceita auditId arbitrario, le o texto integral e sobrescreve o parecer",
        "desc": "A rota valida apenas que existe um ator. O auditId vem do corpo, e carregarMemoriaDoDocumento consulta AuditText somente por auditId. O texto integral do memorial entra nas ferramentas do modelo; ao registrar um achado, gravarAchadoNoParecer atualiza Audit pelo mesmo ID, sem posse ou organizationId. O projectId do historico tambem vem do cliente. Um membro que conheca o ID de outra auditoria pode consultar seu conteudo por linguagem natural e alterar o relatorio persistido.",
        "condition": "Exige uma sessao de membro ativo e conhecimento de um auditId valido. O ID pode aparecer em links, logs, respostas do historico global quando F-02 esta ativo ou compartilhamentos internos.",
        "evidence": [
            ("app/api/audit/chat/route.ts:114-125, 131-141, 168-183, 198-213", "114: async function gravarAchadoNoParecer(auditId: string, report: AuditReport) {\n119:   await prisma.audit.update({\n120:     where: { id: auditId },\n131: export async function POST(request: Request) {\n136:   await requireActor();\n168: const auditId = String(body.auditId ?? \"\");\n183: const memorias = auditId ? await carregarMemoriaDoDocumento(auditId) : [];\n198: historicoDaObra: () => historicoDaObra({ auditId, projectId: body.projectId ?? null }),\n213: if (auditId) await gravarAchadoNoParecer(auditId, atualizado);"),
            ("lib/memoria-do-documento.ts:104-113", "104: export async function carregarMemoriaDoDocumento(auditId: string) {\n109:   const linhas = await prisma.auditText.findMany({\n110:     where: { auditId },\n111:     orderBy: { createdAt: \"asc\" },\n112:     select: { fileName: true, pages: true, capitulos: true, charCount: true },\n113:   });"),
        ],
    },
    {
        "id": "F-04", "sev": "ALTA", "cat": "IDOR",
        "title": "Endpoints auxiliares de auditoria usam ID sem validar organizacao",
        "desc": "Tres fluxos repetem o mesmo erro. O cancelamento altera qualquer auditoria PROCESSING pelo ID. Feedback lista e grava linhas de qualquer auditoria, inclusive notas, responsaveis e vereditos. Delta carrega a impressao de uma auditoria anterior apenas pelo ID. Todos autenticam, mas nenhum liga o objeto ao actor.organizationId ou ao dono legado.",
        "condition": "Exige sessao de membro e auditId valido. Cancelamento exige a janela em que status=PROCESSING. Feedback em producao exige NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true. Delta exige auditoria COMPLETED com impressao.",
        "evidence": [
            ("app/api/audit/[id]/cancel/route.ts:58-64", "58: const updated = await getPrisma().audit.updateMany({\n59:   where: { id, status: \"PROCESSING\" },\n60:   data: {\n61:     status: \"CANCELED\",\n62:     error: \"Auditoria cancelada pelo usuario.\",\n63:     completedAt: new Date(),\n64:   },"),
            ("app/api/audits/[id]/feedback/route.ts:68-71, 234-237, 274-308", "68: const feedback = await getPrisma().auditFeedback.findMany({\n69:   where: { auditId: id },\n70:   orderBy: { createdAt: \"asc\" },\n71: });\n234: const audit = await getPrisma().audit.findUnique({\n235:   where: { id },\n236:   select: { id: true },\n237: });\n274: const feedback = ... auditFeedback.create/upsert({ auditId: id, ... });"),
            ("app/api/audit/delta/route.ts:63-65", "63: const anterior = await getPrisma().audit.findFirst({\n64:   where: { id: auditIdAnterior },\n65:   select: { id: true, report: true, completedAt: true, createdAt: true, status: true },\n66: });"),
        ],
    },
    {
        "id": "F-05", "sev": "MEDIA", "cat": "Banco sem tranca",
        "title": "AuditLearning e global e pode ser alterado por membro de qualquer organizacao",
        "desc": "O schema diz que o aprendizado e do escritorio, mas AuditLearning nao possui organizationId. GET/POST/PATCH/DELETE chamam requireActor e descartam o ator; as consultas e mutacoes sao globais. Esses textos entram no prompt de toda auditoria. Em uma instalacao com duas organizacoes, um membro le, altera ou exclui as regras da outra e pode influenciar os resultados de IA.",
        "condition": "Impacto entre tenants exige duas organizacoes na mesma base. Mesmo com uma organizacao, qualquer MEMBER ativo consegue alterar o acervo global por chamada direta.",
        "evidence": [
            ("prisma/schema.prisma:698-717", "698: /// Sem relacao com `User`: aprendizado e do ESCRITORIO...\n701: model AuditLearning {\n702:   id String @id @default(cuid())\n703:   title String\n704:   content String\n707:   type String @default(\"preference\")\n709:   scope String @default(\"global\")\n711:   status String @default(\"active\")\n717:   @@index([status, scope, updatedAt])\n// Nao existe organizationId."),
            ("app/api/learnings/route.ts:49-63, 66-88", "49: export async function GET(request: Request) {\n54:   await requireActor();\n61:   const learnings = await listAuditLearnings();\n66: export async function POST(request: Request) {\n71:   await requireActor();\n80:   const learning = await createAuditLearning({ ... });"),
            ("lib/audit-learnings.ts:205-215, 235-246, 280-303, 337", "205: const rows = await getPrisma().auditLearning.findMany({ where: {...} });\n235: const row = await getPrisma().auditLearning.create({ data: {...} });\n280: const atual = await getPrisma().auditLearning.findUnique({ where: { id } });\n302: const row = await getPrisma().auditLearning.update({ where: { id }, ... });\n337: const { count } = await getPrisma().auditLearning.deleteMany({ where: { id } });"),
        ],
    },
    {
        "id": "F-06", "sev": "MEDIA", "cat": "IDOR",
        "title": "Criacao de artefato aceita auditId e ldDraftId de outro projeto ou tenant",
        "desc": "A rota confirma acesso apenas ao projectId do caminho. Em seguida aceita auditId e ldDraftId do corpo e createDocumentArtifact grava as FKs diretamente, sem provar que os objetos relacionados pertencem ao mesmo projeto ou organizacao. Com IDs validos, um membro pode criar relacoes cruzadas e corromper a trilha de auditoria; respostas diferentes entre FK valida e invalida tambem funcionam como oraculo de existencia.",
        "condition": "Exige acesso ao projeto do path e conhecimento de um auditId ou ldDraftId valido de outro contexto. A FK precisa existir; IDs inexistentes sao recusados pelo banco.",
        "evidence": [
            ("app/api/projects/[id]/artifacts/route.ts:167-190", "167: try {\n168:   await assertProjectAccess(id, actor);\n173: const expiresAtValue = getStringField(payload?.expiresAt);\n174: const artifact = await getPrisma().$transaction((tx) =>\n175:   createDocumentArtifact(tx, {\n176:     projectId: id,\n177:     auditId: getStringField(payload?.auditId) || undefined,\n178:     ldDraftId: getStringField(payload?.ldDraftId) || undefined,\n190:     metadata: payload?.metadata as Prisma.InputJsonValue | undefined,"),
            ("lib/project-store.ts:231-248", "231: const artifact = await tx.documentArtifact.create({\n232:   data: {\n233:     projectId: input.projectId ?? undefined,\n234:     auditId: input.auditId ?? undefined,\n235:     ldDraftId: input.ldDraftId ?? undefined,\n236:     userId: input.actor.id ?? undefined,\n...\n248:     metadata: input.metadata,"),
        ],
    },
    {
        "id": "F-07", "sev": "ALTA", "cat": "Chaves expostas",
        "title": "Chave OpenAI real foi copiada para teste e permanece no Git",
        "desc": "Um literal com formato sk-proj aparece no teste que valida nomes de modelo; o proprio nome do teste diz que uma chave ja foi parar no banco. O valor foi introduzido no commit 311196f e continua no HEAD, portanto clones e forks preservam a credencial. A auditoria nao tentou autenticar com a chave. O literal nao foi encontrado em .next/static, entao nao ha evidencia de exposicao no bundle do navegador.",
        "condition": "Exploravel enquanto a chave estiver ativa e com permissao/quota. Se ja foi revogada, o risco operacional atual cai, mas o repositorio continua contendo material secreto historico.",
        "evidence": [
            ("scripts/test-ai-precos.ts:90-94", "90: test(\"nome de modelo nao aceita chave de API - uma ja foi parar no banco\", () => {\n91:   const chave = \"sk-proj-4Ek...REDACTED\";\n92:   assert.notEqual(validateAiModelName(chave), \"\");\n93:   assert.notEqual(validateAiModelName(\"  sk-abc123  \"), \"\");\n94:   assert.notEqual(validateAiModelName(\"SK-PROJ-MAIUSCULO\"), \"\");"),
            ("Historico Git", "git log -S<valor> -- scripts/test-ai-precos.ts\n311196f custo: o painel para de somar zero pelo que nao tem preco, e chave de API deixa de passar por modelo"),
        ],
    },
]


remediation_status = {
    "F-01": "ABERTO - depende da politica de entrada Google: convite, allowlist ou dominio autorizado.",
    "F-02": "CORRIGIDO NO WORKTREE - recent e quality usam o escopo canonico do ator; prova end-to-end com dois escritorios passou.",
    "F-03": "CORRIGIDO NO WORKTREE - chat valida o auditId antes de memoria/update e deriva o projectId da auditoria autorizada.",
    "F-04": "CORRIGIDO NO WORKTREE - cancelamento, feedback e delta aplicam o mesmo predicado de posse por auditoria.",
    "F-05": "CORRIGIDO NO WORKTREE E NO BANCO DEV - organizationId e obrigatorio, o legado foi migrado para org-prosul e todas as operacoes usam o tenant. Regra de papel e autoria continuam como hardening.",
    "F-06": "CORRIGIDO NO WORKTREE - auditId e ldDraftId sao validados contra o mesmo projectId antes da criacao; prova cruzada passou.",
    "F-07": "PARCIAL - literal removido e scanner local adicionado; revogacao e limpeza do historico remoto continuam pendentes.",
}


strengths = [
    ("Cobertura de autenticacao", "Foram enumerados 54 arquivos de rota e 74 handlers. A prova automatizada reconheceu portao em todos; apenas /api/auth/[...nextauth] e /api/saude sao excecoes publicas intencionais."),
    ("Admin no servidor", "Todos os oito arquivos sob app/api/admin usam checkAdminRequest. O gate exige sessao de administrador de plataforma e Bearer NEXODOC_ADMIN_TOKEN; a pagina tambem redireciona nao-admins."),
    ("Projetos e sub-recursos", "A listagem usa organizationId derivado do ator. assertProjectAccess exige membership ACTIVE e e chamado antes das consultas de documentos, uploads, artefatos e volume."),
    ("Conversas do Nexo", "GET e DELETE por ID filtram simultaneamente id e userEmail; o PUT recusa colisao de UUID pertencente a outro usuario."),
    ("Leitura principal de uma auditoria", "GET /api/audits/[id] usa project.organizationId e conserva legado somente para userId do proprio ator, evitando casar null com null."),
    ("Permissoes espelhadas", "Os gates de interface para /admin correspondem ao gate servidor. Convite de membro e criacao manual de projeto tambem verificam orgRole/isPlatformAdmin no backend."),
    ("XSS", "Nao ha dangerouslySetInnerHTML, innerHTML, eval, new Function ou parser Markdown/HTML em codigo de producao. React faz escape de texto. E-mails aplicam escaping explicito em campos dinamicos."),
    ("Segredos e deploy", ".env.local esta ignorado; variaveis secretas em .env.example e render.yaml nao possuem valor hardcoded; migracao de producao falha se DATABASE_URL faltar; a chave encontrada nao aparece em .next/static."),
    ("Dev auth", "O provider de credenciais exige NODE_ENV diferente de production e NEXODOC_DEV_AUTH=true; render.yaml fixa a flag como false."),
    ("Escopo central de auditoria", "lib/audit-access.ts concentra organizacao e legado por userId. A prova com dois escritorios cobre historico, qualidade, feedback, cancelamento, delta e chat."),
]


coverage_rows = [
    ("app/api/admin/* (8 arquivos, 14 handlers)", "Correto", "checkAdminRequest em todas as rotas; sessao admin + token."),
    ("app/api/projects/route.ts", "Correto", "GET filtra organizationId; POST exige coordenacao e ignora organizationId do corpo."),
    ("app/api/projects/[id]/route.ts", "Correto", "GET/PATCH/DELETE validam membership ACTIVE antes de operar."),
    ("app/api/projects/[id]/documents/route.ts", "Correto", "GET/POST chamam assertProjectAccess."),
    ("app/api/projects/[id]/uploads/route.ts", "Correto", "GET/POST chamam assertProjectAccess."),
    ("app/api/projects/[id]/artifacts/route.ts", "Corrigido P2", "Projeto e validado; auditId/ldDraftId tambem precisam pertencer ao mesmo projectId."),
    ("app/api/audits/[id]/route.ts", "Correto", "Escopo por organizacao; legado por userId do ator."),
    ("app/api/audits/[id]/atribuir + avisar", "Correto", "Helpers validam audit.project.organizationId e destinatario do mesmo tenant."),
    ("app/api/audit/[id]/cancel/route.ts", "Corrigido P1", "Update combina id/status com auditByIdWhereForActor."),
    ("app/api/audits/[id]/feedback/route.ts", "Corrigido P1", "GET/POST exigem auditoria no escopo; nomes tambem ficam no escritorio."),
    ("app/api/audit/delta/route.ts", "Corrigido P1", "Auditoria anterior usa auditByIdWhereForActor."),
    ("app/api/audit/chat/route.ts", "Corrigido P1", "Memoria e update so ocorrem apos posse; projectId e derivado no servidor."),
    ("app/api/audits/recent + quality", "Corrigido P1", "Consultas usam auditWhereForActor; qualidade filtra pela relacao Audit."),
    ("app/api/audit/route.ts", "Correto", "Exige ator, projectId e assertProjectAccess; base anterior limitada ao mesmo projectId."),
    ("app/api/nexo/conversas + [id]", "Correto", "Lista e operacoes por ID amarradas ao e-mail da sessao."),
    ("app/api/nexo/usage/route.ts", "Correto", "conversationId combinado com userEmail."),
    ("app/api/organizacao/membros/route.ts", "Correto", "GET escopado; POST exige coordenacao e usa organizationId do ator."),
    ("app/api/learnings + [id]", "Corrigido P2", "organizationId do ator acompanha GET/POST/PATCH/DELETE e todas as consultas ao storage."),
    ("app/api/volume/* (5 arquivos)", "Correto", "Portao presente; persistencia por projeto chama assertProjectAccess."),
    ("app/api/nexo/* restante, capas, LD, painel, trabalho", "Correto", "Sem lookup de objeto arbitrario ou consultas escopadas por ator/helper."),
    ("app/api/auth/[...nextauth] + app/api/saude", "Excecao", "Entrada do Auth.js e health check publicos por desenho."),
]


issues = [
    """--- ISSUE 1 ---
Titulo: [Seguranca] Remover ingresso automatico de qualquer conta Google no escritorio padrao
Labels sugeridas: security, critica

Descricao do problema e por que e exploravel
O login Google nao possui allowlist de dominio/e-mail e, no primeiro acesso, `getUserAccess` chama `garantirEscritorioPadrao`. Quando `NEXODOC_ESCRITORIO_PADRAO` esta ausente, `escritorioPadrao()` retorna `org-prosul` e o sistema cria um `OrganizationMember` com `role: MEMBER` e `status: ACTIVE`. O `render.yaml` atual nao declara a variavel, portanto o comportamento padrao esta ativo no deploy descrito pelo repositorio. Uma conta Google externa passa a ser membro e recebe o mesmo acesso por organizacao concedido a colaboradores.

Evidencia
- `auth.ts:11-36`: provider Google sem allowlist de conta ou dominio.
- `lib/access-control.ts:121-122`: todo login chama `garantirEscritorioPadrao`.
- `lib/access-control.ts:255-264`: cria o vinculo `MEMBER/ACTIVE`.
- `lib/access-control.ts:274-279`: variavel ausente retorna `org-prosul`.

Impacto
Leitura e uso indevidos dos projetos, auditorias, documentos derivados e funcoes de IA da organizacao; possibilidade de combinar o acesso com os IDORs descritos nas outras issues.

Sugestao de correcao
Fazer o padrao ser fechado: variavel ausente deve significar "sem autoingresso". Exigir convite pendente ou allowlist corporativa antes de criar membership. Declarar explicitamente `NEXODOC_ESCRITORIO_PADRAO=` no deploy enquanto a migracao nao for publicada. Considerar restringir o provider Google por dominio verificado, sem usar `hd` apenas como prova de autorizacao.

Critérios de aceite
- [ ] Conta Google sem convite recebe 403 e nenhum OrganizationMember e criado.
- [ ] Convite pendente vira ACTIVE no primeiro login e preserva o papel escolhido.
- [ ] Conta DISABLED nao e reativada por novo login.
- [ ] Ausencia e string vazia de NEXODOC_ESCRITORIO_PADRAO resultam em modo fechado.
- [ ] Teste de integracao cobre conta externa, convidada e desativada.
- [ ] Deploy de producao declara explicitamente a politica adotada.
--- FIM ISSUE 1 ---""",
    """--- ISSUE 2 ---
Titulo: [Seguranca] Escopar historico recente e metricas de qualidade pela organizacao do ator
Labels sugeridas: security, alta

Descricao do problema e por que e exploravel
`GET /api/audits/recent` autentica o ator, mas executa `audit.findMany` sem `where` de organizacao e devolve IDs, `result`, `report` e nomes de arquivos de toda a base. `GET /api/audits/quality` faz `groupBy` global de feedback. Em producao os endpoints dependem de `NEXODOC_ENABLE_PUBLIC_AUDIT_HISTORY=true`; em ambientes nao-production ficam ativos automaticamente. Com duas organizacoes, um membro de uma ve dados da outra.

Evidencia
- `app/api/audits/recent/route.ts:10-14,58-85`: feature flag e consulta sem filtro de tenant.
- `app/api/audits/quality/route.ts:31-34`: agregacao global.

Impacto
Exposicao de pareceres completos, resultados, nomes de arquivo e IDs de auditoria; mistura de indicadores de qualidade entre clientes.

Sugestao de correcao
Capturar o retorno de `requireActor()` e aplicar `where: { project: { organizationId: actor.organizationId } }`. Tratar auditorias legadas sem projeto apenas pelo `userId` do ator, reproduzindo a regra de `GET /api/audits/[id]`. Nas metricas, filtrar via relacao `audit.project.organizationId` antes de agrupar.

Critérios de aceite
- [ ] Membro da organizacao A nao recebe auditorias da organizacao B.
- [ ] IDs, reports, results e nomes de arquivo de B nunca aparecem na resposta de A.
- [ ] Qualidade de A nao inclui feedback de B.
- [ ] Legado sem projeto so aparece ao proprio autor.
- [ ] Testes cobrem duas organizacoes e a feature flag ligada.
--- FIM ISSUE 2 ---""",
    """--- ISSUE 3 ---
Titulo: [Seguranca] Validar posse da auditoria antes de carregar memoria ou gravar achados no chat
Labels sugeridas: security, alta

Descricao do problema e por que e exploravel
`POST /api/audit/chat` exige apenas um membro ativo. O `auditId` vem do corpo e `carregarMemoriaDoDocumento` consulta `AuditText` somente por esse ID. O modelo pode responder perguntas sobre o texto integral. Ao registrar um achado, a rota atualiza `Audit` pelo mesmo ID sem organizacao. O `projectId` usado pelo historico tambem vem do cliente. Quem conhece um ID alheio pode exfiltrar o memorial por linguagem natural e modificar o parecer persistido.

Evidencia
- `app/api/audit/chat/route.ts:114-125`: update por `id` apenas.
- `app/api/audit/chat/route.ts:131-141,168-183`: ator autenticado, ID do corpo e carga de memoria.
- `app/api/audit/chat/route.ts:198-213`: projectId do corpo e gravacao pelo auditId.
- `lib/memoria-do-documento.ts:104-113`: consulta de texto apenas por auditId.

Impacto
Confidencialidade do texto integral de documentos e integridade do parecer/contagem de achados de outra organizacao.

Sugestao de correcao
Resolver a auditoria uma unica vez por `id + organizationId` (ou legado por userId) antes de iniciar SSE. Derivar projectId do registro autorizado, nunca do corpo. Passar um objeto de escopo/autorizacao aos helpers e incluir `project.organizationId` nos updates, preferencialmente em transacao.

Critérios de aceite
- [ ] AuditId de outra organizacao retorna 404 antes de chamar IA.
- [ ] Nenhum AuditText alheio e carregado.
- [ ] projectId do historico vem da auditoria autorizada.
- [ ] Update do parecer inclui o mesmo predicado de acesso.
- [ ] Teste prova leitura e escrita negadas entre duas organizacoes.
--- FIM ISSUE 3 ---""",
    """--- ISSUE 4 ---
Titulo: [Seguranca] Centralizar autorizacao por auditId nos endpoints auxiliares
Labels sugeridas: security, alta

Descricao do problema e por que e exploravel
Cancelamento, feedback e delta autenticam o usuario, mas operam por `auditId` sem verificar `project.organizationId` ou o dono legado. Um membro com um ID alheio pode cancelar uma auditoria em processamento; quando o historico publico esta habilitado, pode ler e sobrescrever feedback; e pode consultar metadados/impressao usados pelo delta.

Evidencia
- `app/api/audit/[id]/cancel/route.ts:58-64`: update por id/status.
- `app/api/audits/[id]/feedback/route.ts:68-71,234-237,274-308`: leitura e upsert por auditId.
- `app/api/audit/delta/route.ts:63-65`: busca da base por ID apenas.

Impacto
Negacao de servico direcionada, adulteracao de vereditos/notas/resolucao e leitura de metadados de auditorias alheias.

Sugestao de correcao
Criar um helper unico `findAuthorizedAudit(actor, id)` com a mesma regra de `GET /api/audits/[id]`. Usar o ID retornado pelo helper em todas as queries e, para escrita concorrente, repetir o predicado de organizacao no `updateMany`/transacao.

Critérios de aceite
- [ ] Cancelamento alheio retorna 404 e nao muda status.
- [ ] GET/POST de feedback alheio retornam 404 e nao criam linha.
- [ ] Delta alheio retorna resposta indistinguivel de ID inexistente.
- [ ] Legado sem projeto continua acessivel somente ao proprio autor.
- [ ] Testes cobrem PROCESSING, COMPLETED e feature flag de feedback.
--- FIM ISSUE 4 ---""",
    """--- ISSUE 5 ---
Titulo: [Seguranca] Tornar AuditLearning pertencente a uma organizacao e restringir mutacoes
Labels sugeridas: security, media

Descricao do problema e por que e exploravel
`AuditLearning` e descrito como conhecimento do escritorio, mas nao possui `organizationId`. As rotas descartam o ator depois de autenticar e todas as leituras/escritas sao globais. O conteudo ativo entra no prompt de toda auditoria. Em uma base multi-tenant, um membro pode ler, alterar ou excluir regras de outro escritorio e influenciar resultados de IA.

Evidencia
- `prisma/schema.prisma:698-717`: modelo sem organizationId.
- `app/api/learnings/route.ts:49-63,66-88`: ator nao usado para escopo ou papel.
- `app/api/learnings/[id]/route.ts:49-67,89-105`: PATCH/DELETE por ID global.
- `lib/audit-learnings.ts:205-215,235-246,280-303,337`: consultas e mutacoes globais.

Impacto
Vazamento e destruicao de conhecimento interno; contaminacao de prompts e resultados de auditoria entre organizacoes.

Sugestao de correcao
Adicionar `organizationId` obrigatorio, migrar registros atuais para a organizacao correta e incluir o tenant em todas as chaves/queries. Definir explicitamente quem pode mutar o acervo (por exemplo OWNER/ADMIN) e aplicar o gate no servidor. Registrar autor e trilha de alteracao.

Critérios de aceite
- [ ] AuditLearning possui organizationId com FK e indice.
- [ ] Listagem e prompt recebem apenas aprendizados da organizacao do ator.
- [ ] PATCH/DELETE incluem id + organizationId.
- [ ] Papel sem permissao de configuracao recebe 403 em POST/PATCH/DELETE.
- [ ] Migracao nao perde os aprendizados atuais.
- [ ] Testes cobrem duas organizacoes e tentativa de prompt poisoning cruzado.
--- FIM ISSUE 5 ---""",
    """--- ISSUE 6 ---
Titulo: [Seguranca] Validar auditId e ldDraftId ao registrar artefatos de projeto
Labels sugeridas: security, media

Descricao do problema e por que e exploravel
`POST /api/projects/[id]/artifacts` valida acesso ao projeto do path, mas aceita `auditId` e `ldDraftId` do corpo e grava as FKs diretamente. Nao ha prova de que essas entidades pertencem ao mesmo projeto/organizacao. Com um ID valido alheio, o usuario cria uma relacao cruzada e pode usar o sucesso/erro de FK como oraculo de existencia.

Evidencia
- `app/api/projects/[id]/artifacts/route.ts:167-190`: acesso somente ao projectId; IDs relacionados saem do payload.
- `lib/project-store.ts:231-248`: FKs gravadas sem validacao adicional.

Impacto
Corrupcao da trilha de documentos e auditorias, relacoes cruzadas entre tenants e confirmacao de existencia de IDs.

Sugestao de correcao
Quando auditId/ldDraftId forem informados, buscar os objetos com `projectId: id` e com o tenant do ator antes do create. Rejeitar combinacoes sem projeto ou inconsistentes com 400/404 uniforme. Se a API nao precisa aceitar essas relacoes do cliente, removê-las do payload e deriva-las no servidor.

Critérios de aceite
- [ ] auditId de outro projeto/tenant e recusado sem criar artefato.
- [ ] ldDraftId de outro projeto/tenant e recusado sem criar artefato.
- [ ] IDs inexistentes e alheios produzem resposta indistinguivel.
- [ ] IDs do mesmo projeto continuam funcionando.
- [ ] Testes verificam ausencia de relacoes cruzadas no banco.
--- FIM ISSUE 6 ---""",
    """--- ISSUE 7 ---
Titulo: [Seguranca] Revogar e remover chave OpenAI copiada para teste e historico Git
Labels sugeridas: security, alta

Descricao do problema e por que e exploravel
`scripts/test-ai-precos.ts` contem um literal `sk-proj-...` com aparencia de chave real; o proprio teste registra que uma chave ja foi parar no banco. O valor entrou no commit `311196f` e permanece no HEAD. Mesmo que o arquivo seja corrigido, clones e forks mantem o segredo no historico. A auditoria nao tentou usar a credencial e nao a encontrou no bundle `.next/static`.

Evidencia
- `scripts/test-ai-precos.ts:90-94`: literal hardcoded (redigido no relatorio como `sk-proj-4Ek...REDACTED`).
- `git log -S<valor> -- scripts/test-ai-precos.ts`: commit introdutor `311196f`.

Impacto
Uso indevido de API, consumo de quota/custo e acesso ao projeto associado conforme as permissoes da chave.

Sugestao de correcao
Revogar/rotacionar a chave no provedor imediatamente; substituir o teste por uma string obviamente ficticia; investigar uso e cobranca desde 13/08/2026. Reescrever o historico com `git filter-repo` ou ferramenta equivalente e coordenar force-push/reclone. Adicionar secret scanning no CI e protecao de push.

Critérios de aceite
- [ ] Chave antiga consta como revogada no provedor.
- [ ] Logs de uso e cobranca foram revisados e incidentes documentados.
- [ ] Nenhum `sk-proj-` real existe no HEAD nem no historico remoto oficial.
- [ ] Teste usa apenas placeholder inequivocamente falso.
- [ ] Scanner de segredos bloqueia novo commit com chave valida.
- [ ] Colaboradores foram orientados a reclonar apos a limpeza do historico.
--- FIM ISSUE 7 ---""",
]


def build_story():
    story = []

    # Capa
    story += [Spacer(1, 2.4 * cm), p("AUDITORIA TECNICA INDEPENDENTE", "cover_kicker")]
    story.append(p("Relatorio de Auditoria de Seguranca - NexoDoc", "cover_title"))
    story.append(HRFlowable(width="100%", thickness=2.2, color=STRONG, spaceBefore=4, spaceAfter=18))
    cover_meta = [
        [p("Data", "table_bold"), p("31 de agosto de 2026", "table")],
        [p("Snapshot", "table_bold"), p("Auditoria original + atualizacoes P1/P2 no worktree; HEAD c440424; 884 commits consultados", "table")],
        [p("Escopo", "table_bold"), p("Next.js, 54 arquivos de rota/74 handlers, Prisma/PostgreSQL, Auth.js, frontend React, Docker/Render, scripts, documentacao, historico Git e bundle .next/static", "table")],
        [p("Fora do escopo", "table_bold"), p("Teste de invasao em producao, validacao online da chave encontrada e revisao de dependencias/CVEs", "table")],
    ]
    story.append(Table(cover_meta, colWidths=[3.1 * cm, 12.8 * cm], style=TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("BACKGROUND", (0, 0), (0, -1), PAPER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ])))
    story.append(Spacer(1, 18))
    story.append(p("Nota metodologica", "h2"))
    story.append(p("A categoria 'banco sem tranca' foi mapeada para o mecanismo real do NexoDoc: membership em OrganizationMember e filtros Prisma por Project.organizationId. 'Permissao no navegador' foi verificada cruzando gates isAdmin/orgRole com cada endpoint correspondente. IDOR cobriu todos os handlers e IDs em path, query e body. Segredos cobriram HEAD, configuracoes de deploy, historico Git e bundle do cliente. XSS cobriu sinks React/DOM, Markdown/HTML, URLs e HTML de e-mail."))
    story.append(p("Este documento preserva os sete achados do snapshot original e registra separadamente o estado de remediacao P1/P2. Condicoes como feature flag, janela de status ou chave ainda ativa aparecem explicitamente em cada achado.", "callout"))
    story.append(PageBreak())

    # Stack
    story.append(p("1. Stack detectada e modelo de seguranca", "h1"))
    stack_data = [
        [p("Camada", "table_bold"), p("Tecnologia detectada", "table_bold"), p("Como a auditoria adaptou a categoria", "table_bold")],
        [p("Linguagem", "table_bold"), p("TypeScript/JavaScript; Node.js 22", "table"), p("Analise de handlers App Router, helpers server-side e scripts", "table")],
        [p("Framework", "table_bold"), p("Next.js 16.2.6 + React 19.2.6", "table"), p("Rotas em app/api/**/route.ts; SSR e componentes client", "table")],
        [p("ORM/banco", "table_bold"), p("Prisma 7.8 + PostgreSQL via pg/PrismaPg", "table"), p("Sem RLS; isolamento manual por OrganizationMember e Project.organizationId", "table")],
        [p("Auth", "table_bold"), p("Auth.js/NextAuth beta 31; Google OAuth; Credentials apenas em dev", "table"), p("requireActor para tenant; requirePlatformAdmin + token para admin", "table")],
        [p("Frontend", "table_bold"), p("React, Tailwind CSS 4, App Router", "table"), p("Gates isAdmin/orgRole e sinks DOM/URL/Markdown", "table")],
        [p("Deploy", "table_bold"), p("Docker multi-stage e Render Blueprint; conversor Docker legado", "table"), p("Segredos em env sync:false, startup/migrations e imagem final", "table")],
        [p("Ausente", "table_bold"), p("Sem GitHub Actions, Helm, Terraform ou docker-compose no repositorio", "table"), p("Categorias explicitamente marcadas como nao aplicaveis", "table")],
    ]
    story.append(Table(stack_data, repeatRows=1, colWidths=[2.6 * cm, 5.1 * cm, 8.2 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    story.append(Spacer(1, 10))
    story.append(p("Mecanismo de isolamento identificado", "h2"))
    story.append(p("O NexoDoc nao usa Supabase/RLS. A autorizacao e feita no servidor: requireActor resolve a sessao, a conta ativa e um OrganizationMember ACTIVE; o actor recebe organizationId. Queries corretas usam esse ID diretamente, assertProjectAccess ou auditWhereForActor/auditByIdWhereForActor. O P2 tambem tornou organizationId obrigatorio em AuditLearning. F-01 continua aberto; F-02 e F-05 foram corrigidos."))
    story.append(PageBreak())

    # Executive summary
    story.append(p("2. Resumo executivo", "h1"))
    story.append(p("Foram confirmados 7 achados no snapshot original: 1 critico, 4 altos e 2 medios. As atualizacoes P1/P2 fecharam F-02 a F-06; a migracao de F-05 foi aplicada e provada no banco de desenvolvimento. F-07 foi mitigado no HEAD, mas depende de revogacao e limpeza do historico remoto. Permanece aberto F-01."))
    story.append(Table([[donut_chart(), category_chart()]], colWidths=[7.6 * cm, 8.3 * cm], style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    story.append(Spacer(1, 8))
    metrics = [
        [p("CRITICA", "table_bold"), p("1", "table_bold"), p("Entrada externa no tenant padrao", "table")],
        [p("ALTA", "table_bold"), p("4", "table_bold"), p("Historico global, chat/IDOR, endpoints auxiliares e chave", "table")],
        [p("MEDIA", "table_bold"), p("2", "table_bold"), p("Learnings globais e relacoes de artefato", "table")],
        [p("BAIXA", "table_bold"), p("0", "table_bold"), p("Nenhum achado verificado", "table")],
    ]
    story.append(Table(metrics, colWidths=[2.5 * cm, 1.2 * cm, 12.2 * cm], style=TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])))
    story.append(p("Pontos fracos centrais", "h2"))
    story.append(p("1) o cadastro automatico ainda transforma autenticacao Google em autorizacao ao tenant; 2) o incidente da chave exige revogacao e saneamento do historico fora deste worktree; 3) os aprendizados ja estao isolados, mas regra de papel e autoria permanecem como hardening de governanca."))
    story.append(p("Pontos fortes centrais", "h2"))
    story.append(Spacer(1, 4))
    story.append(p("A aplicacao tem blocos reutilizaveis: requireActor, assertProjectAccess, checkAdminRequest, auditWhereForActor/auditByIdWhereForActor e InvalidArtifactRelation. P1/P2 adicionaram provas cruzadas para auditorias, aprendizados e artefatos, alem da varredura local contra segredos hardcoded."))
    story.append(Spacer(1, 8))
    story.append(p("Estado de remediacao", "h2"))
    remediation_rows = [[p("Achado", "table_bold"), p("Estado atual", "table_bold")]]
    for fid in ["F-01", "F-02", "F-03", "F-04", "F-05", "F-06", "F-07"]:
        remediation_rows.append([p(fid, "table_bold"), p(remediation_status[fid], "table")])
    story.append(Table(remediation_rows, repeatRows=1, colWidths=[1.7 * cm, 14.2 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])))
    story.append(PageBreak())

    # Findings overview table
    story.append(p("3. Tabela consolidada de achados", "h1"))
    rows = [[p("ID", "table_bold"), p("Severidade", "table_bold"), p("Categoria", "table_bold"), p("Arquivo:linha", "table_bold"), p("Descricao", "table_bold")]]
    file_refs = {
        "F-01": "auth.ts:11-36; lib/access-control.ts:121-122,255-264,274-279",
        "F-02": "app/api/audits/recent/route.ts:10-14,58-85; audits/quality:31-34",
        "F-03": "app/api/audit/chat/route.ts:114-125,131-141,168-183,198-213; memoria:104-113",
        "F-04": "audit/[id]/cancel:58-64; audits/[id]/feedback:68-71,234-308; audit/delta:63-65",
        "F-05": "prisma/schema.prisma:698-717; api/learnings:49-88; audit-learnings.ts:205-337",
        "F-06": "projects/[id]/artifacts:167-190; lib/project-store.ts:231-248",
        "F-07": "scripts/test-ai-precos.ts:90-94; Git 311196f",
    }
    for item in findings:
        rows.append([
            p(item["id"], "table_bold"),
            severity_chip(item["sev"]),
            p(item["cat"], "table"),
            p(file_refs[item["id"]], "table"),
            p(item["title"], "table"),
        ])
    story.append(Table(rows, repeatRows=1, colWidths=[1.0 * cm, 1.8 * cm, 2.5 * cm, 5.2 * cm, 5.4 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])))
    story.append(Spacer(1, 8))
    story.append(p("Categorias sem achado", "h2"))
    story.append(p("<b>Permissao definida no navegador:</b> nenhum caso confirmado. O gate isAdmin das paginas/atalhos administrativos tem verificacao equivalente no backend. As operacoes de convite e cadastro manual de projeto tambem verificam papel no servidor."))
    story.append(p("<b>Inputs sem tratamento (XSS):</b> nenhum caso confirmado. Nao existe sink DOM/HTML de producao; a aplicacao nao usa biblioteca de sanitizacao porque nao renderiza HTML/Markdown nao confiavel. Os templates de e-mail usam funcoes de escape nos campos dinamicos."))
    story.append(PageBreak())

    # Detailed findings
    story.append(p("4. Achados detalhados", "h1"))
    story.append(p("As evidencias abaixo preservam o codigo observado no snapshot original. O callout de cada cartao informa se a falha foi corrigida, esta parcial ou continua aberta no worktree atual.", "callout"))
    for item in findings:
        story += finding_card(item["id"], item["title"], item["sev"], item["cat"], item["desc"], item["condition"], item["evidence"])

    story.append(PageBreak())
    story.append(p("5. Pontos fortes com evidencia", "h1"))
    strong_rows = [[p("Controle", "table_bold"), p("Evidencia verificada", "table_bold")]]
    for title, desc in strengths:
        strong_rows.append([p(title, "table_bold"), p(desc, "table")])
    story.append(Table(strong_rows, repeatRows=1, colWidths=[4.3 * cm, 11.6 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), STRONG), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1FAF7")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    story.append(Spacer(1, 8))
    story.append(p("Testes executados", "h2"))
    story.append(code("npm run test:security:audits  -> OK, 6 regras + 1.174 arquivos escaneados\nnpm run prova:security:audits -> OK, 12 cenarios entre dois escritorios\nnpm run test:security:p2      -> OK, 5 regressões estruturais\nnpx prisma migrate deploy     -> OK, migration de AuditLearning aplicada\nnpm run prova:security:p2     -> OK, 5 provas reais com banco\nnpx tsc --noEmit              -> OK\nESLint dos arquivos alterados  -> OK"))
    story.append(Spacer(1, 8))
    story.append(p("As provas criam dois escritorios temporarios. O P1 tenta listar, ler/gravar feedback, cancelar, comparar e abrir o chat com auditId estrangeiro. O P2 tenta ler, alterar e excluir aprendizados alheios e relacionar auditorias ou rascunhos de outro projeto; todos os dados de prova sao removidos ao final.", "callout"))

    story.append(PageBreak())
    story.append(p("6. Cobertura sistematica dos handlers", "h1"))
    story.append(p("A tabela resume todos os 54 arquivos de rota. Grupos marcados como corretos foram inspecionados quanto a autenticação, fonte do tenant e IDs de path/query/body. Os detalhes dos grupos com falha remetem aos achados."))
    cov = [[p("Arquivo/grupo", "table_bold"), p("Resultado", "table_bold"), p("Evidencia de cobertura", "table_bold")]]
    for path, result, note in coverage_rows:
        color = STRONG if result == "Correto" or result.startswith("Corrigido") else (MUTED if result == "Excecao" else HIGH)
        cov.append([p(path, "table"), Paragraph(f'<font color="{color.hexval()}"><b>{result}</b></font>', styles["table"]), p(note, "table")])
    story.append(Table(cov, repeatRows=1, colWidths=[6.2 * cm, 2.2 * cm, 7.5 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ])))

    story.append(PageBreak())
    story.append(p("7. Recomendacoes priorizadas", "h1"))
    recommendations = [
        ("P1", "Fechar o autoingresso", "Definir NEXODOC_ESCRITORIO_PADRAO vazio no deploy e alterar o default do codigo para convite/allowlist."),
        ("P1 feito", "Centralizar acesso a auditoria", "Helper criado e aplicado no chat, cancelamento, feedback, delta, leitura individual e updates."),
        ("P1 parcial", "Rotacionar a chave", "Fixture e HEAD corrigidos; ainda revogar no provedor, revisar uso/custo e limpar o historico Git coordenadamente."),
        ("P1 feito", "Escopar consultas globais", "recent/quality usam o ator; prova com duas organizacoes passou."),
        ("P2 feito", "Tenant em AuditLearning", "organizationId obrigatorio, legado migrado para org-prosul e consultas/mutacoes isoladas por escritorio."),
        ("P2 feito", "Validar relacoes de artefato", "auditId/ldDraftId precisam pertencer ao mesmo projectId; combinacoes cruzadas sao recusadas."),
        ("P2 hardening", "Governanca dos aprendizados", "Definir quem pode mutar o acervo por papel e registrar autor/trilha de alteracao."),
        ("P2", "Testes de matriz", "Para cada rota com ID, testar: mesmo tenant, outro tenant, objeto inexistente, legado e usuario desativado."),
        ("P3", "Automacao preventiva", "Adicionar secret scanning e uma regra estatica que sinalize Prisma por ID em route.ts sem helper de acesso."),
        ("P3", "Revisao de politica", "Documentar capacidades por papel e manter a verificacao no servidor como fonte de verdade."),
    ]
    rec_rows = [[p("Prioridade", "table_bold"), p("Acao", "table_bold"), p("Resultado esperado", "table_bold")]]
    for priority, action, result in recommendations:
        rec_rows.append([p(priority, "table_bold"), p(action, "table_bold"), p(result, "table")])
    story.append(Table(rec_rows, repeatRows=1, colWidths=[1.8 * cm, 4.7 * cm, 9.4 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ])))
    story.append(Spacer(1, 10))
    story.append(p("Ordem sugerida de execucao", "h2"))
    story.append(p("O isolamento de auditorias, aprendizados e artefatos ja foi aplicado e provado. A ordem restante e: fechar a entrada automatica, revogar a chave, revisar uso/custo, coordenar a limpeza do historico Git e definir governanca de mutacao/autoria dos aprendizados."))

    # Issues must be last section
    story.append(PageBreak())
    story.append(p("ISSUES PARA O GITHUB", "h1"))
    story.append(p("Blocos completos em Markdown, prontos para copiar e colar ou registrar a remediacao. Issues 2 a 6 ja estao corrigidas no worktree; a migracao da issue 5 tambem foi aplicada no banco de desenvolvimento. A issue 7 esta parcial e a issue 1 continua aberta. Achados auxiliares relacionados foram agrupados para evitar spam."))
    for idx, issue in enumerate(issues, 1):
        if idx > 1:
            story.append(PageBreak())
        story.append(p(f"Issue {idx}", "h2"))
        story.append(p(safe(issue), "issue"))

    return story


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = AuditDocTemplate(str(OUT_FILE))
    doc.build(build_story())
    print(OUT_FILE)


if __name__ == "__main__":
    main()
