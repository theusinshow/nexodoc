/**
 * O MODELO DE CAPA DO PROJETO (16/10/2026): a ficha no Postgres, os bytes no
 * cofre. Desenho: docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 *
 * Toda função recebe o projeto JÁ conferido contra o escritório — quem confere
 * é `projetoDoEscritorio` (server/pranchas.ts), chamado pela rota antes.
 */
import { guardarNoCofre, lerDoCofre } from "@/lib/cofre";
import { getPrisma } from "@/lib/db";
import type { FormatoDoTomo, FormatoDoVolume } from "@/server/nexo/modelo-capa/tipos";
import type { TemplateConfigFile } from "@/server/templates/registry";

export interface ConfigDoModeloDoProjeto {
  campos: string[];
  tomoFormat: FormatoDoTomo;
  volumeFormat: FormatoDoVolume;
  defaults: { orgao: string; secretaria: string; fase: string };
  /** 1, ou 2 quando o modelo tem contracapa. É a régua do transbordo. */
  paginasPorCapa: number;
}

export interface FichaDoModelo {
  nomeOriginal: string;
  criadoEm: string;
  checksum: string;
  config: ConfigDoModeloDoProjeto;
}

/**
 * O id de template do modelo do projeto. Viaja pelos mesmos caminhos que o id
 * de prefeitura (proposta do agente, card, `/api/nexo/capa`), e só a rota da
 * capa sabe resolvê-lo — com o escritório conferido.
 */
const PREFIXO = "projeto:";
export const idDoModeloDoProjeto = (projectId: string) => `${PREFIXO}${projectId}`;
export function projetoDoModelo(templateId: string): string | null {
  return templateId.startsWith(PREFIXO) ? templateId.slice(PREFIXO.length) || null : null;
}

const ODT_MIME = "application/vnd.oasis.opendocument.text";

type Linha = { nomeOriginal: string; updatedAt: Date; checksumSha256: string; config: unknown };

function ficha(linha: Linha): FichaDoModelo {
  return {
    nomeOriginal: linha.nomeOriginal,
    criadoEm: linha.updatedAt.toISOString(),
    checksum: linha.checksumSha256,
    config: linha.config as ConfigDoModeloDoProjeto,
  };
}

/** Grava (ou substitui) o modelo do projeto. Bytes primeiro: ficha sem bytes não gera capa. */
export async function guardarModeloDeCapa(args: {
  organizationId: string;
  projectId: string;
  nomeOriginal: string;
  bytes: Uint8Array;
  config: ConfigDoModeloDoProjeto;
  email: string;
}): Promise<FichaDoModelo> {
  const guardado = await guardarNoCofre({
    bytes: args.bytes,
    organizationId: args.organizationId,
    mimeType: ODT_MIME,
  });
  const dados = {
    checksumSha256: guardado.checksumSha256,
    nomeOriginal: args.nomeOriginal,
    config: args.config as unknown as object,
    criadoPor: args.email,
  };
  const linha = await getPrisma().modeloDeCapaDoProjeto.upsert({
    where: { projectId: args.projectId },
    create: { projectId: args.projectId, ...dados },
    update: dados,
  });
  return ficha(linha);
}

export async function fichaDoModeloDeCapa(projectId: string): Promise<FichaDoModelo | null> {
  const linha = await getPrisma().modeloDeCapaDoProjeto.findUnique({ where: { projectId } });
  return linha ? ficha(linha) : null;
}

/** Ficha + bytes. `null` se não há modelo, ou se os bytes sumiram do cofre. */
export async function modeloDeCapaResolvido(
  projectId: string,
  organizationId: string,
): Promise<{ ficha: FichaDoModelo; bytes: Buffer } | null> {
  const f = await fichaDoModeloDeCapa(projectId);
  if (!f) return null;
  const arquivo = await lerDoCofre(f.checksum, organizationId);
  if (!arquivo) return null;
  return { ficha: f, bytes: arquivo.bytes };
}

/** O modelo do projeto com a cara de um template de prefeitura. */
export function templateDoModeloDoProjeto(projectId: string, f: FichaDoModelo): TemplateConfigFile {
  return {
    id: idDoModeloDoProjeto(projectId),
    nome: "Modelo do projeto",
    grupo: "Modelo do projeto",
    variante: f.nomeOriginal,
    arquivoTemplate: f.nomeOriginal,
    volumeFormat: f.config.volumeFormat,
    tomoFormat: f.config.tomoFormat,
    coverTitleMode: "items",
    defaults: f.config.defaults,
    campos: f.config.campos,
    paginasPorCapa: f.config.paginasPorCapa,
  };
}
