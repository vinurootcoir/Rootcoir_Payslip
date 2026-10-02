import { CompanyForm } from "@/components/company-form";
import { PayslipTemplateForm } from "@/components/payslip-template-form";
import { requireRole } from "@/server/auth/guard";
import { csrfTokenFromRequest } from "@/server/auth/request";
import { getCompanySettings, hasPayslipTemplate } from "@/server/company/queries";

export default async function CompanySettingsPage() {
  await requireRole(["SUPER_ADMIN"]);
  const [csrf, company, template] = await Promise.all([
    csrfTokenFromRequest(),
    getCompanySettings(),
    hasPayslipTemplate(),
  ]);

  return (
    <section className="max-w-3xl rounded-[10px] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
      <h1 className="text-[21px] font-bold tracking-[-0.02em]">Company</h1>
      <p className="mt-1 mb-5 text-[13.5px] text-muted">
        Employer details used on payslips. Bonus and overtime stay off until you turn them on. Statutory rates are not calculated here.
      </p>
      <CompanyForm
        csrf={csrf}
        defaults={{
          name: company?.name ?? "",
          address: company?.address ?? "",
          currency: company?.currency || "INR",
          includeBonus: company?.includeBonus ?? false,
          includeOvertime: company?.includeOvertime ?? false,
          emailSubjectTemplate: company?.emailSubjectTemplate ?? "",
          emailBodyTemplate: company?.emailBodyTemplate ?? "",
        }}
      />
      <PayslipTemplateForm csrf={csrf} hasTemplate={template} />
    </section>
  );
}
