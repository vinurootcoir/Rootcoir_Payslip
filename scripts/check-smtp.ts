/**
 * Prints SMTP readiness only. Never prints secrets, addresses, or passwords.
 */
import { config } from "dotenv";

config();

async function main() {
  const { getEnv } = await import("../src/lib/env");
  let env;
  try {
    env = getEnv();
  } catch (error) {
    console.log(error instanceof Error ? error.message : "Invalid environment.");
    process.exitCode = 1;
    return;
  }

  const user = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD?.trim() ?? "";
  const from = process.env.SMTP_FROM?.trim() ?? "";

  console.log(
    JSON.stringify(
      {
        smtpConfigured: env.smtp !== null,
        host: process.env.SMTP_HOST?.trim() || null,
        port: process.env.SMTP_PORT?.trim() || null,
        secure: process.env.SMTP_SECURE?.trim() || null,
        userSet: user.length > 0,
        passwordSet: password.length > 0,
        fromSet: from.length > 0,
        userLooksLikeEmail: user.includes("@"),
        fromLooksLikeEmail: from.includes("@"),
        userMatchesFrom: user.length > 0 && from.length > 0 && user.toLowerCase() === from.toLowerCase(),
      },
      null,
      2,
    ),
  );

  if (!env.smtp) {
    console.log("SMTP is not loaded by the app. Check every SMTP_* value is non-empty.");
    process.exitCode = 1;
    return;
  }

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password },
  });

  try {
    await transport.verify();
    console.log("SMTP login succeeded.");
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const code =
      error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;
    const responseCode =
      error && typeof error === "object" && "responseCode" in error
        ? String((error as { responseCode: unknown }).responseCode)
        : null;
    console.log(
      JSON.stringify({
        smtpLogin: "failed",
        name,
        code,
        responseCode,
      }),
    );
    console.log("Gmail usually needs an App Password, SMTP_USER = full email, and SMTP_SECURE=false for port 587.");
    process.exitCode = 1;
  }
}

main();
