/** Query keys that must never appear in the browser address bar. */
export const SENSITIVE_QUERY_PARAMS = [
  "password",
  "currentPassword",
  "newPassword",
] as const;

/** Email in the URL is only dangerous on auth pages (login/register/forgot). */
export const EMAIL_QUERY_PARAMS = ["email", "newEmail"] as const;

export const AUTH_PAGES_STRIPPING_EMAIL = ["/login", "/register", "/password/forgot"] as const;

export function stripSensitiveQueryParams(url: URL): boolean {
  let changed = false;
  for (const key of SENSITIVE_QUERY_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (AUTH_PAGES_STRIPPING_EMAIL.includes(url.pathname as (typeof AUTH_PAGES_STRIPPING_EMAIL)[number])) {
    for (const key of EMAIL_QUERY_PARAMS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
  }
  return changed;
}
