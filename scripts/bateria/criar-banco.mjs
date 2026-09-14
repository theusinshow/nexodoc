// Cria o banco da bateria uma vez. Conecta ao banco de DESENVOLVIMENTO do
// mesmo projeto Neon (`nexodoc_dev`) só para o CREATE DATABASE, e não escreve
// nada nele — nunca abre conexão com o banco de produção.
//
//   npm run bateria:criar-banco
import pg from "pg";

import { urlDaBateria } from "./lib/ambiente.mjs";
import { semOPooler } from "./lib/guarda-do-banco.mjs";

const url = new URL(semOPooler(urlDaBateria()));
url.searchParams.delete("channel_binding");
const admin = new URL(url);
admin.pathname = "/nexodoc_dev";

const cliente = new pg.Client({ connectionString: admin.toString() });
await cliente.connect();
const existe = await cliente.query("select 1 from pg_database where datname = 'nexodoc_teste'");
if (existe.rowCount === 0) {
  await cliente.query("CREATE DATABASE nexodoc_teste");
  console.log("banco nexodoc_teste criado");
} else {
  console.log("banco nexodoc_teste já existia");
}
await cliente.end();
