import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { carregarEscritorio } from "@/lib/escritorio-config";
import { marcadoresDoEscritorio } from "@/lib/escritorio";
import { isNexoEnabled } from "@/lib/feature-flags";
import { recordNexoArtifacts } from "@/lib/nexo-artifacts";
import { buildCapaProposal } from "@/server/nexo/build-capa-proposal";
import { generateCovers } from "@/server/nexo/tools/generate-covers";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

export const runtime = "nodejs";

/**
 * Recebe os selos + a prefeitura escolhida, monta a capa da disciplina e gera.
 * Órgão/secretaria/formato de volume vêm do template; obra/fase do selo;
 * código/disciplina/revisão do nome do arquivo. Retorna base64.
 */
export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let selos: SeloForLd[];
  let templateId: string;
  let tituloCapa: string | undefined;
  let volume: string | undefined;
  let numTomos = 1;
  let tomoInicial = 1;
  let tomoNumero = 0;
  let mes: string | undefined;
  let ano: string | undefined;
  /** A identidade do projeto corrigida à mão — vence o carimbo. */
  const identidade: Record<string, string> = {};
  /**
   * Marcadores que o modelo tem e o Nexo não conhece, preenchidos no frame.
   * Chaveados pelo NOME do marcador, sem as chaves.
   */
  const extras: Record<string, string> = {};
  try {
    const body = (await req.json()) as {
      selos?: unknown;
      templateId?: unknown;
      tituloCapa?: unknown;
      volume?: unknown;
      numTomos?: unknown;
      tomoInicial?: unknown;
      tomoNumero?: unknown;
      mes?: unknown;
      ano?: unknown;
    } & Record<string, unknown>;
    if (!Array.isArray(body.selos)) throw new Error("selos ausente");
    if (typeof body.templateId !== "string" || !body.templateId) {
      throw new Error("templateId ausente");
    }
    selos = body.selos as SeloForLd[];
    templateId = body.templateId;
    if (typeof body.tituloCapa === "string" && body.tituloCapa.trim()) {
      tituloCapa = body.tituloCapa.trim();
    }
    if (typeof body.volume === "string" && body.volume.trim()) {
      volume = body.volume.trim();
    }
    if (typeof body.numTomos === "number" && Number.isFinite(body.numTomos)) {
      numTomos = Math.max(1, Math.floor(body.numTomos));
    }
    if (typeof body.tomoInicial === "number" && Number.isFinite(body.tomoInicial)) {
      tomoInicial = Math.max(1, Math.floor(body.tomoInicial));
    }
    if (typeof body.tomoNumero === "number" && Number.isFinite(body.tomoNumero)) {
      tomoNumero = Math.max(0, Math.floor(body.tomoNumero));
    }
    // `bairro` viaja junto da identidade: é um dado da OBRA, e vale para a
    // conversa inteira como a obra e o código valem.
    for (const chave of ["orgao", "secretaria", "obra", "bairro", "fase", "codigo", "revisao"]) {
      const valor = body[chave];
      if (typeof valor === "string" && valor.trim()) identidade[chave] = valor.trim();
    }
    if (typeof body.mes === "string" && body.mes.trim()) mes = body.mes.trim();
    if (typeof body.ano === "string" && body.ano.trim()) ano = body.ano.trim();
    // Só nome de marcador válido entra: o valor vai direto para o XML do
    // documento, e um nome estranho aqui viraria substituição inesperada.
    if (body.extras && typeof body.extras === "object") {
      for (const [nome, valor] of Object.entries(body.extras as Record<string, unknown>)) {
        if (/^[A-Z_][A-Z0-9_]*$/.test(nome) && typeof valor === "string" && valor.trim()) {
          extras[nome] = valor.trim();
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  if (selos.length === 0) {
    return NextResponse.json({ error: "Nenhum selo informado." }, { status: 400 });
  }

  let proposal;
  try {
    proposal = await buildCapaProposal({
      selos,
      templateId,
      tituloCapa,
      volume,
      numTomos,
      tomoInicial,
      tomoNumero,
      mes,
      ano,
      ...identidade,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao montar a capa." },
      { status: 400 },
    );
  }

  /*
   * OS DADOS DO ESCRITÓRIO ALIMENTAM OS MARCADORES DELE — mas por baixo.
   *
   * O modelo que tem `{{CREA}}` ou `{{RESPONSAVEL}}` deixava o engenheiro
   * redigitar o mesmo dado a cada capa. Agora ele vem do que está declarado no
   * admin, e SÓ onde o engenheiro não respondeu: a precedência do produto é
   * engenheiro > agente > carimbo > vazio, e o escritório entra como carimbo —
   * abaixo de quem está olhando a folha. Marcador que o modelo não tem continua
   * sendo ignorado por `server/odt`.
   */
  const doEscritorio = marcadoresDoEscritorio(await carregarEscritorio());
  const extrasFinais = { ...doEscritorio, ...extras };

  const result = await generateCovers({
    generalData: proposal.generalData,
    pages: proposal.pages,
    ...(Object.keys(extrasFinais).length > 0 ? { extras: extrasFinais } : {}),
  });

  /*
   * A capa gerada entra no HISTÓRICO DO SERVIDOR — mesmo passo já dado pela LD.
   * Registramos os três arquivos (ODT, PDF quando o LibreOffice respondeu, ZIP)
   * como a tela /capas registrava, com os fatos que identificam o documento:
   * sem eles a linha no banco não diz de que obra ou de que tomo é a capa.
   */
  await recordNexoArtifacts({
    user: { email: session.user.email, name: session.user.name },
    module: "capas",
    metadata: {
      templateId: proposal.generalData.templateId,
      prefeitura: proposal.resumo.prefeitura,
      obra: proposal.generalData.nomeObra,
      disciplina: proposal.resumo.disciplina,
      codigo: proposal.resumo.codigo,
      revisao: proposal.generalData.revisao,
      volume: proposal.resumo.volume,
      tomos: proposal.resumo.tomos,
      pageCount: proposal.pages.length,
      pdfGerado: Boolean(result.pdf),
    },
    files: [
      {
        kind: "COVER_ODT",
        fileName: result.odt.name,
        mimeType: "application/vnd.oasis.opendocument.text",
        data: result.odt.buffer,
      },
      ...(result.pdf
        ? [
            {
              kind: "COVER_PDF" as const,
              fileName: result.pdf.name,
              mimeType: "application/pdf",
              data: result.pdf.buffer,
            },
          ]
        : []),
      {
        kind: "COVER_ZIP",
        fileName: result.zip.name,
        mimeType: "application/zip",
        data: result.zip.buffer,
      },
    ],
  });

  return NextResponse.json({
    resumo: proposal.resumo,
    pdfError: result.pdfError,
    files: {
      odt: { name: result.odt.name, data: result.odt.buffer.toString("base64") },
      pdf: result.pdf
        ? { name: result.pdf.name, data: result.pdf.buffer.toString("base64") }
        : null,
      zip: { name: result.zip.name, data: result.zip.buffer.toString("base64") },
    },
  });
}
