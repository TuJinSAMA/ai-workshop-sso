/**
 * Import historical users from ai-course-copilot (spec Section 12.8 / 13).
 *
 * TODO(Phase 1):
 *   - Accept input from stdin or a JSON file: [{email, passwordHash, passwordAlgo, legacySalt, displayName}]
 *   - Insert into User table preserving the original hash + algo (so the user
 *     can keep logging in with their old password; verifyAndUpgrade() will
 *     transparently re-hash to argon2id on first successful login).
 *   - Echo back centralUserId so the source project can persist it.
 */
import { prisma } from "../src/lib/db";

async function main() {
  console.log("TODO: implement legacy user import");
  console.log("Connection check:", await prisma.user.count(), "users in DB");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
