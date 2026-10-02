import "server-only";
import { getDb } from "@/server/db";

export async function listUsers() {
  return getDb().user.findMany({
    orderBy: [{ role: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      employee: { select: { fullName: true, employeeNumber: true } },
    },
  });
}

export async function getUserAccess(id: string) {
  const [user, activeSuperAdmins] = await Promise.all([
    getDb().user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        employee: { select: { fullName: true, employeeNumber: true } },
      },
    }),
    getDb().user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
  ]);
  return { user, activeSuperAdmins };
}

export async function listEmployeesWithoutLogin() {
  return getDb().employee.findMany({
    where: { user: { is: null } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, employeeNumber: true, workEmail: true },
  });
}
