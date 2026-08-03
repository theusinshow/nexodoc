import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  /*
   * Os arquivos que as rotas LEEM do disco em tempo de execução. O rastreador
   * não os enxerga: o caminho é montado com `process.cwd()`, então sem esta
   * lista o pacote de produção sai sem os modelos e a geração falha só lá.
   *
   * As entradas eram só das rotas da tela antiga de LD (`/api/ld/generate-*`) —
   * as do Nexo, que hoje são o caminho principal, nunca estiveram aqui. Ao
   * aposentar aquela tela isto teria virado uma perda silenciosa de cobertura.
   */
  outputFileTracingIncludes: {
    "/api/nexo/ld": ["./templates/modelo_ld_empresa.odt"],
    "/api/nexo/separatriz": ["./templates/separatriz/**/*"],
    "/api/nexo/capa": ["./templates/**/*"],
    "/api/capas/generate": ["./templates/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  turbopack: {
    root: resolve(projectRoot),
  },
  typescript: {
    tsconfigPath: "./tsconfig.json",
  },
};

export default nextConfig;
