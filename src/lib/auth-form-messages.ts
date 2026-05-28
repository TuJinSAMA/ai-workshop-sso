/** User-facing copy for /api/login and /api/register JSON error codes. */

export const loginErrorMessages: Record<string, string> = {
  invalid_credentials: "邮箱或密码不正确，请检查后重试。",
  invalid_request: "请填写有效的邮箱和密码。",
  rate_limited: "登录尝试过于频繁，请稍后再试。",
  unknown: "登录失败，请稍后重试。",
};

export const registerErrorMessages: Record<string, string> = {
  email_taken: "该邮箱已注册，请直接登录或使用其他邮箱。",
  password_compromised: "该密码曾在公开数据泄露中出现，请更换一个更安全的密码。",
  invalid_request: "请填写有效的邮箱和密码（至少 8 位）。",
  unknown: "注册失败，请稍后重试。",
};

export function loginErrorMessage(
  code: string,
  retryAfterMs?: number,
): string {
  if (code === "rate_limited" && retryAfterMs != null) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
    return `登录尝试过于频繁，请约 ${minutes} 分钟后再试。`;
  }
  return loginErrorMessages[code] ?? loginErrorMessages.unknown;
}

export function registerErrorMessage(code: string): string {
  return registerErrorMessages[code] ?? registerErrorMessages.unknown;
}
