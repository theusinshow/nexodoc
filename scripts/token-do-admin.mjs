/**
 * O TOKEN ADMIN que as provas usam, na mesma ordem em que a máquina o define.
 *
 * O servidor lê `.env.local`; o processo da prova, não. O resultado era uma
 * prova digitando "teste-local" contra um servidor com token de verdade,
 * recebendo "Acesso admin negado" e falhando três passos adiante, com uma
 * mensagem que não falava de token nenhum ("campo não editável").
 *
 * Ordem: variável de ambiente > `.env.local` > o padrão de desenvolvimento.
 */
import { existsSync, readFileSync } from "node:fs";

/** Uma variável como o servidor a vê: ambiente primeiro, `.env.local` depois. */
export function doAmbienteOuEnvLocal(nome) {
  const doAmbiente = (process.env[nome] ?? "").trim();
  if (doAmbiente) return doAmbiente;

  if (existsSync(".env.local")) {
    for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = linha.match(new RegExp(`^${nome}\\s*=\\s*(.*)$`));
      // O valor pode vir entre aspas; nunca é impresso.
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  return "";
}

export function tokenDoAdmin() {
  return doAmbienteOuEnvLocal("NEXODOC_ADMIN_TOKEN") || "teste-local";
}

/**
 * Há banco? Muda o que a tela DEVE fazer: com banco os botões de declarar
 * ficam clicáveis; sem banco, travados e com o motivo escrito ao lado. As duas
 * coisas são comportamento correto, e a prova precisa saber qual esperar.
 */
export function temBanco() {
  return Boolean(doAmbienteOuEnvLocal("DATABASE_URL"));
}
