import { readdir, readFile, access } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface TemplateConfigFile {
  id: string;
  nome: string;
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

  templates.sort((a, b) => a.nome.localeCompare(b.nome));
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
