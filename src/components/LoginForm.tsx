"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import {
  Alert,
  FieldLabel,
  PrimaryButton,
  TextInput,
} from "@/components/AuthLayout";
import { ClientPostForm } from "@/components/ClientPostForm";
import { postAuthApi } from "@/lib/auth-api-client";
import { loginErrorMessage } from "@/lib/auth-form-messages";

const networkErrorMessage = "网络异常，请检查连接后重试。";

export function LoginForm({ uid: uidFromPage }: { uid?: string }) {
  const searchParams = useSearchParams();
  const uid = uidFromPage ?? searchParams.get("uid") ?? undefined;

  const urlError = useMemo(() => {
    const code = searchParams.get("error");
    if (!code) return null;
    const retryRaw = searchParams.get("retryAfterMs");
    const retryAfterMs = retryRaw ? Number(retryRaw) : undefined;
    return loginErrorMessage(
      code,
      Number.isFinite(retryAfterMs) ? retryAfterMs : undefined,
    );
  }, [searchParams]);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const displayError = error ?? urlError;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const result = await postAuthApi("/api/login", { email, password, uid });

    if (!result.ok) {
      const message =
        result.error === "network"
          ? networkErrorMessage
          : loginErrorMessage(result.error, result.retryAfterMs);
      setError(message);
      setLoading(false);
      return;
    }

    // Success: postAuthApi already started navigation; keep button disabled.
  }

  return (
    <ClientPostForm action="/api/login" onSubmit={onSubmit} className="space-y-4" noValidate>
      {uid ? <input type="hidden" name="uid" value={uid} /> : null}
      {displayError ? <Alert variant="error">{displayError}</Alert> : null}
      <label className="block">
        <FieldLabel>邮箱</FieldLabel>
        <TextInput
          type="email"
          name="email"
          required
          autoComplete="email"
          disabled={loading}
        />
      </label>
      <label className="block">
        <FieldLabel>密码</FieldLabel>
        <TextInput
          type="password"
          name="password"
          required
          autoComplete="current-password"
          disabled={loading}
        />
      </label>
      <PrimaryButton type="submit" disabled={loading}>
        {loading ? "登录中…" : "登录"}
      </PrimaryButton>
    </ClientPostForm>
  );
}
