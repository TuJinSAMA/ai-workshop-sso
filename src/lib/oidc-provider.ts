import type Provider from "oidc-provider";
import type { ClientMetadata } from "oidc-provider";
import { env } from "./env";
import { prisma } from "./db";
import { getAllPrivateJwks, getCurrentSigningKey } from "./jwks";
import { makePrismaAdapter } from "./oidc-adapter";
import { audit } from "./audit";
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

async function loadClientsFromDb(): Promise<ClientMetadata[]> {
  const rows = await prisma.oAuthClient.findMany();
  return rows.map((row: typeof rows[number]): ClientMetadata => ({
    client_id: row.clientId,
    // We store sha256(secret); oidc-provider needs the raw secret to verify
    // client_secret_basic / _post. For Phase 0 the seed script prints the
    // raw secret once; for production we'll switch on `none` (PKCE-only) or
    // pivot to client_secret_jwt. Until then we accept that confidential
    // clients are not yet usable until M3 implements internal API which
    // returns the raw secret on creation.
    //
    // M1 ships with token_endpoint_auth_method=none so PKCE alone suffices.
    client_secret: undefined,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    redirect_uris: row.redirectUris,
    post_logout_redirect_uris: row.postLogoutRedirectUris,
    scope: row.allowedScopes.join(" "),
  }));
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
  const clients = await loadClientsFromDb();

  // Issuer carries the `/oidc` mount path so the `iss` claim and every
  // discovery URL is prefixed correctly. server.ts strips `/oidc` from
  // req.url before delegating to provider.callback() so Koa's router
  // matches against the default route paths, but preserves req.originalUrl
  // so provider's urlFor() can recover the mount and emit absolute URLs.
  const provider = new ProviderCtor(e.ISSUER_URL + "/oidc", {
    adapter: makePrismaAdapter,
    clients,
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
      rpInitiatedLogout: { enabled: true },
    },

    // Always rotate refresh tokens, not just for offline_access. oidc-provider
    // stamps the rotated token as `consumed`; a second use throws InvalidGrant
    // and triggers grant revocation (see refresh_token.js line 121-127).
    rotateRefreshToken: true,

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
