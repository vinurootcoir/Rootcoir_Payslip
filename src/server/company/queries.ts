import "server-only";
import { getDb } from "@/server/db";

export async function getCompanySettings() {
  return getDb().companySettings.findUnique({
    where: { id: 1 },
    select: {
      name: true,
      address: true,
      currency: true,
      includeBonus: true,
      includeOvertime: true,
      emailSubjectTemplate: true,
      emailBodyTemplate: true,
    },
  });
}
