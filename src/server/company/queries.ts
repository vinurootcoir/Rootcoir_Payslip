import "server-only";
import { getDb } from "@/server/db";

export async function loadPayslipTemplate(): Promise<Uint8Array | null> {
  const row = await getDb().companySettings.findUnique({
    where: { id: 1 },
    select: { payslipTemplate: true },
  });
  if (!row?.payslipTemplate || row.payslipTemplate.byteLength < 8) return null;
  return new Uint8Array(row.payslipTemplate);
}

export async function hasPayslipTemplate(): Promise<boolean> {
  const rows = await getDb().$queryRaw<Array<{ present: boolean }>>`
    SELECT (payslip_template IS NOT NULL) AS present
    FROM company_settings
    WHERE id = 1
  `;
  return rows[0]?.present === true;
}

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
