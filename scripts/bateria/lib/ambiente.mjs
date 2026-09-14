// O AMBIENTE da bateria. Variável definida no processo ganha do `.env.local`: o
// Next não sobrescreve o que já existe, e os testes do repo leem o arquivo com
// `if (!process.env[x])`. É assim que o servidor e os testes caem no banco
// da bateria sem ninguém editar o `.env.local`.
import fs from "node:fs";

import { bancoDaBateria } from "./guarda-do-banco.mjs";

export const EMAIL_DA_BATERIA = "bateria@nexodoc.local";

export function lerEnvLocal() {
  const env = {};
  if (!fs.existsSync(".env.local")) return env;
  for (const linha of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(linha.trim());
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
  return env;
}

export function urlDaBateria() {
  const url = process.env.DATABASE_URL_BATERIA ?? lerEnvLocal().DATABASE_URL_BATERIA ?? "";
  const guarda = bancoDaBateria(url);
  if (!guarda.ok) {
    throw new Error(
      `${guarda.motivo}. Acrescente DATABASE_URL_BATERIA ao .env.local (ver docs/bateria/rodar-no-pc-de-casa.md).`,
    );
  }
  return url;
}

export function ambienteDosTestes() {
  return {
    ...process.env,
    DATABASE_URL: urlDaBateria(),
    DIRECT_DATABASE_URL: "",
    // Zero token: nenhum teste puro chega à OpenAI de verdade, nem por um
    // import transitivo do executor da bateria.
    OPENAI_API_KEY: "sk-simulada",
  };
}

export function ambienteDoServidor(porta) {
  const base = `http://localhost:${porta}`;
  return {
    ...ambienteDosTestes(),
    NEXODOC_IA_SIMULADA: "1",
    // O modo mock antigo desviaria a auditoria antes do executor, e a
    // bateria estaria testando o mock, não o fluxo.
    NEXODOC_MOCK_MODE: "false",
    NEXODOC_DEV_AUTH: "true",
    NEXODOC_DEV_AUTH_EMAIL: EMAIL_DA_BATERIA,
    NEXODOC_DEV_AUTH_NAME: "Bateria",
    OPENAI_API_KEY: "sk-simulada",
    NEXT_PUBLIC_NEXO_ENABLED: "true",
    NEXODOC_DIST_DIR: ".next-bateria",
    AUTH_URL: base,
    NEXTAUTH_URL: base,
    // Nenhum e-mail de verdade sai de uma jornada.
    RESEND_API_KEY: "",
    NEXODOC_EMAIL_FROM: "",
  };
}
