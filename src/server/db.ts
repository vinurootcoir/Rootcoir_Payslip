import "server-only";
import { PrismaClient } from "@prisma/client";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getDb(): PrismaClient {
  getEnv();

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: ["error"],
    });
  }

  return globalForPrisma.prisma;
}
