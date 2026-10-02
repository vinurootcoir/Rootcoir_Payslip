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

const TEMPLATE_LIMIT = 2_000_000;

export async function savePayslipTemplate(
  _state: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false };
  const actor = await requireRole(["SUPER_ADMIN"]);
  const file = formData.get("template");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PNG image.", saved: false };
  if (file.size > TEMPLATE_LIMIT) return { error: "That image is too large.", saved: false };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!png) return { error: "Upload a PNG image.", saved: false };

  try {
    await getDb().companySettings.upsert({
      where: { id: 1 },
      create: { id: 1, payslipTemplate: Buffer.from(bytes), updatedById: actor.id },
      update: { payslipTemplate: Buffer.from(bytes), updatedById: actor.id },
    });
    await getDb().auditLog.create({
      data: {
        actorId: actor.id,
        action: "company.update",
        targetType: "company_settings",
        targetId: "1",
        requestId: crypto.randomUUID(),
        metadata: { fields: ["payslip_template"] },
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    logFailure("company.template", error);
    return { error: "Something went wrong. Try again.", saved: false };
  }

  revalidatePath("/settings/company");
  return { error: null, saved: true };
}

export async function clearPayslipTemplate(
  _state: CompanyFormState,
  formData: FormData,
): Promise<CompanyFormState> {
  const blocked = await mutationGuard(formData);
  if (blocked) return { error: blocked, saved: false };
  const actor = await requireRole(["SUPER_ADMIN"]);
  try {
    await getDb().companySettings.update({
      where: { id: 1 },
      data: { payslipTemplate: null, updatedById: actor.id },
    });
  } catch (error) {
    unstable_rethrow(error);
    logFailure("company.template", error);
    return { error: "Something went wrong. Try again.", saved: false };
  }
  revalidatePath("/settings/company");
  return { error: null, saved: true };
}
