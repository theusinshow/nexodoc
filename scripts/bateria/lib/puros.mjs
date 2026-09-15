// Roda os scripts/test-*.ts. "Apodrecido" é o teste que nem chega a rodar
// (import quebrado, sintaxe): foi assim que o de disciplinas ficou 11 dias
// mudo em agosto de 2026. Ele sai separado do vermelho porque pede outro gesto.
import { spawn } from "node:child_process";
import fs from "node:fs";

import { ambienteDosTestes } from "./ambiente.mjs";

const IMPORT_QUEBRADO = /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find package|does not provide an export/;

function executar(args, env, timeoutMs) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const filho = spawn(process.execPath, args, { env });
    let saida = "";
    filho.stdout.on("data", (d) => (saida += d));
    filho.stderr.on("data", (d) => (saida += d));
    const relogio = setTimeout(() => filho.kill("SIGKILL"), timeoutMs);
    filho.on("close", (codigo, sinal) => {
      clearTimeout(relogio);
      resolve({ codigo, estourou: sinal === "SIGKILL", saida, ms: Date.now() - inicio });
    });
  });
}

function primeiraLinhaDeErro(saida) {
  const linhas = saida.split(/\r?\n/);
  const falhouIdx = linhas.findIndex((l) => /FALHOU|falha/.test(l) && !/warning/i.test(l));
  if (falhouIdx !== -1) {
    const header = linhas[falhouIdx].trim();
    // Procura a primeira linha não-vazia após FALHOU que não seja stack frame ("at ...")
    const motivo = linhas.slice(falhouIdx + 1).find((l) => l.trim() && !/^\s*at\s+/.test(l))?.trim() ?? "";
    return (motivo ? `${header}: ${motivo}` : header).slice(0, 200);
  }
  return (
    linhas.find((l) => /Error|AssertionError/.test(l) && !/warning/i.test(l)) ??
    linhas.filter(Boolean).at(-1) ??
    ""
  ).trim().slice(0, 200);
}

async function rodarUm(arquivo, env, timeoutMs) {
  let r = await executar([arquivo], env, timeoutMs);
  if (r.codigo !== 0 && /Cannot find package '@\//.test(r.saida)) {
    r = await executar(["--import", "./scripts/lib/so-o-alias.mjs", arquivo], env, timeoutMs);
  }
  // Se ainda falhar com import de extensão faltando (imports relativos sem extensão),
  // tenta com o resolvedor do repo. Alguns testes de produção usam isto porque o código
  // de produção importa sem extensão (./disciplinas, ./parse-filename). O build resolve,
  // node cru não — que é por que package.json roda esses testes com --import resolver.
  // Sem isto, 5 testes foram flagrados como apodrecidos por engano (14/09/2026).
  if (r.codigo !== 0 && /(ERR_MODULE_NOT_FOUND|Cannot find module)/.test(r.saida) && !/Cannot find package '@\//.test(r.saida)) {
    r = await executar(["--import", "./scripts/lib/resolver-de-imports.mjs", arquivo], env, timeoutMs);
  }
  if (r.estourou) return { arquivo, estado: "vermelho", motivo: `tempo esgotado (${timeoutMs / 1000}s)`, ms: r.ms };
  if (r.codigo === 0) return { arquivo, estado: "verde", motivo: "", ms: r.ms };
  const apodrecido = IMPORT_QUEBRADO.test(r.saida) && !/ok\s/.test(r.saida);
  return { arquivo, estado: apodrecido ? "apodrecido" : "vermelho", motivo: primeiraLinhaDeErro(r.saida), ms: r.ms };
}

export async function rodarPuros({ paralelo = 6, timeoutMs = 90_000, filtro } = {}) {
  const env = ambienteDosTestes();
  const arquivos = fs
    .readdirSync("scripts")
    .filter((n) => /^test-.*\.ts$/.test(n) && (!filtro || n.includes(filtro)))
    .sort()
    .map((n) => `scripts/${n}`);

  const resultados = [];
  let proximo = 0;
  async function trabalhador() {
    while (proximo < arquivos.length) {
      const arquivo = arquivos[proximo++];
      const r = await rodarUm(arquivo, env, timeoutMs);
      resultados.push(r);
      process.stdout.write(r.estado === "verde" ? "." : r.estado === "apodrecido" ? "A" : "F");
    }
  }
  await Promise.all(Array.from({ length: paralelo }, trabalhador));
  process.stdout.write("\n");
  return resultados.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
}
