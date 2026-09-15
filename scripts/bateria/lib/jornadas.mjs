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
      const jornada = (await import(pathToFileURL(path.resolve(arquivo)).href)).default;
      console.log(`\n  ${jornada.id} · ${jornada.titulo}`);
      const inicio = Date.now();
      const ctx = await criarContexto({ browser, base });
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
      await ctx.fechar();
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
