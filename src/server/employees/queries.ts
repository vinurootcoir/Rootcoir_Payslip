import "server-only";
import { EmploymentStatus, Prisma } from "@prisma/client";
import { getDb } from "@/server/db";
import { employeeListSelect } from "./list-fields";

const PAGE_SIZE = 20;

const listSelect = employeeListSelect satisfies Prisma.EmployeeSelect;

export type EmployeeListItem = Prisma.EmployeeGetPayload<{ select: typeof listSelect }>;

export function parseEmployeeListQuery(input: {
  q?: string;
  status?: string;
  page?: string;
}) {
  const q = (input.q ?? "").trim().slice(0, 80);
  const status = Object.values(EmploymentStatus).includes(input.status as EmploymentStatus)
    ? (input.status as EmploymentStatus)
    : null;
  const pageNumber = Number(input.page);
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? Math.min(pageNumber, 1000) : 1;
  return { q, status, page };
}

export async function listEmployees(input: { q: string; status: EmploymentStatus | null; page: number }) {
  const where: Prisma.EmployeeWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          OR: [
            { fullName: { contains: input.q, mode: "insensitive" } },
            { employeeNumber: { contains: input.q, mode: "insensitive" } },
            { workEmail: { contains: input.q, mode: "insensitive" } },
            { department: { contains: input.q, mode: "insensitive" } },
            { designation: { contains: input.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const db = getDb();
  const [total, employees] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      select: listSelect,
      orderBy: [{ fullName: "asc" }, { employeeNumber: "asc" }],
      skip: (input.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return {
    employees,
    total,
    page: input.page,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getEmployee(id: string) {
  return getDb().employee.findUnique({
    where: { id },
    select: {
      ...listSelect,
      phone: true,
      pan: true,
      uan: true,
      esiNumber: true,
      user: { select: { id: true } },
    },
  });
}
