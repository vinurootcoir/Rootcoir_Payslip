ALTER TABLE "employees"
  ADD COLUMN "basic_salary" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "hra" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "special_allowance" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "other_allowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employee_pf" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "employee_esi" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "professional_tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "tds" DECIMAL(14,2) NOT NULL DEFAULT 0;

ALTER TABLE "employees" ADD CONSTRAINT "employees_salary_chk" CHECK (
  basic_salary >= 0
  AND hra >= 0
  AND special_allowance >= 0
  AND other_allowances >= 0
  AND employee_pf >= 0
  AND employee_esi >= 0
  AND professional_tax >= 0
  AND tds >= 0
);

ALTER TABLE "payroll_records"
  ADD COLUMN "casual_leave_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN "sick_leave_days" DECIMAL(6,2) NOT NULL DEFAULT 0;

ALTER TABLE "payroll_records" DROP CONSTRAINT "payroll_records_days_chk";
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_days_chk" CHECK (
  total_working_days >= 0
  AND paid_days >= 0
  AND lop_days >= 0
  AND casual_leave_days >= 0
  AND sick_leave_days >= 0
);
