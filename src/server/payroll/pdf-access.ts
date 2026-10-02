import type { UserRole } from "@prisma/client";

export function canDownloadPayslip(
  actor: { role: UserRole; employeeId: string | null },
  record: { employeeId: string; status: "DRAFT" | "FINALIZED" | "VOID" },
): boolean {
  if (record.status === "DRAFT") return false;
  if (actor.role === "SUPER_ADMIN" || actor.role === "ADMIN") return true;
  return actor.employeeId !== null && actor.employeeId === record.employeeId;
}
