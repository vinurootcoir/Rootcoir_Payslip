import assert from "node:assert/strict";
import test from "node:test";
import { payslipAmounts } from "../src/server/employees/salary";

test("employee salary becomes the payslip split", () => {
  const result = payslipAmounts(
    {
      basicSalary: "20000",
      hra: "8000",
      specialAllowance: "2000",
      otherAllowances: "0",
      employeePf: "1800",
      employeeEsi: "0",
      professionalTax: "200",
      tds: "0",
    },
    "INR",
  );

  assert.equal(result.basicSalary, "20000.00");
  assert.equal(result.grossEarnings, "30000.00");
  assert.equal(result.employeePf, "1800.00");
  assert.equal(result.employeeEsi, null);
  assert.equal(result.professionalTax, "200.00");
  assert.equal(result.tds, null);
  assert.equal(result.totalDeductions, "2000.00");
  assert.equal(result.netPay, "28000.00");
  assert.deepEqual(result.errors, []);
});

test("monthly extras stay on the draft when salary is applied", () => {
  const result = payslipAmounts(
    {
      basicSalary: "10000",
      hra: "0",
      specialAllowance: "0",
      otherAllowances: "0",
      employeePf: "0",
      employeeEsi: "0",
      professionalTax: "0",
      tds: "0",
    },
    "INR",
    { overtime: "500", salaryAdvance: "1000" },
  );

  assert.equal(result.grossEarnings, "10500.00");
  assert.equal(result.totalDeductions, "1000.00");
  assert.equal(result.netPay, "9500.00");
});
