import { redirect } from "next/navigation";
import {
  Alert,
  AuthLayout,
  FieldLabel,
  InlineLink,
  PrimaryButton,
  TextInput,
} from "@/components/AuthLayout";

interface Props {
  searchParams: Promise<{ token?: string; error?: string }>;
}

const errorMessages: Record<string, string> = {
  invalid_or_expired_token: "重置链接已失效或已使用，请重新申请。",
  password_compromised: "该密码出现在已知数据泄露中，请换一个更安全的密码。",
  invalid_request: "请求无效，请重新提交。",
  account_disabled: "账户已被禁用，请联系支持。",
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token) {
    redirect("/password/forgot");
  }

  return (
    <AuthLayout
      title="重置密码"
      subtitle="设置一个新密码以恢复对账号的访问"
      footer={
        <span className="text-zinc-500">
          链接已失效？<InlineLink href="/password/forgot">重新申请</InlineLink>
        </span>
      }
    >
      <div className="space-y-4">
        {params.error && (
          <Alert variant="error">
            {errorMessages[params.error] ?? "发生未知错误，请重试。"}
          </Alert>
        )}

        <form method="POST" action="/api/password/reset" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <label className="block">
            <FieldLabel>新密码</FieldLabel>
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
          <PrimaryButton type="submit">确认重置</PrimaryButton>
        </form>
      </div>
    </AuthLayout>
  );
}
