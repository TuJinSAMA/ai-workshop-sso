import {
  Alert,
  AuthLayout,
  FieldLabel,
  InlineLink,
  PrimaryButton,
  TextInput,
} from "@/components/AuthLayout";

interface Props {
  searchParams: Promise<{ sent?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <AuthLayout
      title="找回密码"
      subtitle="输入注册邮箱，我们将发送重置链接"
      footer={
        <span className="text-zinc-500">
          想起密码了？<InlineLink href="/login">返回登录</InlineLink>
        </span>
      }
    >
      {sent ? (
        <Alert variant="success">
          <p className="font-medium">邮件已发送</p>
          <p className="mt-1">
            如果该邮箱已注册，你将收到一封重置邮件，有效期 30 分钟。请检查收件箱（包括垃圾邮件）。
          </p>
        </Alert>
      ) : (
        <form method="POST" action="/api/password/forgot" className="space-y-4">
          <label className="block">
            <FieldLabel>注册邮箱</FieldLabel>
            <TextInput type="email" name="email" required autoComplete="email" />
          </label>
          <PrimaryButton type="submit">发送重置邮件</PrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}
