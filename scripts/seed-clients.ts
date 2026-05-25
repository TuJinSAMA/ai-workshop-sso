/**
 * Register OAuth clients for known products (spec Section 12.8 / 13).
 * Usage:  pnpm seed:clients
 *
 * TODO(Phase 0): replace the hard-coded example below with real
 * clientId / redirectUris / postLogoutRedirectUris, and emit the
 * generated client_secret once (never persisted in plaintext).
 */
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "../src/lib/db";

async function main() {
  const clientId = "ai-course-copilot";
  const secret = randomBytes(32).toString("base64url");
  const secretHash = createHash("sha256").update(secret).digest("hex");

  await prisma.oAuthClient.upsert({
    where: { clientId },
    update: {},
    create: {
      clientId,
      clientSecretHash: secretHash,
      name: "AI Course Copilot",
      redirectUris: ["http://localhost:3001/api/auth/callback/sso"],
      postLogoutRedirectUris: ["http://localhost:3001"],
      allowedScopes: ["openid", "email", "profile", "offline_access"],
    },
  });

  console.log(`Client '${clientId}' upserted.`);
  console.log(`client_secret (save now, will NOT be shown again): ${secret}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
