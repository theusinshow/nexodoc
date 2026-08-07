import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

loadEnvConfig(process.cwd());

/**
 * O fallback para localhost é conveniência de DESENVOLVIMENTO, e só.
 *
 * Em produção ele mentia: sem `DATABASE_URL`, o container subia apontando para
 * `localhost:5432` e morria com "Can't reach database server at localhost:5432
 * — please make sure your database server is running". A pessoa vai procurar
 * banco caído; o problema era variável de ambiente faltando. Custou um deploy.
 */
function urlDoBanco(): string {
  const doAmbiente = process.env.DATABASE_URL?.trim();
  if (doAmbiente) return doAmbiente;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_URL ausente. Em producao nao ha fallback: preencha a variavel " +
        "no painel do provedor (na Render ela e `sync: false`, entao precisa de " +
        "valor manual). Nao ha banco em localhost dentro do container.",
    );
  }

  return "postgresql://nexodoc:nexodoc@localhost:5432/nexodoc";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: urlDoBanco(),
  },
});
