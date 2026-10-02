import "server-only";
import { timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { CSRF_HEADER, csrfCookieName } from "./constants";
import { isSameOrigin } from "./origin";

export function clientAddress(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headerList.get("x-real-ip")?.trim() || "unknown";
}

export async function requestIsSameOrigin(): Promise<boolean> {
  const headerList = await headers();
  return isSameOrigin(headerList.get("origin"), headerList.get("host"));
}

export async function csrfTokenFromRequest(): Promise<string> {
  const headerList = await headers();
  return headerList.get(CSRF_HEADER) ?? "";
}

function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function mutationGuard(formData: FormData): Promise<string | null> {
  if (!(await requestIsSameOrigin()) || !(await csrfIsValid(formData.get("csrf")))) {
    return "The form expired. Refresh the page and try again.";
  }
  return null;
}

export async function csrfIsValid(formValue: FormDataEntryValue | null): Promise<boolean> {
  if (typeof formValue !== "string" || formValue.length < 32) return false;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(csrfCookieName())?.value ?? "";
  return tokensMatch(formValue, cookieValue);
}
