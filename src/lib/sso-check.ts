import type { KoaContextWithOIDC } from "oidc-provider";

import { env } from "./env";
import { prisma } from "./db";

// SSO short-circuit Check for oidc-provider's login prompt.
//
// Mounted at the front of the `login` prompt's `checks` array so it runs
// before the built-in `no_session` check (which would otherwise force a
// /login interaction). If our SSO cookie (`aiprd_sso`) maps to a live,
// non-revoked Prisma `Session`, we stamp `accountId` into the OIDC session
// and let the rest of the policy fall through — `no_session` then sees an
// authenticated session and returns NO_NEED_TO_PROMPT, completing the
// authorize request without bouncing the browser to /login.
//
// Reference: node_modules/oidc-provider/lib/helpers/interaction_policy/prompts/login.js
// (the `no_session` Check we run in front of).

export const SSO_CHECK_REASON = "sso_cookie";
export const SSO_CHECK_DESCRIPTION = "trying SSO cookie";

export type SsoCheckDeps = {
  prisma: Pick<typeof prisma, "session">;
  cookieName: string;
  now?: () => Date;
};

// NO_NEED_TO_PROMPT === false in oidc-provider; we return it whether or not
// we hydrated the session. (If we didn't, the next Check — `no_session` —
// will trigger the prompt as usual.)
const NO_NEED_TO_PROMPT = false as const;

export function makeSsoCheckHandler(deps: SsoCheckDeps) {
  const now = deps.now ?? (() => new Date());
  return async function ssoCookieCheck(ctx: KoaContextWithOIDC): Promise<false> {
    const oidcSession = ctx.oidc.session;
    if (!oidcSession) return NO_NEED_TO_PROMPT;
    if (oidcSession.accountId) return NO_NEED_TO_PROMPT;

    const sid = ctx.cookies.get(deps.cookieName, { signed: false });
    if (!sid) return NO_NEED_TO_PROMPT;

    const session = await deps.prisma.session.findUnique({ where: { id: sid } });
    const at = now();
    if (!session || session.revokedAt || session.expiresAt < at) {
      return NO_NEED_TO_PROMPT;
    }

    await deps.prisma.session.update({
      where: { id: sid },
      data: { lastActiveAt: at },
    });

    await oidcSession.loginAccount({ accountId: session.userId });
    return NO_NEED_TO_PROMPT;
  };
}

// Lazy default handler — defers env() lookup until first invocation so
// importing this module doesn't require the full env to be loaded.
let cached: ((ctx: KoaContextWithOIDC) => Promise<false>) | null = null;
export async function ssoCookieCheck(ctx: KoaContextWithOIDC): Promise<false> {
  if (!cached) {
    cached = makeSsoCheckHandler({ prisma, cookieName: env().SSO_COOKIE_NAME });
  }
  return cached(ctx);
}
