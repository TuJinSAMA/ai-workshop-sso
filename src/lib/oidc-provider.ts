import type Provider from "oidc-provider";
import type { ClientMetadata } from "oidc-provider";
import { env } from "./env";
import { prisma } from "./db";
import { getAllPrivateJwks, getCurrentSigningKey } from "./jwks";
import { makePrismaAdapter } from "./oidc-adapter";

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
  const { default: ProviderCtor } = await import("oidc-provider");
  const e = env();

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
      // M2 enables end_session for full logout.
      rpInitiatedLogout: { enabled: false },
    },

    interactions: {
      // Sent to the browser when the provider needs user input.
      // Our login/register pages read `uid` from the query string.
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
  return provider;
}
