import { Suspense } from "react";

import { AuthLayout, InlineLink } from "@/components/AuthLayout";
import { LoginForm } from "@/components/LoginForm";
import { getClientFromUid } from "@/lib/client-from-uid";

type SearchParams = Promise<{ uid?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { uid } = await searchParams;
  const client = await getClientFromUid(uid);

  const registerHref = uid ? `/register?uid=${encodeURIComponent(uid)}` : "/register";

  return (
    <AuthLayout
      clientName={client?.name}
      title="登录"
      subtitle={client ? undefined : "登录到统一身份认证服务"}
      footer={
        <span className="text-zinc-500">
          没有账号？<InlineLink href={registerHref}>立即注册</InlineLink>
          <span className="mx-2 text-zinc-300">·</span>
          <InlineLink href="/password/forgot">忘记密码</InlineLink>
        </span>
      }
    >
      <Suspense fallback={<p className="text-sm text-zinc-500">加载登录表单…</p>}>
        <LoginForm uid={uid} />
      </Suspense>
    </AuthLayout>
  );
}
