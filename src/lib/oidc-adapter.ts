import type { Adapter, AdapterPayload, ClientMetadata } from "oidc-provider";
import { prisma } from "./db";

// Prisma-backed adapter for oidc-provider (spec Section 12.3).
//
// All oidc-provider internal models share one Postgres table (`OidcModel`)
// keyed by `<model>:<id>`. The columns `grantId`, `userCode`, `uid` mirror
// the corresponding fields inside `payload` so we can index them cheaply.
//
// The special `Client` model is bridged to the `OAuthClient` table so that
// new clients registered via /internal/clients are picked up dynamically
// without a server restart.
//
// Reference: node_modules/oidc-provider/lib/adapters/memory_adapter.js

const GRANTABLE = new Set([
  "AccessToken",
  "AuthorizationCode",
  "RefreshToken",
  "DeviceCode",
  "BackchannelAuthenticationRequest",
]);

async function findClient(id: string): Promise<AdapterPayload | undefined> {
  const row = await prisma.oAuthClient.findUnique({ where: { clientId: id } });
  if (!row) return undefined;
  // Return ClientMetadata shape expected by oidc-provider.
  const meta: ClientMetadata = {
    client_id: row.clientId,
    client_name: row.name,
    // We store only the hash; use PKCE-only flow (token_endpoint_auth_method=none).
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    redirect_uris: row.redirectUris,
    post_logout_redirect_uris: row.postLogoutRedirectUris,
    scope: row.allowedScopes.join(" "),
  };
  return meta as unknown as AdapterPayload;
}

export class PrismaAdapter implements Adapter {
  constructor(public readonly model: string) {}

  private key(id: string): string {
    return `${this.model}:${id}`;
  }

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const grantId = GRANTABLE.has(this.model) ? (payload.grantId ?? null) : null;
    const userCode = (payload as { userCode?: string }).userCode ?? null;
    const uid = (payload as { uid?: string }).uid ?? null;
    const consumed = Boolean((payload as { consumed?: unknown }).consumed);

    const data = {
      model: this.model,
      payload: payload as unknown as object,
      expiresAt,
      grantId,
      userCode,
      uid,
      consumed,
    };

    await prisma.oidcModel.upsert({
      where: { id: this.key(id) },
      update: data,
      create: { id: this.key(id), ...data },
    });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    // Bridge Client lookups to OAuthClient table for dynamic client registration.
    if (this.model === "Client") return findClient(id);

    const row = await prisma.oidcModel.findUnique({ where: { id: this.key(id) } });
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    return row.payload as unknown as AdapterPayload;
  }

  async findByUid(uid: string): Promise<AdapterPayload | undefined> {
    const row = await prisma.oidcModel.findFirst({
      where: { model: this.model, uid },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    return row.payload as unknown as AdapterPayload;
  }

  async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
    const row = await prisma.oidcModel.findFirst({
      where: { model: this.model, userCode },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return undefined;
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return undefined;
    return row.payload as unknown as AdapterPayload;
  }

  async consume(id: string): Promise<void> {
    // oidc-provider's contract: stamp the payload with `consumed = epochTime`.
    // We also flip the `consumed` column so M2 reuse-detection queries are cheap.
    const row = await prisma.oidcModel.findUnique({ where: { id: this.key(id) } });
    if (!row) return;
    const payload = { ...(row.payload as object), consumed: Math.floor(Date.now() / 1000) };
    await prisma.oidcModel.update({
      where: { id: this.key(id) },
      data: { payload, consumed: true },
    });
  }

  async destroy(id: string): Promise<void> {
    await prisma.oidcModel.deleteMany({ where: { id: this.key(id) } });
  }

  async revokeByGrantId(grantId: string): Promise<void> {
    await prisma.oidcModel.deleteMany({ where: { grantId } });
  }
}

export function makePrismaAdapter(model: string): Adapter {
  return new PrismaAdapter(model);
}
