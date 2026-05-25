import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { readSsoCookie } from "@/lib/cookies";
import { sendVerificationEmail } from "@/lib/email-verification";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sid = await readSsoCookie();
  if (!sid) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const session = await prisma.session.findUnique({ where: { id: sid } });
  if (!session || session.revokedAt) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (user.emailVerified) {
    return NextResponse.json({ ok: true, message: "邮箱已验证。" });
  }

  await sendVerificationEmail(user.id, user.email);

  const isJson = (req.headers.get("content-type") ?? "").includes("application/json");
  if (isJson) return NextResponse.json({ ok: true, message: "验证邮件已发送。" });
  return new NextResponse(null, { status: 303, headers: { Location: "/account?message=verification_sent" } });
}
