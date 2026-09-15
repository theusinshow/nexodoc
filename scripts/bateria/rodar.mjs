// A BATERIA DE FLUXOS ESQUISITOS.
//
//   npm run bateria                  # puros + todas as jornadas
//   npm run bateria -- auditoria     # puros + jornadas da área (ou id: a1)
//   npm run bateria -- --so-puros
//   npm run bateria -- --so-jornadas auditoria
//
// Desenho: docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md
import fs from "node:fs";
import path from "node:path";

import { prepararBanco } from "./lib/banco.mjs";
import { rodarJornadas } from "./lib/jornadas.mjs";
import { rodarPuros } from "./lib/puros.mjs";
import { imprimirRelatorio } from "./lib/relatorio.mjs";
import { matarPorta, subirServidor } from "./lib/servidor.mjs";
import { urlDaBateria } from "./lib/ambiente.mjs";

const args = process.argv.slice(2);
const soPuros = args.includes("--so-puros");
const soJornadas = args.includes("--so-jornadas");
const filtro = args.find((a) => !a.startsWith("--"));
const PORTA = 3100;

urlDaBateria(); // falha cedo, com o motivo, se o banco não for o da bateria

const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const pastaDeArtefatos = path.join("scratchpad", "bateria", carimbo);
fs.mkdirSync(pastaDeArtefatos, { recursive: true });

let puros = null;
let jornadas = null;
let servidor = null;

/*
 * CTRL+C DERRUBA O SERVIDOR JUNTO — 14/09/2026. Sem isto, interromper a bateria
 * no meio de uma jornada deixava o `next dev` da 3100 vivo, e a próxima
 * corrida dependia de `matarPorta` conseguir derrubá-lo. Antes de o servidor
 * responder não há `derrubar()`: aí vale a porta.
 */
let interrompida = false;
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, async () => {
    if (interrompida) return;
    interrompida = true;
    console.log(`\nInterrompida (${sinal}): derrubando o servidor da bateria…`);
    try {
      if (servidor) await servidor.derrubar();
      else matarPorta(PORTA);
    } finally {
      process.exit(130);
    }
  });
}

// Migra ANTES dos testes puros: na primeira rodada o banco nasce sem tabelas, e
// os testes que tocam o banco ficariam vermelhos por um motivo que não é deles.
console.log("Preparando o banco nexodoc_teste…");
await prepararBanco();

if (!soJornadas) {
  console.log("Testes puros…");
  puros = await rodarPuros({});
}

if (!soPuros) {
  // De novo: o que os testes puros gravaram não pode vazar para as jornadas.
  if (!soJornadas) await prepararBanco();
  console.log(`Subindo o servidor da bateria na ${PORTA}…`);
  servidor = await subirServidor({ porta: PORTA, arquivoDeLog: path.join(pastaDeArtefatos, "servidor.log") });
  try {
    jornadas = await rodarJornadas({ base: servidor.base, filtro, pastaDeArtefatos });
  } finally {
    await servidor.derrubar();
  }
}

const vermelhos = imprimirRelatorio({ puros, jornadas, pastaDeArtefatos });
process.exit(vermelhos > 0 ? 1 : 0);
