import { describe, expect, it, vi } from "vitest";

import { makeSsoCheckHandler } from "../../src/lib/sso-check";

type Session = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastActiveAt: Date;
};

function makeCtx(opts: {
  cookieValue?: string;
  accountId?: string;
  loginAccount: (arg: { accountId: string }) => Promise<void> | void;
}) {
  return {
    cookies: {
      get: vi.fn((_name: string, _opts?: { signed?: boolean }) => opts.cookieValue),
    },
    oidc: {
      session: {
        accountId: opts.accountId,
        loginAccount: vi.fn(opts.loginAccount),
      },
    },
  };
}

function makePrismaStub(initial: Session | null) {
  let row: Session | null = initial;
  return {
    session: {
      findUnique: vi.fn(async () => row),
      update: vi.fn(async ({ data }: { data: Partial<Session> }) => {
        if (row) row = { ...row, ...data } as Session;
        return row as Session;
      }),
    },
    _state: () => row,
  };
}

describe("ssoCookieCheck", () => {
  const baseSession: Session = {
    id: "sid-1",
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    lastActiveAt: new Date(0),
  };

  it("no cookie → returns NO_NEED_TO_PROMPT, does not touch session", async () => {
    const db = makePrismaStub(baseSession);
    const handler = makeSsoCheckHandler({ prisma: db as never, cookieName: "aiprd_sso" });
    const ctx = makeCtx({ loginAccount: () => {} });
    const result = await handler(ctx as never);
    expect(result).toBe(false);
    expect(db.session.findUnique).not.toHaveBeenCalled();
    expect(ctx.oidc.session.loginAccount).not.toHaveBeenCalled();
  });

  it("cookie but Session.revokedAt set → no login", async () => {
    const db = makePrismaStub({ ...baseSession, revokedAt: new Date() });
    const handler = makeSsoCheckHandler({ prisma: db as never, cookieName: "aiprd_sso" });
    const ctx = makeCtx({ cookieValue: "sid-1", loginAccount: () => {} });
    const result = await handler(ctx as never);
    expect(result).toBe(false);
    expect(ctx.oidc.session.loginAccount).not.toHaveBeenCalled();
  });

  it("expired Session → no login", async () => {
    const db = makePrismaStub({ ...baseSession, expiresAt: new Date(Date.now() - 1000) });
    const handler = makeSsoCheckHandler({ prisma: db as never, cookieName: "aiprd_sso" });
    const ctx = makeCtx({ cookieValue: "sid-1", loginAccount: () => {} });
    const result = await handler(ctx as never);
    expect(result).toBe(false);
    expect(ctx.oidc.session.loginAccount).not.toHaveBeenCalled();
  });

  it("already authenticated → skip lookup", async () => {
    const db = makePrismaStub(baseSession);
    const handler = makeSsoCheckHandler({ prisma: db as never, cookieName: "aiprd_sso" });
    const ctx = makeCtx({ cookieValue: "sid-1", accountId: "user-1", loginAccount: () => {} });
    const result = await handler(ctx as never);
    expect(result).toBe(false);
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });

  it("valid cookie → loginAccount called once with userId, lastActiveAt updated", async () => {
    const db = makePrismaStub(baseSession);
    const handler = makeSsoCheckHandler({ prisma: db as never, cookieName: "aiprd_sso" });
    const ctx = makeCtx({ cookieValue: "sid-1", loginAccount: () => {} });
    const result = await handler(ctx as never);
    expect(result).toBe(false);
    expect(ctx.oidc.session.loginAccount).toHaveBeenCalledTimes(1);
    expect(ctx.oidc.session.loginAccount).toHaveBeenCalledWith({ accountId: "user-1" });
    expect(db.session.update).toHaveBeenCalledTimes(1);
  });

  it("reads cookie with signed:false", async () => {
    const db = makePrismaStub(baseSession);
    const handler = makeSsoCheckHandler({ prisma: db as never, cookieName: "aiprd_sso" });
    const ctx = makeCtx({ cookieValue: "sid-1", loginAccount: () => {} });
    await handler(ctx as never);
    expect(ctx.cookies.get).toHaveBeenCalledWith("aiprd_sso", { signed: false });
  });
});
