import { UserRole } from "@prisma/client";

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Super Admin";
    case "ADMIN":
      return "Admin";
    case "USER":
      return "Employee";
  }
}
