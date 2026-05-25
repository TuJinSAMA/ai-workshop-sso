/**
 * Helper to create and send an email verification token.
 * Used from registration and change-email flows.
 */
import { prisma } from "./db";
import { emailService } from "./email";
import { emailVerificationEmail } from "./email-templates";
import { generateToken, hashToken, tokenExpiresAt, VERIFY_TOKEN_TTL_MINUTES } from "./tokens";

export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  // Invalidate any existing unused tokens for this user + email combo.
  await prisma.emailVerificationToken.updateMany({
    where: { userId, email, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const raw = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      email,
      tokenHash: hashToken(raw),
      expiresAt: tokenExpiresAt(VERIFY_TOKEN_TTL_MINUTES),
    },
  });

  const { subject, html, text } = emailVerificationEmail(raw, email);
  await emailService().send({ to: email, subject, html, text });
}
