import "server-only";
import { getDb } from "@/server/db";

const PAGE_SIZE = 25;

export async function listAuditLogs(page: number) {
  const current = Number.isInteger(page) && page > 0 ? page : 1;
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        createdAt: true,
        metadata: true,
        actor: { select: { email: true } },
      },
    }),
    db.auditLog.count(),
  ]);
  return {
    rows,
    page: current,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
}
