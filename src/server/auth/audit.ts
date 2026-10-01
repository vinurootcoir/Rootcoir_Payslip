import "server-only";
import { Prisma } from "@prisma/client";
import { getDb } from "@/server/db";

type AuditInput = {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  await getDb().auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      requestId: crypto.randomUUID(),
      metadata: input.metadata,
    },
  });
}
