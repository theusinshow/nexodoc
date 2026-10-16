/**
 * O MODELO DE CAPA DO PROJETO (16/10/2026).
 * Desenho: docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 *
 *   GET  ?projeto=<id>                 → { modelo: FichaDoModelo | null }
 *   POST ?projeto=<id>  arquivo(.odt)  → { proposta, paginasOriginais }   (NÃO grava)
 *   PUT  ?projeto=<id>  arquivo + proposta(JSON)
 *                                      → { modelo, templateId } | 422 transborda
 *
 * A leitura é regra primeiro e IA só no que sobrou. Nada é gravado antes de o
 * engenheiro confirmar no card — por isso o PUT recebe o ODT de novo, e não um
 * rascunho guardado: rascunho órfão no cofre é lixo que ninguém expurga.
 */
import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { verificarTetoMensal } from "@/lib/ai-budget";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { isNexoEnabled } from "@/lib/feature-flags";
import {
  fichaDoModeloDeCapa,
  guardarModeloDeCapa,
  idDoModeloDoProjeto,
  type ConfigDoModeloDoProjeto,
} from "@/server/modelo-capa";
import { classificarComIa } from "@/server/nexo/modelo-capa/ia";
import { injetarMarcadores } from "@/server/nexo/modelo-capa/injetar";
import { lerParagrafos } from "@/server/nexo/modelo-capa/paragrafos";
import { aplicarRespostas, classificarPorRegras, pendentes } from "@/server/nexo/modelo-capa/regras";
import type { PropostaDeModelo } from "@/server/nexo/modelo-capa/tipos";
import { generateOdtBuffer } from "@/server/odt";
import { desembrulharCamposDeUsuario } from "@/server/odt/marcadores";
import { semPaginasEmBranco } from "@/server/nexo/tools/pagina-em-branco";
import { convertOdtToPdf } from "@/server/pdf";
import { projetoDoEscritorio } from "@/server/pranchas";
import { getTemplateRegistry } from "@/server/templates/registry";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const TETO_DO_ODT = 15 * 1024 * 1024;
const ODT_MIME = "application/vnd.oasis.opendocument.text";

function erro(status: number, mensagem: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: mensagem, ...extra }, { status });
}

/** O projeto pedido, já conferido. `null` vira 404 em quem chama. */
async function projetoConferido(req: NextRequest, organizationId: string): Promise<string | null> {
  const projeto = req.nextUrl.searchParams.get("projeto")?.trim() ?? "";
  if (!ID.test(projeto)) return null;
  return (await projetoDoEscritorio(projeto, organizationId)) ? projeto : null;
}

