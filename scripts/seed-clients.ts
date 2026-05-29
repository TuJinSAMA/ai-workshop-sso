/**
 * Register OAuth clients for known products (spec Section 12.8 / 13).
 * Usage:  pnpm seed:clients
 *
 * TODO(Phase 0): replace the hard-coded example below with real
 * clientId / redirectUris / postLogoutRedirectUris, and emit the
 * generated client_secret once (never persisted in plaintext).
 */
import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../src/lib/db";

const CLIENTS = [
  {
    clientId: "ai-course-copilot",
    name: "AI Course Copilot",
    redirectUris: [
      "http://localhost:3001/api/auth/callback/sso",
      "http://localhost:5002/api/auth/callback/sso",
      "https://course.aiprd.club/api/auth/callback/sso",
    ],
    postLogoutRedirectUris: [
      "http://localhost:3001",
      "http://localhost:5002",
      "https://course.aiprd.club",
    ],
    allowedScopes: ["openid", "email", "profile", "offline_access"],
  },
  {
    clientId: "aiprd",
    name: "AIPRD",
    redirectUris: [
      "http://localhost:5173/api/auth/callback/sso",
      "https://aiprd.club/api/auth/callback/sso",
    ],
    postLogoutRedirectUris: [
      "http://localhost:5173",
      "https://aiprd.club",
    ],
    allowedScopes: ["openid", "email", "profile", "offline_access"],
  },
];

async function main() {
  const rotateSecret = process.env.ROTATE_SECRET === "1";

  for (const c of CLIENTS) {
    const existing = await prisma.oAuthClient.findUnique({
      where: { clientId: c.clientId },
    });

    let plainSecret: string | null = null;
    // Reuse the existing hash for the create input so upsert's create branch
    // stays valid (Prisma validates both branches) even when we only update.
    let secretHash: string | undefined = existing?.clientSecretHash;
    if (!existing || rotateSecret) {
      plainSecret = randomBytes(32).toString("base64url");
      secretHash = createHash("sha256").update(plainSecret).digest("hex");
    }

    await prisma.oAuthClient.upsert({
      where: { clientId: c.clientId },
      update: {
        name: c.name,
        redirectUris: c.redirectUris,
        postLogoutRedirectUris: c.postLogoutRedirectUris,
        allowedScopes: c.allowedScopes,
        ...(plainSecret ? { clientSecretHash: secretHash } : {}),
      },
      create: {
        clientId: c.clientId,
        clientSecretHash: secretHash!,
        name: c.name,
        redirectUris: c.redirectUris,
        postLogoutRedirectUris: c.postLogoutRedirectUris,
        allowedScopes: c.allowedScopes,
      },
    });

    if (plainSecret) {
      const action = existing ? "rotated" : "created";
      console.log(`Client '${c.clientId}' ${action}.`);
      console.log(
        `  client_secret (save now, will NOT be shown again): ${plainSecret}`,
      );
    } else {
      console.log(
        `Client '${c.clientId}' updated (secret unchanged; pass ROTATE_SECRET=1 to rotate).`,
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
