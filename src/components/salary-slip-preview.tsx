import Image from "next/image";
import type { CSSProperties } from "react";
import type { SalarySlipFields } from "@/server/payroll/payslip-document";

const width = 1414;
const height = 2000;

export function SalarySlipPreview({ slip }: { slip: SalarySlipFields }) {
  return (
    <div className="relative w-full bg-white [container-type:inline-size]">
      <Image
        src="/template/template.png"
        alt=""
        width={width}
        height={height}
        priority
        className="h-auto w-full"
      />
      <div className="absolute inset-0">
        <Field box={{ x: 725, y: 316, w: 400, h: 24 }}>{slip.salaryMonth}</Field>
        <Field box={{ x: 314, y: 421, w: 380, h: 60 }}>{slip.employeeName}</Field>
        <Field box={{ x: 946, y: 421, w: 380, h: 60 }}>{slip.employeeNumber}</Field>
        <Field box={{ x: 314, y: 482, w: 380, h: 60 }}>{slip.designation}</Field>
        <Field box={{ x: 946, y: 482, w: 380, h: 60 }}>{slip.department}</Field>
        <Field box={{ x: 314, y: 542, w: 380, h: 60 }}>{slip.payPeriod}</Field>
        <Field box={{ x: 946, y: 542, w: 380, h: 60 }}>{slip.paidDays}</Field>
        <Field box={{ x: 314, y: 602, w: 380, h: 60 }}>{slip.lopDays}</Field>
        <Field box={{ x: 946, y: 602, w: 380, h: 60 }}>{slip.paymentStatus}</Field>
        <Amount box={{ x: 510, y: 803, w: 168, h: 51 }}>{slip.basic}</Amount>
        <Amount box={{ x: 1144, y: 803, w: 168, h: 51 }}>{slip.epf}</Amount>
        <Amount box={{ x: 510, y: 855, w: 168, h: 51 }}>{slip.hra}</Amount>
        <Amount box={{ x: 1144, y: 855, w: 168, h: 51 }}>{slip.esi}</Amount>
        <Amount box={{ x: 510, y: 907, w: 168, h: 51 }}>{slip.conveyance}</Amount>
        <Amount box={{ x: 1144, y: 907, w: 168, h: 51 }}>{slip.professionalTax}</Amount>
        <Amount box={{ x: 510, y: 959, w: 168, h: 51 }}>{slip.special}</Amount>
        <Amount box={{ x: 1144, y: 959, w: 168, h: 51 }}>{slip.otherDeductions}</Amount>
        <Amount box={{ x: 510, y: 1012, w: 168, h: 51 }} bold>{slip.gross}</Amount>
        <Amount box={{ x: 1144, y: 1012, w: 168, h: 51 }} bold>{slip.totalDeductions}</Amount>
        <Amount box={{ x: 1172, y: 1112, w: 155, h: 68 }} bold light>{slip.net}</Amount>
        <div className="absolute bg-white" style={place(70, 1190, 1270, 52)} />
        <Field box={{ x: 91, y: 1196, w: 1240, h: 40 }} wrap>
          {slip.amountInWords ? `Amount in words: ${slip.amountInWords}` : ""}
        </Field>
        {slip.voidNote ? (
          <Field box={{ x: 91, y: 1472, w: 1220, h: 36 }} wrap>
            {slip.voidNote}
          </Field>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  box,
  children,
  wrap = false,
}: {
  box: { x: number; y: number; w: number; h: number };
  children: string;
  wrap?: boolean;
}) {
  return (
    <div
      className={`absolute flex items-center overflow-hidden text-[1.55cqw] leading-tight text-text ${wrap ? "" : "whitespace-nowrap"}`}
      style={place(box.x, box.y, box.w, box.h)}
    >
      <span className={wrap ? "line-clamp-2" : "truncate"}>{children}</span>
    </div>
  );
}

function Amount({
  box,
  children,
  bold = false,
  light = false,
}: {
  box: { x: number; y: number; w: number; h: number };
  children: string;
  bold?: boolean;
  light?: boolean;
}) {
  return (
    <div
      className={`absolute flex items-center justify-end overflow-hidden text-right text-[1.55cqw] leading-none tabular-nums ${bold ? "font-semibold" : ""} ${light ? "text-[1.9cqw] text-on-accent" : "text-text"}`}
      style={place(box.x, box.y, box.w, box.h)}
    >
      <span className="truncate">{children}</span>
    </div>
  );
}

function place(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    left: `${(x / width) * 100}%`,
    top: `${(y / height) * 100}%`,
    width: `${(w / width) * 100}%`,
    height: `${(h / height) * 100}%`,
  };
}
