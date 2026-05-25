import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPgPool?: Pool;
};

export function getPrisma() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://nexodoc:nexodoc@localhost:5432/nexodoc";
  const pool =
    globalForPrisma.prismaPgPool ??
    new Pool({
      connectionString,
    });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });

  globalForPrisma.prisma = client;
  globalForPrisma.prismaPgPool = pool;

  return client;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}
