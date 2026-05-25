import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";

const PatchBody = z.object({
  displayName: z.string().max(128).optional(),
  avatarUrl: z.string().url().optional(),
  emailVerified: z.boolean().optional(),
}).strict();

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      passwordAlgo: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const raw = await req.json().catch(() => null);
  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      email: true,
      emailVerified: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ user: updated });
}
