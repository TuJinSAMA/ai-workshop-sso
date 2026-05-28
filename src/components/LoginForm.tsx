"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import {
  Alert,
  FieldLabel,
  PrimaryButton,
  TextInput,
} from "@/components/AuthLayout";
import { postAuthApi } from "@/lib/auth-api-client";
import { loginErrorMessage } from "@/lib/auth-form-messages";

const networkErrorMessage = "网络异常，请检查连接后重试。";

export function LoginForm({ uid: uidFromPage }: { uid?: string }) {
  const searchParams = useSearchParams();
  const uid = uidFromPage ?? searchParams.get("uid") ?? undefined;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}
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
    </form>
  );
}
