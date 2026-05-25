import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory fake of the prisma.oidcModel surface used by PrismaAdapter.
type Row = {
  id: string;
  model: string;
  payload: Record<string, unknown>;
  expiresAt: Date | null;
  grantId: string | null;
  userCode: string | null;
  uid: string | null;
  consumed: boolean;
  createdAt: Date;
};

// vi.mock factories are hoisted; build a self-contained fake inside.
vi.mock("../../src/lib/db", () => {
  const store = new Map<string, Row>();
  const oidcModel = {
    async upsert({ where, update, create }: { where: { id: string }; update: Partial<Row>; create: Partial<Row> }) {
      const existing = store.get(where.id);
      if (existing) {
        store.set(where.id, { ...existing, ...update } as Row);
      } else {
        const merged = { ...(create as Row) } as Row;
        if (!merged.createdAt) merged.createdAt = new Date();
        store.set(where.id, merged);
      }
    },
    async findUnique({ where }: { where: { id: string } }) {
      return store.get(where.id) ?? null;
    },
    async findFirst({ where }: { where: Partial<Row> }) {
      for (const row of [...store.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
        let match = true;
        for (const [k, v] of Object.entries(where)) {
          if ((row as Record<string, unknown>)[k] !== v) {
            match = false;
            break;
          }
        }
        if (match) return row;
      }
      return null;
    },
    async update({ where, data }: { where: { id: string }; data: Partial<Row> }) {
      const row = store.get(where.id);
      if (!row) throw new Error("not found");
      store.set(where.id, { ...row, ...data });
    },
    async deleteMany({ where }: { where: { id?: string; grantId?: string } }) {
      for (const [k, v] of store) {
        if (where.id && v.id !== where.id) continue;
        if (where.grantId && v.grantId !== where.grantId) continue;
        store.delete(k);
      }
    },
  };
  return { prisma: { oidcModel }, __store: store };
});

import { prisma as mockedPrisma } from "../../src/lib/db";
import { PrismaAdapter } from "../../src/lib/oidc-adapter";

const store = (await import("../../src/lib/db")) as unknown as { __store: Map<string, Row> };

beforeEach(() => store.__store.clear());
void mockedPrisma;

describe("PrismaAdapter", () => {
  it("upsert + find round-trip", async () => {
    const a = new PrismaAdapter("AccessToken");
    await a.upsert("abc", { jti: "abc", iat: 1 } as never, 60);
    const found = await a.find("abc");
    expect(found).toMatchObject({ jti: "abc" });
  });

  it("find returns undefined when expired", async () => {
    const a = new PrismaAdapter("AccessToken");
    await a.upsert("e1", { foo: 1 } as never, -1); // already expired
    expect(await a.find("e1")).toBeUndefined();
  });

  it("consume sets consumed flag and stamps payload.consumed", async () => {
    const a = new PrismaAdapter("RefreshToken");
    await a.upsert("r1", { grantId: "g1" } as never, 60);
    await a.consume("r1");
    const row = store.__store.get("RefreshToken:r1");
    expect(row?.consumed).toBe(true);
    expect((row?.payload as { consumed?: number }).consumed).toBeGreaterThan(0);
  });

  it("destroy removes the row", async () => {
    const a = new PrismaAdapter("AccessToken");
    await a.upsert("d1", { x: 1 } as never, 60);
    await a.destroy("d1");
    expect(await a.find("d1")).toBeUndefined();
  });

  it("revokeByGrantId removes every row with the grant", async () => {
    const at = new PrismaAdapter("AccessToken");
    const rt = new PrismaAdapter("RefreshToken");
    await at.upsert("a1", { grantId: "G" } as never, 60);
    await rt.upsert("r1", { grantId: "G" } as never, 60);
    await rt.upsert("r2", { grantId: "OTHER" } as never, 60);
    await at.revokeByGrantId("G");
    expect(await at.find("a1")).toBeUndefined();
    expect(await rt.find("r1")).toBeUndefined();
    expect(await rt.find("r2")).toBeDefined();
  });

  it("findByUid returns the matching session", async () => {
    const a = new PrismaAdapter("Session");
    await a.upsert("s1", { uid: "u-1" } as never, 60);
    const found = await a.findByUid("u-1");
    expect(found).toMatchObject({ uid: "u-1" });
  });
});
