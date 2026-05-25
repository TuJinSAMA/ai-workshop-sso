/**
 * Rotate JWKS signing key (spec Section 12.5).
 * Usage:  pnpm rotate:keys
 */
import { rotateSigningKey } from "../src/lib/jwks";
import { prisma } from "../src/lib/db";

async function main() {
  const kid = await rotateSigningKey();
  console.log(`Rotated. New ACTIVE kid: ${kid}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
