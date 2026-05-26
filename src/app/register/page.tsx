import {
  AuthLayout,
  FieldLabel,
  InlineLink,
  PrimaryButton,
  TextInput,
} from "@/components/AuthLayout";
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
      <form method="POST" action="/api/register" className="space-y-4">
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
            minLength={8}
            autoComplete="new-password"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            至少 8 位，建议混合大小写字母与数字
          </span>
        </label>
        <PrimaryButton type="submit">创建账号</PrimaryButton>
      </form>
    </AuthLayout>
  );
}
