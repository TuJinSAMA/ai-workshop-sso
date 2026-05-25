import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "./oidc-provider";

// Bridge between Next route handlers (Web-fetch req/res, no Node objects)
// and oidc-provider's req/res-based interaction API.
//
// We deliberately bypass provider.interactionFinished() — it needs raw
// IncomingMessage/ServerResponse to read the signed _interaction cookie.
// Instead we look the Interaction up by uid (sent in the form body), stamp
// `result`, persist, and 303 the browser to interaction.returnTo. The
// provider then resumes the authorization at that URL using the same
// _interaction cookie the browser already carries.

export type LoginResult = { accountId: string };

export async function finishInteraction(
  uid: string,
  result: { login?: LoginResult; consent?: Record<string, unknown> },
): Promise<string> {
  const provider = await getProvider();
  // `provider.Interaction` is the model class registered for adapter('Interaction').
  // .find() returns null/undefined if missing or expired.
  const Interaction = provider.Interaction;
  const interaction = await Interaction.find(uid);
  if (!interaction) {
    throw new Error(`Interaction ${uid} not found or expired`);
  }
  interaction.result = { ...(interaction.lastSubmission ?? {}), ...result };
  // Keep the original TTL by passing remaining seconds.
  const remaining = Math.max(1, interaction.exp - Math.floor(Date.now() / 1000));
  await interaction.save(remaining);
  return interaction.returnTo;
}

/**
 * Build the post-auth redirect. If `uid` is present we resume the OIDC
 * authorization; otherwise we send the user to the account page.
 */
export async function postAuthRedirect(
  req: NextRequest,
  uid: string | null,
  accountId: string,
): Promise<NextResponse> {
  const target = uid
    ? await finishInteraction(uid, { login: { accountId } })
    : new URL("/account", req.url).toString();
  // Use 303 so the browser switches the next request to GET (form-post pattern).
  return new NextResponse(null, { status: 303, headers: { Location: target } });
}