async function comPortao(fn: () => Promise<Response>): Promise<Response> {
  if (!isNexoEnabled()) return erro(404, "Modulo Nexo desativado.");
  try {
    if (!isDatabaseConfigured()) return erro(503, "Banco não configurado.");
    return await fn();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

/** O ODT do formulário, conferido: é zip, tem content.xml, cabe no teto. */
async function odtDoFormulario(
  form: FormData,
): Promise<{ nome: string; bytes: Buffer; contentXml: string } | string> {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return "Faltou o arquivo.";
  if (!/\.odt$/i.test(arquivo.name)) return "O modelo precisa ser .odt.";
  if (arquivo.size > TETO_DO_ODT) return "O ODT passa de 15 MB.";
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  try {
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("content.xml")?.async("string");
    if (!xml) return "O arquivo não é um ODT válido (falta content.xml).";
    return { nome: arquivo.name, bytes, contentXml: desembrulharCamposDeUsuario(xml) };
  } catch {
    return "O arquivo não abriu como ODT.";
  }
}

/**
 * Páginas do PDF que o LibreOffice devolveu. `null` = sem conversor, não deu
 * para medir. Conta DEPOIS de tirar as páginas em branco, como a capa de
 * verdade sai (`generate-covers.ts`): sem isso, o modelo oficial de Chapecó —
 * cuja obra de 4 linhas empurra só um parágrafo vazio para a 2ª página — era
 * recusado por um transbordo que nunca chega ao volume.
 */
async function paginasDoOdt(odt: Buffer): Promise<number | null> {
  const { pdfBuffer } = await convertOdtToPdf(odt);
  if (!pdfBuffer) return null;
  const limpo = (await semPaginasEmBranco(pdfBuffer).catch(() => ({ buffer: pdfBuffer }))).buffer;
  return PDFDocument.load(limpo, { ignoreEncryption: true, updateMetadata: false })
    .then((d) => d.getPageCount())
    .catch(() => null);
}

/**
 * O contexto das regras: a obra (a que a conversa mandou, ou a do projeto) e
 * os órgãos/secretarias das prefeituras configuradas.
 */
async function contextoDasRegras(projectId: string, form: FormData) {
  const projeto = await getPrisma().project.findUnique({
    where: { id: projectId },
    select: { name: true, identidade: true },
  });
  const campos = ((projeto?.identidade ?? {}) as { campos?: Record<string, { valor?: string }> }).campos ?? {};
  const doForm = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const registry = await getTemplateRegistry();
  return {
    obra: doForm("obra") ?? campos.obra?.valor ?? projeto?.name ?? undefined,
    bairro: doForm("bairro") ?? campos.bairro?.valor ?? undefined,
    orgaos: registry.map((t) => t.defaults.orgao).filter(Boolean),
    secretarias: registry.map((t) => t.defaults.secretaria).filter(Boolean),
  };
}

export async function GET(req: NextRequest) {
  return comPortao(async () => {
    const actor = await requireActor();
    const projeto = await projetoConferido(req, actor.organizationId);
    if (!projeto) return erro(404, "Projeto não encontrado.");
    return NextResponse.json({ modelo: await fichaDoModeloDeCapa(projeto) });
  });
}

export async function POST(req: NextRequest) {
  return comPortao(async () => {
    const actor = await requireActor();
    const projeto = await projetoConferido(req, actor.organizationId);
    if (!projeto) return erro(404, "Projeto não encontrado.");
    const form = await req.formData();
    const odt = await odtDoFormulario(form);
    if (typeof odt === "string") return erro(400, odt);

    let proposta = classificarPorRegras(lerParagrafos(odt.contentXml), await contextoDasRegras(projeto, form));
    const faltam = pendentes(proposta);
    if (faltam.length > 0) {
      /*
       * TETO ESTOURADO NÃO TRAVA: o que sobrou vira "texto fixo" e o engenheiro
       * corrige no card. Uma capa lida pela metade é melhor do que nenhuma, e a
       * conta de IA aqui é de milésimos de dólar.
       */
      const teto = await verificarTetoMensal({ userId: actor.userId, userEmail: actor.email });
      if (!teto.estourou) {
        const respostas = await classificarComIa({
          pendentes: faltam,
          capaInteira: proposta.paragrafos,
          userEmail: actor.email,
          projectId: projeto,
        }).catch((err) => {
          console.warn("[modelo-capa] IA indisponível; o que sobrou fica como texto fixo:", err);
          return [];
        });
        proposta = aplicarRespostas(proposta, respostas, "ia");
      }
      // Nada fica sem dono no card: o que ninguém respondeu é texto fixo.
      proposta = aplicarRespostas(
        proposta,
        pendentes(proposta).map((p) => ({ indice: p.indice, campo: "FIXO" as const })),
        "ia",
      );
    }

    return NextResponse.json({ proposta, paginasOriginais: await paginasDoOdt(odt.bytes) });
  });
}

export async function PUT(req: NextRequest) {
  return comPortao(async () => {
    const actor = await requireActor();
    const projeto = await projetoConferido(req, actor.organizationId);
    if (!projeto) return erro(404, "Projeto não encontrado.");
    const form = await req.formData();
    const odt = await odtDoFormulario(form);
    if (typeof odt === "string") return erro(400, odt);

    let proposta: PropostaDeModelo;
    try {
      proposta = JSON.parse(String(form.get("proposta") ?? "")) as PropostaDeModelo;
      if (!Array.isArray(proposta.paragrafos)) throw new Error("sem parágrafos");
    } catch {
      return erro(400, "Proposta inválida.");
    }

    // 1. Os marcadores entram no content.xml; o resto do ODT fica como veio.
    const zip = await JSZip.loadAsync(odt.bytes);
    zip.file("content.xml", injetarMarcadores(odt.contentXml, proposta));
    zip.file("mimetype", ODT_MIME, { compression: "STORE" });
    const modelo = Buffer.from(
      await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: ODT_MIME }),
    );

    const campos = [
      ...new Set(
        proposta.paragrafos.flatMap((p) => (p.trechos ?? []).map((t) => t.campo)).filter((c) => c !== "FIXO"),
      ),
    ];
    /** Os textos que a capa anexada tinha em cada campo, na ordem — um por parágrafo. */
    const textosDe = (campo: string) =>
      proposta.paragrafos.flatMap((p) => (p.trechos ?? []).filter((t) => t.campo === campo).map((t) => t.texto.trim()));
    const textoDe = (campo: string) => textosDe(campo).join(" ");
    const [mes = "", ano = ""] = textoDe("MES_ANO").split("/");

    /*
     * 2. O ENSAIO: a capa anexada REGERADA pelo modelo injetado, com os textos
     * dela mesma. Se isso passar das páginas que o ODT original tinha, a
     * injeção quebrou o layout (um estilo perdido, um span que encolhia a
     * fonte) e o modelo é recusado.
     *
     * Não com dados exagerados: obra de 4 linhas transborda até o modelo
     * OFICIAL de Chapecó, e recusar tudo não protege ninguém. O transbordo com
     * dados reais é avisado a cada capa gerada (`paginasAMais`).
     */
    const original = await paginasDoOdt(odt.bytes);
    const ensaio = await generateOdtBuffer({
      templateId: idDoModeloDoProjeto(projeto),
      templateBytes: modelo,
      generalData: {
        templateId: idDoModeloDoProjeto(projeto),
        orgao: textoDe("ORGAO"),
        secretaria: textoDe("SECRETARIA"),
        nomeObra: textosDe("NOME_OBRA").join("\n"),
        bairro: textoDe("BAIRRO"),
        fase: textoDe("FASE"),
        mes: mes.trim(),
        ano: ano.trim(),
        codigoInterno: textoDe("CODIGO_EXIBIDO"),
        codigoExibido: textoDe("CODIGO_EXIBIDO"),
        siglaArquivo: "",
        revisao: "a",
      },
      pages: [
        {
          id: "ensaio",
          groupId: "ensaio",
          tituloCapa: textosDe("TITULO_CAPA").join("\n"),
          disciplina: textoDe("DISCIPLINA"),
          tomo: textoDe("TOMO"),
          volume: textoDe("VOLUME"),
          pageNumber: 1,
        },
      ],
    });
    const doEnsaio = await paginasDoOdt(ensaio);
    if (original !== null && doEnsaio !== null && doEnsaio > original) {
      return erro(
        422,
        `Regerada por este modelo, a própria capa passa para a ${doEnsaio}ª página — ` +
          "alguma linha perdeu o estilo ao virar campo. Troque essa linha para texto fixo, ou ajuste o ODT e anexe de novo.",
        { motivo: "transborda" },
      );
    }

    const config: ConfigDoModeloDoProjeto = {
      campos,
      tomoFormat: proposta.tomoFormat ?? "parenthesized-padded",
      volumeFormat: proposta.volumeFormat ?? "roman",
      defaults: {
        orgao: textoDe("ORGAO"),
        secretaria: textoDe("SECRETARIA"),
        fase: textoDe("FASE") || "PROJETO EXECUTIVO",
      },
      paginasPorCapa: original ?? 1,
    };
    const modeloGravado = await guardarModeloDeCapa({
      organizationId: actor.organizationId,
      projectId: projeto,
      nomeOriginal: odt.nome,
      bytes: modelo,
      config,
      email: actor.email,
    });
    return NextResponse.json({
      modelo: modeloGravado,
      templateId: idDoModeloDoProjeto(projeto),
      ensaiado: original !== null && doEnsaio !== null,
    });
  });
}
