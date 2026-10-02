import "server-only";
import { getEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { createPrismaEmailAdapter } from "./adapter";
import { EMAIL_CHUNK_LIMIT } from "./outcome";
import { processEmailChunk } from "./process";
import { createSmtpSender } from "./smtp";
import { logFailure } from "@/lib/log";

export function mailIsConfigured(): boolean {
  return getEnv().smtp !== null;
}

export async function kickEmailQueue(): Promise<void> {
  try {
    const smtp = getEnv().smtp;
    if (!smtp) return;
    await processEmailChunk(createPrismaEmailAdapter(getDb()), createSmtpSender(smtp), {
      limit: EMAIL_CHUNK_LIMIT,
      pauseMs: 200,
    });
  } catch (error) {
    logFailure("email.kick", error);
  }
}
