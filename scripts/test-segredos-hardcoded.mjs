/** Falha se um segredo de formato conhecido voltar ao código versionável. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const arquivos = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const padroes = [
  { nome: "chave OpenAI", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { nome: "token GitHub", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { nome: "token Slack", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { nome: "chave privada", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

const ocorrencias = [];

for (const arquivo of arquivos) {
  if (statSync(arquivo).size > 5_000_000) continue;

  const conteudo = readFileSync(arquivo);
  if (conteudo.includes(0)) continue;
  const texto = conteudo.toString("utf8");

  for (const padrao of padroes) {
    padrao.regex.lastIndex = 0;
    for (const match of texto.matchAll(padrao.regex)) {
      const linha = texto.slice(0, match.index).split("\n").length;
      ocorrencias.push(`${padrao.nome}: ${arquivo}:${linha}`);
    }
  }
}

assert.deepEqual(
  ocorrencias,
  [],
  `Segredo(s) de formato conhecido encontrado(s):\n${ocorrencias.join("\n")}`,
);

console.log(`OK  ${arquivos.length} arquivo(s) sem segredos hardcoded conhecidos.`);
