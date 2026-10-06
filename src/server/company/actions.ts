"use server";

import { logFailure } from "@/lib/log";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireRole } from "@/server/auth/guard";
import { mutationGuard } from "@/server/auth/request";
import { getDb } from "@/server/db";
import { companyFormData, companyInputSchema } from "./schema";

export type CompanyFormState = { error: string | null; saved: boolean };

export async function saveCompany(
  _state: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false };

  const actor = await requireRole(["SUPER_ADMIN"]);
  const parsed = companyInputSchema.safeParse(companyFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form and try again.", saved: false };
  }

  const input = parsed.data;
  try {
    await getDb().$transaction([
      getDb().companySettings.upsert({
        where: { id: 1 },
        create: { id: 1, ...input, updatedById: actor.id },
        update: { ...input, updatedById: actor.id },
      }),
      getDb().auditLog.create({
        data: {
          actorId: actor.id,
          action: "company.update",
          targetType: "company_settings",
          targetId: "1",
          requestId: crypto.randomUUID(),
          metadata: { fields: ["name", "address", "currency", "payslip_options", "email_templates"] },
        },
      }),
    ]);
  } catch (error) {
    unstable_rethrow(error);
    logFailure("company.save", error);
    return { error: "Something went wrong. Try again.", saved: false };
  }

  revalidatePath("/settings/company");
  return { error: null, saved: true };
}
