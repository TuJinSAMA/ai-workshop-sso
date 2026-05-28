import { Suspense } from "react";

import { AuthLayout, InlineLink } from "@/components/AuthLayout";
import { RegisterForm } from "@/components/RegisterForm";
import { getClientFromUid } from "@/lib/client-from-uid";

type SearchParams = Promise<{ uid?: string }>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { uid } = await searchParams;
  const client = await getClientFromUid(uid);

  const loginHref = uid ? `/login?uid=${encodeURIComponent(uid)}` : "/login";

  return (
    <AuthLayout
      clientName={client?.name}
      title="注册账号"
      subtitle={client ? undefined : "在 AI Workshop 创建账号"}
      footer={
        <span className="text-zinc-500">
          已有账号？<InlineLink href={loginHref}>直接登录</InlineLink>
        </span>
      }
    >
      <Suspense fallback={<p className="text-sm text-zinc-500">加载注册表单…</p>}>
        <RegisterForm uid={uid} />
      </Suspense>
    </AuthLayout>
  );
}
