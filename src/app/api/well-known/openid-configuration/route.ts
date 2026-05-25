import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal OIDC discovery document. When oidc-provider is fully wired in
// Phase 0, this can be delegated to provider.discovery() instead.
export async function GET() {
  const issuer = env().ISSUER_URL;
  return NextResponse.json({
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    jwks_uri: `${issuer}/api/well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "email", "profile", "offline_access"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
  });
}
