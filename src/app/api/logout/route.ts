import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { clearSsoCookie, readSsoCookie } from "@/lib/cookies";

// POST is the real action (form submit). GET is allowed as a convenience so
// `<a href="/api/logout">` works from rendered pages; both end up at /.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return logout(req);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return logout(req);
}

async function logout(req: NextRequest): Promise<NextResponse> {
  const sid = await readSsoCookie();
  let userId: string | null = null;
  if (sid) {
    const session = await prisma.session.findUnique({ where: { id: sid } });
    if (session && !session.revokedAt) {
      await prisma.session.update({
        where: { id: sid },
        data: { revokedAt: new Date() },
      });
      userId = session.userId;
    }
  }
  await clearSsoCookie();
  await audit({
    event: "logout",
    userId,
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent") ?? null,
  });
  return new NextResponse(null, {
    status: 303,
    headers: { Location: new URL("/", req.url).toString() },
  });
}
