import nodemailer from "nodemailer";
import type { SmtpConfig } from "@/lib/env";
import { toSmtpOptions, type OutboundMail } from "./message";
import type { MailSender } from "./process";

export function createSmtpSender(config: SmtpConfig): MailSender {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });

  return {
    async send(mail: OutboundMail) {
      const info = await transport.sendMail(toSmtpOptions(config.from, mail));
      return { response: typeof info.response === "string" ? info.response : "250 Accepted" };
    },
  };
}
