import { z } from "zod";

export const companyInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(1000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code."),
  includeBonus: z.boolean(),
  includeOvertime: z.boolean(),
  emailSubjectTemplate: z.string().trim().max(200),
  emailBodyTemplate: z.string().trim().max(4000),
});

export type CompanyInput = z.infer<typeof companyInputSchema>;

export function companyFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    address: formData.get("address"),
    currency: formData.get("currency"),
    includeBonus: formData.get("includeBonus") === "on",
    includeOvertime: formData.get("includeOvertime") === "on",
    emailSubjectTemplate: formData.get("emailSubjectTemplate") ?? "",
    emailBodyTemplate: formData.get("emailBodyTemplate") ?? "",
  };
}
