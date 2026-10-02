import { EmploymentStatus } from "@prisma/client";

const styles: Record<EmploymentStatus, string> = {
  ACTIVE: "bg-positive-soft text-positive",
  INACTIVE: "bg-warn-soft text-warn",
  SEPARATED: "bg-negative-soft text-negative",
};

const labels: Record<EmploymentStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SEPARATED: "Separated",
};

export function StatusPill({ status }: { status: EmploymentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ${styles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
