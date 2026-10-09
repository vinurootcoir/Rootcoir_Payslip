import nodemailer from "nodemailer";
import type { SmtpConfig } from "@/lib/env";
import { toSmtpOptions, type OutboundMail } from "./message";
import type { MailSender } from "./process";

function createTransport(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.user, pass: config.password },
  });
}

export function createSmtpSender(config: SmtpConfig): MailSender {
  const transport = createTransport(config);

  return {
    async send(mail: OutboundMail) {
      const info = await transport.sendMail(toSmtpOptions(config.from, mail));
      return { response: typeof info.response === "string" ? info.response : "250 Accepted" };
    },
  };
}

export async function sendTextMail(
  config: SmtpConfig,
  mail: { to: string; subject: string; text: string },
): Promise<void> {
  const transport = createTransport(config);
  await transport.sendMail({
    from: config.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
}
