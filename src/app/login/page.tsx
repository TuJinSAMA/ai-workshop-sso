import {
  AuthLayout,
  FieldLabel,
  InlineLink,
  PrimaryButton,
  TextInput,
} from "@/components/AuthLayout";
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
      <form method="POST" action="/api/login" className="space-y-4">
        {uid && <input type="hidden" name="uid" value={uid} />}
        <label className="block">
          <FieldLabel>邮箱</FieldLabel>
          <TextInput type="email" name="email" required autoComplete="email" />
        </label>
        <label className="block">
          <FieldLabel>密码</FieldLabel>
          <TextInput
            type="password"
            name="password"
            required
            autoComplete="current-password"
          />
        </label>
        <PrimaryButton type="submit">登录</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
