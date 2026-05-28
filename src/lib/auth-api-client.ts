/**
 * Browser-side POST to SSO auth APIs. Uses JSON + manual redirect handling so
 * failures stay on the login/register page while successes follow the OIDC
 * 303 chain via a full navigation (required for cross-origin RP callbacks).
 */

export type AuthApiFailure = {
  ok: false;
  error: string;
  status: number;
  retryAfterMs?: number;
};

export type AuthApiSuccess = { ok: true };

export type AuthApiResult = AuthApiSuccess | AuthApiFailure;

type AuthPayload = {
  email: string;
  password: string;
  uid?: string;
};

function parseErrorBody(data: unknown): { error: string; retryAfterMs?: number } {
  if (typeof data !== "object" || data === null) return { error: "unknown" };
  const rec = data as Record<string, unknown>;
  const error = typeof rec.error === "string" ? rec.error : "unknown";
  const retryAfterMs =
    typeof rec.retryAfterMs === "number" ? rec.retryAfterMs : undefined;
  return { error, retryAfterMs };
}

export async function postAuthApi(
  endpoint: "/api/login" | "/api/register",
  payload: AuthPayload,
): Promise<AuthApiResult> {
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      redirect: "manual",
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        ...(payload.uid ? { uid: payload.uid } : {}),
      }),
    });
  } catch {
    return { ok: false, error: "network", status: 0 };
  }

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    // Non-JSON success (form POST 303 with empty body).
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get("Location");
      if (location) {
        window.location.assign(location);
        return { ok: true };
      }
      return { ok: false, error: "redirect_missing", status: resp.status };
    }
    return { ok: false, error: "unknown", status: resp.status };
  }

  if (resp.ok) {
    const rec = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
    const redirect = rec && typeof rec.redirect === "string" ? rec.redirect : null;
    if (redirect) {
      window.location.assign(redirect);
      return { ok: true };
    }
    return { ok: false, error: "unexpected_success_body", status: resp.status };
  }

  if (resp.status >= 300 && resp.status < 400) {
    const location = resp.headers.get("Location");
    if (location) {
      window.location.assign(location);
      return { ok: true };
    }
    return { ok: false, error: "redirect_missing", status: resp.status };
  }

  const { error, retryAfterMs } = parseErrorBody(data);
  return { ok: false, error, status: resp.status, retryAfterMs };
}
