import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires a driver adapter for runtime. We use the pg driver since
// DATABASE_URL is a standard postgres:// connection string.
//
// PrismaClient singleton (avoid exhausting connections in dev hot-reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function build(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? build();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
