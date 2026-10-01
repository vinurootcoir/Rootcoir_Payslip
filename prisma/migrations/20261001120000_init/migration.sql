-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SEPARATED');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateEnum
CREATE TYPE "PayrollRecordStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOID');

-- CreateEnum
CREATE TYPE "EmailBatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "employee_id" UUID,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employee_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "work_email" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date_of_joining" DATE NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "pan" TEXT,
    "uan" TEXT,
    "esi_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "include_bonus" BOOLEAN NOT NULL DEFAULT false,
    "include_overtime" BOOLEAN NOT NULL DEFAULT false,
    "email_subject_template" TEXT NOT NULL DEFAULT '',
    "email_body_template" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID,
    "finalized_by_id" UUID,
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "payslip_number" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "status" "PayrollRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "current_marker" TEXT,
    "total_working_days" DECIMAL(6,2) NOT NULL,
    "paid_days" DECIMAL(6,2) NOT NULL,
    "lop_days" DECIMAL(6,2) NOT NULL,
    "basic_salary" DECIMAL(14,2) NOT NULL,
    "hra" DECIMAL(14,2) NOT NULL,
    "special_allowance" DECIMAL(14,2) NOT NULL,
    "other_allowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(14,2),
    "bonus" DECIMAL(14,2),
    "gross_earnings" DECIMAL(14,2) NOT NULL,
    "employee_pf" DECIMAL(14,2),
    "employee_esi" DECIMAL(14,2),
    "professional_tax" DECIMAL(14,2),
    "tds" DECIMAL(14,2),
    "salary_advance" DECIMAL(14,2),
    "other_deductions" DECIMAL(14,2),
    "total_deductions" DECIMAL(14,2) NOT NULL,
    "net_pay" DECIMAL(14,2) NOT NULL,
    "amount_in_words" TEXT,
    "snapshot" JSONB,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "finalized_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_reason" VARCHAR(500),
    "supersedes_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "finalized_by_id" UUID,
    "voided_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_batches" (
    "id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "initiated_by_id" UUID NOT NULL,
    "status" "EmailBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "payroll_record_id" UUID NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error_sanitized" VARCHAR(500),
    "provider_response_sanitized" VARCHAR(500),
    "sent_at" TIMESTAMP(3),
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "target_type" VARCHAR(80) NOT NULL,
    "target_id" VARCHAR(80),
    "request_id" VARCHAR(80),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_work_email_key" ON "employees"("work_email");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_year_month_key" ON "payroll_periods"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_payslip_number_key" ON "payroll_records"("payslip_number");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_current_marker_key" ON "payroll_records"("current_marker");

-- CreateIndex
CREATE INDEX "payroll_records_payroll_period_id_idx" ON "payroll_records"("payroll_period_id");

-- CreateIndex
CREATE INDEX "payroll_records_employee_id_idx" ON "payroll_records"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_records_status_idx" ON "payroll_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_employee_id_payroll_period_id_revision_key" ON "payroll_records"("employee_id", "payroll_period_id", "revision");

-- CreateIndex
CREATE INDEX "email_batches_payroll_period_id_idx" ON "email_batches"("payroll_period_id");

-- CreateIndex
CREATE INDEX "email_batches_status_idx" ON "email_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_deliveries_idempotency_key_key" ON "email_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "email_deliveries_batch_id_idx" ON "email_deliveries"("batch_id");

-- CreateIndex
CREATE INDEX "email_deliveries_payroll_record_id_idx" ON "email_deliveries"("payroll_record_id");

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "payroll_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_finalized_by_id_fkey" FOREIGN KEY ("finalized_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_batches" ADD CONSTRAINT "email_batches_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_batches" ADD CONSTRAINT "email_batches_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "email_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_payroll_record_id_fkey" FOREIGN KEY ("payroll_record_id") REFERENCES "payroll_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One company row, addressed as id 1.
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_singleton_chk" CHECK (id = 1);

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_chk" CHECK (email = lower(email));
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_email_lowercase_chk" CHECK (work_email = lower(work_email));

ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_month_chk" CHECK (month >= 1 AND month <= 12);
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_year_chk" CHECK (year >= 2000 AND year <= 2100);

ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_revision_chk" CHECK (revision >= 1);
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_days_chk" CHECK (
  total_working_days >= 0 AND paid_days >= 0 AND lop_days >= 0
);
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_earnings_chk" CHECK (
  basic_salary >= 0
  AND hra >= 0
  AND special_allowance >= 0
  AND other_allowances >= 0
  AND gross_earnings >= 0
  AND (overtime IS NULL OR overtime >= 0)
  AND (bonus IS NULL OR bonus >= 0)
);
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_deductions_chk" CHECK (
  total_deductions >= 0
  AND (employee_pf IS NULL OR employee_pf >= 0)
  AND (employee_esi IS NULL OR employee_esi >= 0)
  AND (professional_tax IS NULL OR professional_tax >= 0)
  AND (tds IS NULL OR tds >= 0)
  AND (salary_advance IS NULL OR salary_advance >= 0)
  AND (other_deductions IS NULL OR other_deductions >= 0)
);

ALTER TABLE "email_batches" ADD CONSTRAINT "email_batches_counts_chk" CHECK (
  total_count >= 0 AND sent_count >= 0 AND failed_count >= 0
);
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_attempts_chk" CHECK (attempts >= 0);

-- Keeps a single non-void payroll row per employee and period.
CREATE OR REPLACE FUNCTION payroll_records_sync_current_marker()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'VOID' THEN
    NEW.current_marker := NULL;
  ELSE
    NEW.current_marker := NEW.employee_id::text || ':' || NEW.payroll_period_id::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_records_sync_current_marker
BEFORE INSERT OR UPDATE OF status, employee_id, payroll_period_id
ON payroll_records
FOR EACH ROW
EXECUTE FUNCTION payroll_records_sync_current_marker();
