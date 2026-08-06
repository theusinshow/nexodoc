import { readdir, readFile, access, stat } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

import { lerLayoutDoModelo, type ParagrafoDoModelo } from "@/server/odt/layout";

export interface TemplateConfigFile {
  id: string;
  nome: string;
  /** Prefeitura que agrupa as variacoes. Se ausente, o proprio `nome` vira o grupo. */
  grupo?: string;
  /** Rotulo da variacao dentro do grupo (chip). Se ausente, usa `nome`. */
  variante?: string;
  arquivoTemplate: string;
  volumeFormat?: "roman" | "numeric";
  tomoFormat?: "parenthesized-padded" | "parenthesized" | "plain-padded" | "plain";
  coverTitleMode?: "items" | "volume-title-items";
  defaults: {
    orgao: string;
    secretaria: string;
    fase: string;
  };
  campos: string[];
}

let cachedTemplates: TemplateConfigFile[] | null = null;

function getTemplatesRoot(): string {
  return join(/*turbopackIgnore: true*/ process.cwd(), "templates", "capas");
}

export async function getTemplateRegistry(): Promise<TemplateConfigFile[]> {
  if (cachedTemplates) return cachedTemplates;

  const root = getTemplatesRoot();
  const templates: TemplateConfigFile[] = [];

  try {
    const entries = await readdir(root, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_")) continue;

      const configPath = join(root, entry.name, "config.json");
      try {
        await access(configPath);
        const content = await readFile(configPath, "utf-8");
        const config = JSON.parse(content) as TemplateConfigFile;
        templates.push(config);
      } catch {
        // skip folders without valid config.json
      }
    }
  } catch {
    // templates directory might not exist yet
  }

  templates.sort((a, b) => {
    const grupoCmp = (a.grupo ?? a.nome).localeCompare(b.grupo ?? b.nome);
    if (grupoCmp !== 0) return grupoCmp;
    return (a.variante ?? a.nome).localeCompare(b.variante ?? b.nome);
  });
  cachedTemplates = templates;
  return templates;
}

export function clearTemplateCache(): void {
  cachedTemplates = null;
}

export async function getTemplateOdtPath(templateId: string): Promise<string | null> {
  const root = getTemplatesRoot();
  const registry = await getTemplateRegistry();
  const config = registry.find((t) => t.id === templateId);

  if (!config) return null;

  const odtPath = join(root, templateId, config.arquivoTemplate);

  if (existsSync(odtPath)) {
    return odtPath;
  }

  return null;
}

/**
 * O layout do modelo, com cache CHAVEADO PELA DATA DO ARQUIVO.
 *
 * O `cachedTemplates` acima nunca invalida, e isso não morde porque o ODT é
 * lido fresco a cada geração. Pendurar o layout no mesmo cache faria uma edição
 * no modelo exigir reiniciar o servidor — e quem edita o modelo é o engenheiro,
 * no meio do trabalho. A data de modificação resolve sem cerimônia, e mantém
 * verdadeira a regra de que o MODELO manda.
 */
const cachedLayouts = new Map<
  string,
  { mtimeMs: number; layout: ParagrafoDoModelo[] }
>();

export async function getTemplateLayout(
  templateId: string,
): Promise<ParagrafoDoModelo[] | null> {
  const odtPath = await getTemplateOdtPath(templateId);
  if (!odtPath) return null;

  const { mtimeMs } = await stat(odtPath);
  const guardado = cachedLayouts.get(templateId);
  if (guardado && guardado.mtimeMs === mtimeMs) return guardado.layout;

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await readFile(odtPath));
  const arquivo = zip.file("content.xml");
  if (!arquivo) return null;

  const layout = lerLayoutDoModelo(await arquivo.async("string"));
  cachedLayouts.set(templateId, { mtimeMs, layout });
  return layout;
}
