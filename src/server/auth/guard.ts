import "server-only";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getCurrentUser, type CurrentUser } from "./session";

export async function requireUser(): Promise<CurrentUser> {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

export async function requireRole(roles: readonly UserRole[]): Promise<CurrentUser> {
  const current = await requireUser();
  if (!roles.includes(current.role)) redirect("/forbidden");
  return current;
}
