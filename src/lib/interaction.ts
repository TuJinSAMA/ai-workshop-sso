import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "./oidc-provider";
import { absoluteIssuerUrl } from "./issuer-url";

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

/**
 * Resume an oidc-provider Interaction by uid, stamp the auth result and
 * return the URL the browser should be 303'd to. Returns `null` if the
 * interaction can no longer be found — this is *not* an exceptional case:
 * it happens whenever the user replays a stale form (back button, two
 * tabs, resubmit after a successful login that already consumed the
 * interaction). Callers MUST handle null by redirecting somewhere sane
 * rather than throwing — a thrown error here becomes a 500 inside
 * /api/login and breaks the whole UX.
 */
export async function finishInteraction(
  uid: string,
  result: { login?: LoginResult; consent?: Record<string, unknown> },
): Promise<string | null> {
  const provider = await getProvider();
  const Interaction = provider.Interaction;
  const interaction = await Interaction.find(uid);
  if (!interaction) {
    return null;
  }
  interaction.result = { ...(interaction.lastSubmission ?? {}), ...result };
  // Keep the original TTL by passing remaining seconds.
  const remaining = Math.max(1, interaction.exp - Math.floor(Date.now() / 1000));
  await interaction.save(remaining);
  return interaction.returnTo;
}

/**
 * Build the post-auth redirect. If `uid` is present we resume the OIDC
 * authorization; otherwise we send the user to the account page. If the
 * referenced interaction is stale (consumed/expired/never-existed) we fall
 * back to /account so the user lands in a known-good state rather than
 * staring at a 500 page.
 */
export async function postAuthRedirect(
  _req: NextRequest,
  uid: string | null,
  accountId: string,
  opts?: { json?: boolean },
): Promise<NextResponse> {
  let target: string;
  if (uid) {
    const resumed = await finishInteraction(uid, { login: { accountId } });
    target = resumed
      ? absoluteIssuerUrl(resumed)
      : absoluteIssuerUrl("/account?message=interaction_expired");
  } else {
    target = absoluteIssuerUrl("/account");
  }
  // JSON clients (LoginForm / RegisterForm fetch) cannot reliably read Location on
  // manual redirect responses — return an explicit URL instead.
  if (opts?.json) {
    return NextResponse.json({ redirect: target });
  }
  // Use 303 so the browser switches the next request to GET (form-post pattern).
  return new NextResponse(null, { status: 303, headers: { Location: target } });
}
