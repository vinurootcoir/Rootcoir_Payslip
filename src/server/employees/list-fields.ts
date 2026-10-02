export const employeeListSelect = {
  id: true,
  employeeNumber: true,
  fullName: true,
  workEmail: true,
  designation: true,
  department: true,
  dateOfJoining: true,
  status: true,
} as const;

const sensitiveIdentifiers = ["pan", "uan", "esiNumber"] as const;

export function employeeListHidesSensitiveIdentifiers(
  fields: readonly string[] = Object.keys(employeeListSelect),
): boolean {
  return sensitiveIdentifiers.every((field) => !fields.includes(field));
}
