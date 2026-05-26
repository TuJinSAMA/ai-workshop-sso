import type Provider from "oidc-provider";
import { env } from "./env";
import { getAllPrivateJwks, getCurrentSigningKey } from "./jwks";
import { makePrismaAdapter } from "./oidc-adapter";
import { prisma } from "./db";
import { audit } from "./audit";
import { logoutSource, postLogoutSuccessSource } from "./logout-html";
import {
  SSO_CHECK_DESCRIPTION,
  SSO_CHECK_REASON,
  ssoCookieCheck,
} from "./sso-check";

// oidc-provider singleton (spec Section 12.3).
//
// Mounted under /oidc/* by src/server.ts. Discovery is auto-served at
// /oidc/.well-known/openid-configuration and JWKS at /oidc/jwks.

// Cache across HMR reloads so dev mode doesn't pile up Provider instances.
const globalForOidc = globalThis as unknown as { __oidcProvider?: Promise<Provider> };

export function getProvider(): Promise<Provider> {
  if (!globalForOidc.__oidcProvider) {
    globalForOidc.__oidcProvider = buildProvider();
  }
  return globalForOidc.__oidcProvider;
}

async function buildProvider(): Promise<Provider> {
  const { default: ProviderCtor, interactionPolicy } = await import("oidc-provider");
  const e = env();

  // Derive a policy from base() and unshift a custom Check at the FRONT of
  // the `login` prompt's `checks` array. It runs before `no_session`, so if
  // our SSO cookie hydrates an account, every subsequent Check sees an
  // authenticated session and the prompt is skipped (spec §M2).
  const policy = interactionPolicy.base();
  const loginPrompt = policy.get("login");
  if (!loginPrompt) {
    throw new Error("interaction policy missing 'login' prompt");
  }
  loginPrompt.checks.unshift(
    new interactionPolicy.Check(
      SSO_CHECK_REASON,
      SSO_CHECK_DESCRIPTION,
      ssoCookieCheck,
    ),
  );

  // Make sure at least one ACTIVE SigningKey exists before we snapshot the
  // JWKS for the provider (oidc-provider reads `jwks` once at construction
  // time; an empty set leaves it unable to sign id_tokens).
  await getCurrentSigningKey();
  const jwks = await getAllPrivateJwks();

  // Clients are loaded dynamically via the adapter (PrismaAdapter.find bridges
  // to OAuthClient table), so we do NOT pass a static `clients` array here.
  // This means new clients registered via /internal/clients are picked up
  // immediately without a server restart.

  // Issuer carries the `/oidc` mount path so the `iss` claim and every
  // discovery URL is prefixed correctly. server.ts strips `/oidc` from
  // req.url before delegating to provider.callback() so Koa's router
  // matches against the default route paths, but preserves req.originalUrl
  // so provider's urlFor() can recover the mount and emit absolute URLs.
  const provider = new ProviderCtor(e.ISSUER_URL + "/oidc", {
    adapter: makePrismaAdapter,
    jwks,

    pkce: { required: () => true },

    cookies: {
      keys: [e.COOKIE_SECRET],
      long: { signed: true, httpOnly: true, sameSite: "lax" },
      short: { signed: true, httpOnly: true, sameSite: "lax" },
    },

    ttl: {
      AccessToken: e.ACCESS_TOKEN_TTL_MINUTES * 60,
      IdToken: e.ACCESS_TOKEN_TTL_MINUTES * 60,
      RefreshToken: e.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      AuthorizationCode: e.AUTH_CODE_TTL_MINUTES * 60,
      Session: e.SSO_COOKIE_TTL_DAYS * 24 * 60 * 60,
      Interaction: 60 * 60,
      Grant: e.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    },

    claims: {
      openid: ["sub"],
      email: ["email", "email_verified"],
      profile: ["name", "picture"],
    },

    features: {
      devInteractions: { enabled: false },
      revocation: { enabled: true },
      userinfo: { enabled: true },
      rpInitiatedLogout: {
        enabled: true,
        logoutSource,
        postLogoutSuccessSource,
      },
    },

    // Spec §7 requires email/email_verified in the id_token.
    // Setting conformIdTokenClaims=false makes oidc-provider include scope-based
    // claims (email, name, picture) directly in the id_token for code flow,
    // not only via the userinfo endpoint.
    conformIdTokenClaims: false,

    // Always rotate refresh tokens, not just for offline_access. oidc-provider
    // stamps the rotated token as `consumed`; a second use throws InvalidGrant
    // and triggers grant revocation (see refresh_token.js line 121-127).
    rotateRefreshToken: true,

    // Issue a refresh token whenever the client supports the refresh_token grant.
    // The default behaviour requires `offline_access` in scope; we override that
    // because all our clients are first-party and we always want rotation-capable
    // long-lived sessions (spec §7: refresh_token TTL = 30 days, rotated).
    issueRefreshToken: async (_ctx, client) => client.grantTypeAllowed("refresh_token"),

    interactions: {
      policy,
      url(_ctx, interaction) {
        return `/login?uid=${interaction.uid}`;
      },
    },

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

    // Auto-grant consent for all first-party clients so no consent UI is needed.
    // Any previously saved grant is reused; if none exists a new grant covering
    // all requested scopes is created and persisted automatically.
    async loadExistingGrant(ctx) {
      const grantId =
        ctx.oidc.result?.consent?.grantId ??
        ctx.oidc.session?.grantIdFor(ctx.oidc.client!.clientId!);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const provider = ctx.oidc.provider as any;

      if (grantId) {
        const found = await provider.Grant.find(grantId);
        if (found) return found;
      }

      // No existing grant — create one covering all requested scopes.
      // Read scope directly from the stored authorization params so we handle
      // both the first-visit and resume paths reliably.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawScope: string = (ctx.oidc as any).params?.scope ?? "openid";

      const grant = new provider.Grant({
        accountId: ctx.oidc.account!.accountId,
        clientId: ctx.oidc.client!.clientId!,
      });

      grant.addOIDCScope(rawScope);

      await grant.save();
      return grant;
    },
  });

  provider.proxy = true;

  // Audit hooks for refresh-token rotation and revocation (spec §M2).
  //
  // refresh_token grant flow (node_modules/oidc-provider/lib/actions/grants/refresh_token.js):
  //   - normal rotation : consume() old + emit `grant.success` with new RT
  //                       — RotatedRefreshToken entity is set on ctx
  //   - reuse detection : refreshToken.consumed truthy => destroy() + revoke()
  //                       — revoke() emits `grant.revoked`, ctx.oidc.route==='token'
  //                       and entities.RefreshToken.consumed is a timestamp.
  // We use ctx.oidc.route + the entities to distinguish the two cases.
  provider.on("grant.revoked", async (ctx, grantId) => {
    const route = ctx.oidc?.route;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rt = (ctx.oidc?.entities as any)?.RefreshToken;
    const isReuse = route === "token" && Boolean(rt?.consumed);
    await audit({
      event: isReuse ? "token_refresh_reuse_detected" : "session_revoked",
      userId: ctx.oidc?.account?.accountId ?? rt?.accountId ?? null,
      metadata: { grantId, route },
    });
  });

  provider.on("grant.success", async (ctx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rotated = (ctx.oidc?.entities as any)?.RotatedRefreshToken;
    await audit({
      event: rotated ? "token_refreshed" : "token_issued",
      userId: ctx.oidc?.account?.accountId ?? null,
      metadata: { route: ctx.oidc?.route },
    });
  });

  return provider;
}
