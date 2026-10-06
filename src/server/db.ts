import "server-only";
import { PrismaClient } from "@prisma/client";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function runtimeDatabaseUrl(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }
  if (!url.hostname.includes("-pooler")) return databaseUrl;
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "10");
  return url.toString();
}

export function getDb(): PrismaClient {
  const env = getEnv();

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url: runtimeDatabaseUrl(env.databaseUrl) } },
      log: ["error"],
    });
  }

  return globalForPrisma.prisma;
}
