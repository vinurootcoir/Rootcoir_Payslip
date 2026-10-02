import Decimal from "decimal.js";
import { toMoney } from "@/lib/money";

const BELOW_TWENTY = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(value: number): string {
  if (value < 20) return BELOW_TWENTY[value] ?? "";
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return ones === 0 ? TENS[tens] ?? "" : `${TENS[tens]} ${BELOW_TWENTY[ones]}`;
}

function belowThousand(value: number): string {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const hundredWords = hundreds > 0 ? `${BELOW_TWENTY[hundreds]} Hundred` : "";
  const restWords = rest > 0 ? belowHundred(rest) : "";
  return [hundredWords, restWords].filter(Boolean).join(" ");
}

function integerWords(value: Decimal): string {
  if (value.isZero()) return "Zero";
  if (value.gte(10_000_000)) {
    const crores = value.div(10_000_000).floor();
    const rest = value.mod(10_000_000);
    return [integerWords(crores) + " Crore", rest.isZero() ? "" : integerWords(rest)].filter(Boolean).join(" ");
  }
  if (value.gte(100_000)) {
    const lakhs = value.div(100_000).floor();
    const rest = value.mod(100_000);
    return [`${belowHundred(lakhs.toNumber())} Lakh`, rest.isZero() ? "" : integerWords(rest)].filter(Boolean).join(" ");
  }
  if (value.gte(1000)) {
    const thousands = value.div(1000).floor();
    const rest = value.mod(1000);
    return [`${belowHundred(thousands.toNumber())} Thousand`, rest.isZero() ? "" : belowThousand(rest.toNumber())]
      .filter(Boolean)
      .join(" ");
  }
  return belowThousand(value.toNumber());
}

/** Indian rupee words from a rounded money amount. Paise use the same half-up scale. */
export function amountInWords(value: Decimal.Value, currency = "INR"): string {
  const money = toMoney(value);
  const negative = money.isNeg();
  const absolute = money.abs();
  const rupees = absolute.trunc();
  const paise = absolute.minus(rupees).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
  const rupeeWords = integerWords(rupees);
  const unit = currency === "INR" ? "Rupees" : currency;
  const paiseWords = paise > 0 ? ` and ${belowHundred(paise)} Paise` : "";
  return `${negative ? "Minus " : ""}${rupeeWords} ${unit}${paiseWords} Only`;
}
