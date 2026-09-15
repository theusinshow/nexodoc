// Descobre as jornadas em scripts/bateria/jornadas/<area>/*.mjs e roda uma de
// cada vez, cada uma num navegador limpo (IndexedDB e cookies zerados).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { criarContexto } from "./contexto.mjs";

const RAIZ = "scripts/bateria/jornadas";

function listar(filtro) {
  const arquivos = [];
  for (const area of fs.readdirSync(RAIZ).sort()) {
    const pasta = path.join(RAIZ, area);
    if (!fs.statSync(pasta).isDirectory()) continue;
    for (const nome of fs.readdirSync(pasta).sort()) {
      if (!nome.endsWith(".mjs")) continue;
      if (filtro && area !== filtro && !nome.startsWith(filtro)) continue;
      arquivos.push(path.join(pasta, nome));
    }
  }
  return arquivos;
}

export async function rodarJornadas({ base, filtro, pastaDeArtefatos }) {
  const resultados = [];
  const browser = await chromium.launch();
  try {
    for (const arquivo of listar(filtro)) {
      const area = path.basename(path.dirname(arquivo));
      const idDoArquivo = path.basename(arquivo, ".mjs");
      const inicio = Date.now();

      // Um `import` que quebra (sintaxe, exceção no topo do módulo) não pode
      // derrubar a bateria: vira uma jornada vermelha e as outras seguem.
      let jornada;
      try {
        jornada = (await import(pathToFileURL(path.resolve(arquivo)).href)).default;
      } catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        console.log(`\n  ${idDoArquivo} · (não carregou)`);
        console.log(`      FALHOU  não carregou: ${msg}`);
        resultados.push({ id: idDoArquivo, area, titulo: idDoArquivo, estado: "vermelho", falhas: [`não carregou: ${msg}`], ms: Date.now() - inicio });
        continue;
      }

      console.log(`\n  ${jornada.id} · ${jornada.titulo}`);

      // O mesmo vale para montar o contexto (navegador, tour guiado): se
      // quebrar aqui, uma jornada não pode esconder o resultado das outras.
      let ctx;
      try {
        ctx = await criarContexto({ browser, base });
      } catch (err) {
        const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
        console.log(`      FALHOU  não montou o contexto: ${msg}`);
        resultados.push({
          id: jornada.id,
          area: jornada.area,
          titulo: jornada.titulo,
          estado: "vermelho",
          falhas: [`não montou o contexto: ${msg}`],
          ms: Date.now() - inicio,
        });
        continue;
      }

      try {
        // A fila da IA simulada exige sessão: quem limpa é `ctx.login()`, depois
        // de logar — não aqui (ver contexto.mjs).
        await jornada.rodar(ctx);
      } catch (err) {
        ctx.falhas.push(`quebrou: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
        console.log(`      QUEBROU  ${err instanceof Error ? err.message.split("\n")[0] : err}`);
      }
      if (ctx.erros.length > 0) ctx.falhas.push(`erro de runtime na página: ${ctx.erros[0].slice(0, 160)}`);
      if (ctx.falhas.length > 0) {
        await ctx.page
          .screenshot({ path: path.join(pastaDeArtefatos, `${jornada.id}.png`), fullPage: false })
          .catch(() => {});
      }
      // Fechar o contexto não pode, por si só, tirar o resultado da jornada do relatório.
      await ctx.fechar().catch(() => {});
      resultados.push({
        id: jornada.id,
        area: jornada.area,
        titulo: jornada.titulo,
        estado: ctx.falhas.length === 0 ? "verde" : "vermelho",
        falhas: ctx.falhas,
        ms: Date.now() - inicio,
      });
    }
  } finally {
    await browser.close();
  }
  return resultados;
}
