import { prisma } from "./db";

/**
 * Resolve the OAuth client (RP) behind an oidc-provider interaction `uid`.
 *
 * The login / register pages are rendered inside an OIDC authorization
 * interaction (oidc-provider routes /oidc/auth → /login?uid=...). We look up
 * the stored Interaction document via the same OidcModel table the
 * PrismaAdapter writes to, pull `params.client_id` out, then resolve the
 * human-readable client name from the OAuthClient catalog.
 *
 * Returns null when there's no uid, the interaction is expired, or the
 * client is unknown — callers should fall back to a generic header in that
 * case (page was visited directly without going through /oidc/auth).
 */
export async function getClientFromUid(
  uid: string | undefined | null,
): Promise<{ clientId: string; name: string } | null> {
  if (!uid) return null;

  const row = await prisma.oidcModel.findFirst({
    where: { model: "Interaction", uid },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const payload = row.payload as {
    params?: { client_id?: string };
  } | null;
  const clientId = payload?.params?.client_id;
  if (!clientId) return null;

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
  });
  if (!client) return null;

  return { clientId: client.clientId, name: client.name };
}
