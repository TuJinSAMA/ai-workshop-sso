import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes, createHash } from "node:crypto";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const CreateClientBody = z.object({
  clientId: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/, "must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1).max(128),
  redirectUris: z.array(z.url()).min(1),
  postLogoutRedirectUris: z.array(z.url()).default([]),
  allowedScopes: z.array(z.string()).default(["openid", "email", "profile", "offline_access"]),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const raw = await req.json().catch(() => null);
  const parsed = CreateClientBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { clientId, name, redirectUris, postLogoutRedirectUris, allowedScopes } = parsed.data;

  const existing = await prisma.oAuthClient.findUnique({ where: { clientId } });
  if (existing) {
    return NextResponse.json({ error: "client_exists" }, { status: 409 });
  }

  const secret = randomBytes(32).toString("base64url");
  const clientSecretHash = createHash("sha256").update(secret).digest("hex");

  await prisma.oAuthClient.create({
    data: { clientId, clientSecretHash, name, redirectUris, postLogoutRedirectUris, allowedScopes },
  });

  await audit({ event: "client_created", metadata: { clientId, name } });

  // Return client_secret only once — it is NOT stored in plaintext.
  return NextResponse.json({ clientId, clientSecret: secret, name, redirectUris, allowedScopes }, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const clients = await prisma.oAuthClient.findMany({
    select: {
      clientId: true,
      name: true,
      redirectUris: true,
      postLogoutRedirectUris: true,
      allowedScopes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ clients });
}
