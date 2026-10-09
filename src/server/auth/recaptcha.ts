import "server-only";
import { getEnv } from "@/lib/env";
import { logFailure } from "@/lib/log";

const SCORE_FLOOR = 0.5;

type SiteVerifyResponse = {
  success?: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

export async function verifyRecaptcha(
  token: FormDataEntryValue | null,
  expectedAction: string,
): Promise<string | null> {
  const config = getEnv().recaptcha;
  if (!config) {
    if (getEnv().nodeEnv === "production") {
      return "Security check is not configured.";
    }
    return null;
  }

  if (typeof token !== "string" || token.length < 20) {
    return "Security check failed. Refresh and try again.";
  }

  try {
    const body = new URLSearchParams({
      secret: config.secretKey,
      response: token,
    });
    const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      return "Security check failed. Try again.";
    }

    const result = (await response.json()) as SiteVerifyResponse;
    if (
      !result.success ||
      typeof result.score !== "number" ||
      result.score < SCORE_FLOOR ||
      result.action !== expectedAction
    ) {
      return "Security check failed. Try again.";
    }
    return null;
  } catch (error) {
    logFailure("auth.recaptcha", error);
    return "Security check failed. Try again.";
  }
}
