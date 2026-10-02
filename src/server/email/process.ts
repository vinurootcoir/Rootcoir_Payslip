import { PermanentMailError, type OutboundMail } from "./message";
import { cappedChunkLimit, classifyMailError, decideDeliveryOutcome, type SendResult } from "./outcome";

export type ClaimedDelivery = {
  id: string;
  batchId: string;
  payrollRecordId: string;
  recipientEmail: string;
  recipientName: string;
  attempts: number;
};

export type EmailQueueAdapter = {
  failStale(now: Date): Promise<void>;
  claim(limit: number, now: Date): Promise<ClaimedDelivery[]>;
  loadMail(delivery: ClaimedDelivery): Promise<OutboundMail>;
  finish(
    delivery: ClaimedDelivery,
    decision: { status: "SENT" | "FAILED" | "RETRYING"; error: string | null; response: string | null },
  ): Promise<void>;
};

export type MailSender = {
  send(mail: OutboundMail): Promise<{ response: string }>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function processEmailChunk(
  adapter: EmailQueueAdapter,
  sender: MailSender,
  options: { limit: number; now?: Date; pauseMs?: number; sleep?: (ms: number) => Promise<void> },
): Promise<{ claimed: number; sent: number; failed: number; retrying: number; stopped: boolean }> {
  const now = options.now ?? new Date();
  const limit = cappedChunkLimit(options.limit);
  const pauseMs = options.pauseMs ?? 0;
  const wait = options.sleep ?? sleep;
  await adapter.failStale(now);

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let retrying = 0;
  let stopped = false;

  while (claimed < limit) {
    const [delivery] = await adapter.claim(1, now);
    if (!delivery) break;
    claimed += 1;
    let result: SendResult;
    try {
      const mail = await adapter.loadMail(delivery);
      if (mail.to !== delivery.recipientEmail.trim().toLowerCase()) {
        throw new PermanentMailError("Recipient did not match the queued employee.");
      }
      const accepted = await sender.send(mail);
      result = { ok: true, response: accepted.response };
    } catch (error) {
      if (error instanceof PermanentMailError) {
        result = { ok: false, kind: "permanent", message: error.message };
      } else if (typeof error === "object" && error && ("responseCode" in error || "code" in error)) {
        result = { ok: false, ...classifyMailError(error) };
      } else {
        result = { ok: false, kind: "transient", message: "The payslip could not be prepared." };
      }
    }
    const decision = decideDeliveryOutcome(delivery.attempts, result);
    await adapter.finish(delivery, decision);
    if (decision.status === "SENT") sent += 1;
    else if (decision.status === "FAILED") failed += 1;
    else retrying += 1;
    if (decision.stop) {
      stopped = true;
      break;
    }
    if (claimed < limit && pauseMs > 0) await wait(pauseMs);
  }

  return { claimed, sent, failed, retrying, stopped };
}
