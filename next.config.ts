import type { NextConfig } from "next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /*
   * A PASTA DE BUILD pode mudar pelo ambiente. O servidor da bateria usa
   * `.next-bateria`: com a mesma `.next`, ele disputava o arquivo com o
   * `npm run dev` de quem está programando ("Another next dev server is already
   * running", visto em 14/09/2026). Sem a variável, nada muda.
   */
  distDir: process.env.NEXODOC_DIST_DIR || ".next",
  /*
   * `hunspell-asm` carrega um WebAssembly e `dictionary-pt` lê o `.dic` do
   * próprio pacote com `import.meta.url`: os dois têm de ficar fora do bundle,
   * como o pdf.js. É o dicionário da conferência de grafia (16/10/2026).
   */
  serverExternalPackages: ["pdfjs-dist", "hunspell-asm", "dictionary-pt"],
  /*
   * O `<ViewTransition>` do React — a transição entre páginas
   * (components/layout/transicao-de-pagina.tsx) — dispensa flag desde a Next
   * 16.4: `experimental.viewTransition` deixou de existir e quebrava o build
   * (08/10/2026, subida de segurança 16.2.6 → 16.4.0).
   */
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
    /*
     * A LISTA DE PREFEITURAS também lê o disco, e não estava aqui.
     *
     * Ela sempre leu os `config.json`; desde que passou a devolver o LAYOUT do
     * modelo (o frame do documento se desenha a partir dele), lê os `.odt`
     * também. Sem esta entrada, em produção a rota devolveria a lista vazia ou
     * `layout: []` — e o card cairia para a lista de rótulo/valor sem nada
     * acusar, funcionando perfeitamente na máquina de quem programou.
     */
    "/api/capas/templates": ["./templates/capas/**/*"],
    /*
     * A CHECAGEM DE SAÚDE existe justamente para acusar modelo faltando no
     * pacote. Se ela mesma ficar de fora do rastreio, acusa a própria ausência e
     * o container nunca sobe — o alarme tocaria por causa do alarme.
     */
    "/api/saude": ["./templates/capas/**/*"],
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
