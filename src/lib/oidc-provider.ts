import type Provider from "oidc-provider";
import { env } from "./env";
import { prisma } from "./db";
import { getAllPublicJwks, getCurrentSigningKey } from "./jwks";

// oidc-provider configuration (spec Section 12.3).
//
// This module returns a lazily-initialised Provider singleton. The full
// adapter (Prisma-backed storage for AuthorizationCode / RefreshToken /
// Client / Session) and findAccount() implementation will be filled in during
// Phase 0 implementation; the skeleton below documents the intended wiring.

let providerPromise: Promise<Provider> | null = null;

export function getProvider(): Promise<Provider> {
  if (!providerPromise) providerPromise = buildProvider();
  return providerPromise;
}

async function buildProvider(): Promise<Provider> {
  const { default: ProviderCtor } = await import("oidc-provider");
  const e = env();

  const currentKey = await getCurrentSigningKey();
  const jwks = await getAllPublicJwks();

  const provider = new ProviderCtor(e.ISSUER_URL, {
    // TODO(Phase 0): plug Prisma adapter — see spec Section 12.3
    // adapter: PrismaAdapter,

    clients: [], // loaded via adapter in production

    pkce: { required: () => true },

    cookies: {
      keys: [e.COOKIE_SECRET],
      long: { signed: true, httpOnly: true, sameSite: "lax" },
      short: { signed: true, httpOnly: true, sameSite: "lax" },
    },

    jwks,
    // The current signing key is also exposed so oidc-provider can sign
    // id_tokens with the same kid that the JWKS endpoint advertises.
    // (Wiring is done via the adapter; this just keeps a reference handy.)

    ttl: {
      AccessToken: e.ACCESS_TOKEN_TTL_MINUTES * 60,
      IdToken: e.ACCESS_TOKEN_TTL_MINUTES * 60,
      RefreshToken: e.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      AuthorizationCode: e.AUTH_CODE_TTL_MINUTES * 60,
      Session: e.SSO_COOKIE_TTL_DAYS * 24 * 60 * 60,
    },

    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      userinfo: { enabled: true },
    },

    // Custom interaction URLs (login / consent). Implement under /login.
    interactions: {
      url(_ctx, interaction) {
        return `/login?interaction=${interaction.uid}`;
      },
    },

    // TODO(Phase 0): implement findAccount + Account#claims to map the
    // SSO user record (Prisma User) into OIDC claims (sub/email/name/...).
    async findAccount(_ctx, id) {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return undefined;
      return {
        accountId: user.id,
        async claims() {
          return {
            sub: user.id,
            email: user.email,
            email_verified: user.emailVerified,
            name: user.displayName ?? undefined,
            picture: user.avatarUrl ?? undefined,
          };
        },
      };
    },
  });

  // Reference currentKey to silence unused-var warnings until the adapter is wired.
  void currentKey;

  provider.proxy = true;
  return provider;
}
