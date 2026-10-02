/**
 * Sends queued payslip email in chunks of at most 10.
 *
 * Development: npm run email:work
 * Production: run the same command about once a minute.
 *
 * The command prints counts only. It does not print addresses, message text, or attachments.
 */
import { config } from "dotenv";

config();

async function main() {
  const { getEnv } = await import("../src/lib/env");
  const env = getEnv();
  if (!env.smtp) {
    console.log("SMTP is not configured. Queued mail was left untouched.");
    return;
  }

  const { PrismaClient } = await import("@prisma/client");
  const { createPrismaEmailAdapter } = await import("../src/server/email/adapter");
  const { EMAIL_CHUNK_LIMIT } = await import("../src/server/email/outcome");
  const { processEmailChunk } = await import("../src/server/email/process");
  const { createSmtpSender } = await import("../src/server/email/smtp");
  const prisma = new PrismaClient({ log: ["error"] });
  const sender = createSmtpSender(env.smtp);
  let stopRequested = false;
  const requestStop = () => {
    stopRequested = true;
  };
  process.on("SIGINT", requestStop);
  process.on("SIGTERM", requestStop);

  try {
    let idleRounds = 0;
    while (!stopRequested && idleRounds < 1) {
      const result = await processEmailChunk(createPrismaEmailAdapter(prisma), sender, {
        limit: EMAIL_CHUNK_LIMIT,
        pauseMs: 200,
      });
      console.log(`sent ${result.sent}, failed ${result.failed}, retrying ${result.retrying}`);
      if (result.stopped) {
        console.error("Mail server rejected the login. Remaining mail stays queued.");
        process.exitCode = 1;
        return;
      }
      if (result.claimed === 0) idleRounds += 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === "EnvironmentConfigError") console.error(error.message);
  else console.error(error instanceof Error ? error.name : "Email worker failed.");
  process.exitCode = 1;
});
