/**
 * Import historical users from ai-course-copilot into the SSO central DB.
 * Spec: Section 12.8 / 13.
 *
 * Usage:
 *   # From a JSON file
 *   pnpm import:legacy --file users.json
 *
 *   # From stdin (pipe)
 *   cat users.json | pnpm import:legacy
 *
 * Input format (JSON array):
 * [
 *   {
 *     "email": "user@example.com",
 *     "passwordHash": "$2b$10$...",     // bcrypt hash from ai-course-copilot
 *     "passwordAlgo": "bcrypt",          // default: "bcrypt"
 *     "legacySalt": null,                // external salt if any
 *     "displayName": "Alice",
 *     "emailVerified": true
 *   }
 * ]
 *
 * Output: newline-delimited JSON, one line per record:
 *   {"email":"user@example.com","centralUserId":"uuid...","created":true}
 *   {"email":"other@example.com","centralUserId":"uuid...","created":false}  // already existed
 *   {"email":"bad@example.com","error":"..."}  // failed
 *
 * The source project (ai-course-copilot) should read this output and persist
 * centralUserId against each local user row.
 */

import "dotenv/config";
import { createReadStream } from "node:fs";
import { argv, stdin as processStdin, stdout } from "node:process";
import { prisma } from "../src/lib/db";
import { audit } from "../src/lib/audit";

const BATCH_SIZE = 100;

interface InputRecord {
  email: string;
  passwordHash?: string;
  passwordAlgo?: "argon2id" | "bcrypt";
  legacySalt?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
}

async function readInput(): Promise<InputRecord[]> {
  const fileArg = argv.indexOf("--file");
  let raw: string;

  if (fileArg !== -1 && argv[fileArg + 1]) {
    const { readFileSync } = await import("node:fs");
    raw = readFileSync(argv[fileArg + 1]!, "utf-8");
  } else {
    const chunks: Buffer[] = [];
    const stream = process.stdin.isTTY ? null : processStdin;
    if (!stream) {
      console.error("Usage: pnpm import:legacy --file users.json  OR  cat users.json | pnpm import:legacy");
      process.exit(1);
    }
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    raw = Buffer.concat(chunks).toString("utf-8");
  }

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Input must be a JSON array");
  return parsed as InputRecord[];
}

async function importBatch(records: InputRecord[]): Promise<void> {
  for (const record of records) {
    if (!record.email) {
      stdout.write(JSON.stringify({ error: "missing email", record }) + "\n");
      continue;
    }

    try {
      const existing = await prisma.user.findUnique({ where: { email: record.email } });
      if (existing) {
        stdout.write(JSON.stringify({ email: record.email, centralUserId: existing.id, created: false }) + "\n");
        continue;
      }

      const user = await prisma.user.create({
        data: {
          email: record.email,
          displayName: record.displayName ?? null,
          avatarUrl: record.avatarUrl ?? null,
          passwordHash: record.passwordHash ?? null,
          passwordAlgo: record.passwordAlgo ?? "bcrypt",
          legacySalt: record.legacySalt ?? null,
          emailVerified: record.emailVerified ?? false,
          status: "ACTIVE",
        },
      });

      await audit({
        event: "register",
        userId: user.id,
        metadata: { source: "legacy_import", algo: record.passwordAlgo ?? "bcrypt" },
      });

      stdout.write(JSON.stringify({ email: record.email, centralUserId: user.id, created: true }) + "\n");
    } catch (err) {
      stdout.write(JSON.stringify({ email: record.email, error: String(err) }) + "\n");
    }
  }
}

async function main(): Promise<void> {
  console.error("[import] Reading input...");
  const records = await readInput();
  console.error(`[import] Processing ${records.length} records in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await importBatch(batch);
    console.error(`[import] ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} processed`);
  }

  console.error("[import] Done.");
}

// Allow this file to be imported without running main (e.g. tests).
void createReadStream; // suppress unused warning
main()
  .catch((err) => {
    console.error("[import] Fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
