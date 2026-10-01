import Decimal from "decimal.js";

/**
 * Payroll money is stored as NUMERIC(14, 2) and day counts as NUMERIC(6, 2).
 * Both round half away from zero (ROUND_HALF_UP) at two decimal places.
 * Components are summed after each has been rounded, then the total is rounded
 * again. Statutory rates are not applied here.
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export const MONEY_SCALE = 2;
export const DAY_SCALE = 2;

export function toMoney(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function toDays(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(DAY_SCALE, Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: Decimal.Value[]): Decimal {
  const total = values.reduce<Decimal>(
    (sum, value) => sum.plus(toMoney(value)),
    new Decimal(0),
  );
  return toMoney(total);
}
