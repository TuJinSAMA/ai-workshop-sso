import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

// Each record from the source product (e.g. ai-course-copilot).
// passwordHash / passwordAlgo are preserved so existing users can keep
// logging in with their old password; verifyAndUpgrade() will transparently
// re-hash to argon2id on first successful login.
const RecordSchema = z.object({
  email: z.email().max(254),
  displayName: z.string().max(128).optional(),
  avatarUrl: z.string().url().optional(),
  passwordHash: z.string().optional(),
  passwordAlgo: z.enum(["argon2id", "bcrypt"]).default("bcrypt"),
  legacySalt: z.string().optional(),
  emailVerified: z.boolean().default(false),
});

const ImportBody = z.object({
  records: z.array(RecordSchema).min(1).max(1000),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await req.json().catch(() => null);
  const parsed = ImportBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { records } = parsed.data;
  const results: Array<{ email: string; centralUserId: string; created: boolean }> = [];
  const errors: Array<{ email: string; reason: string }> = [];

  for (const record of records) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: record.email } });
      if (existing) {
        results.push({ email: record.email, centralUserId: existing.id, created: false });
        continue;
      }

      const user = await prisma.user.create({
        data: {
          email: record.email,
          displayName: record.displayName ?? null,
          avatarUrl: record.avatarUrl ?? null,
          passwordHash: record.passwordHash ?? null,
          passwordAlgo: record.passwordAlgo,
          legacySalt: record.legacySalt ?? null,
          emailVerified: record.emailVerified,
          status: "ACTIVE",
        },
      });

      await audit({
        event: "register",
        userId: user.id,
        metadata: { source: "legacy_import", algo: record.passwordAlgo },
      });

      results.push({ email: record.email, centralUserId: user.id, created: true });
    } catch (err) {
      errors.push({ email: record.email, reason: String(err) });
    }
  }

  const status = errors.length > 0 && results.length === 0 ? 422 : 200;
  return NextResponse.json({ imported: results.length, errors, results }, { status });
}
