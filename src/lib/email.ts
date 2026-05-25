import { env } from "./env";

// Abstract email service so the concrete provider can be swapped
// (Resend / 阿里云邮件推送 / SES …). See spec Section 4 + 12.

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    console.log("[email:console]", { to: message.to, subject: message.subject });
    console.log(message.text ?? message.html);
  }
}

class ResendEmailService implements EmailService {
  async send(message: EmailMessage): Promise<void> {
    const e = env();
    if (!e.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    // Lazy import to avoid loading the SDK when not used.
    const { Resend } = await import("resend");
    const resend = new Resend(e.RESEND_API_KEY);
    await resend.emails.send({
      from: e.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

let cached: EmailService | null = null;
export function emailService(): EmailService {
  if (cached) return cached;
  const e = env();
  // Phase 0 default: log instead of sending (so the SSO flow can be tested
  // end-to-end without provisioning Resend/aliyun email). Switch to "resend"
  // in .env once the email service is opened up.
  if (e.EMAIL_PROVIDER === "resend") {
    if (!e.RESEND_API_KEY) {
      console.warn("[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is empty; falling back to console");
      cached = new ConsoleEmailService();
    } else {
      cached = new ResendEmailService();
    }
  } else {
    cached = new ConsoleEmailService();
  }
  return cached;
}
