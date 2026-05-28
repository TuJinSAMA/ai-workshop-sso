import {
  Alert,
  AuthLayout,
  InlineLink,
  PrimaryButton,
} from "@/components/AuthLayout";
import { PostForm } from "@/components/PostForm";

interface Props {
  searchParams: Promise<{ token?: string; error?: string }>;
}

const errorMessages: Record<string, string> = {
  invalid_or_expired_token: "验证链接已失效或已使用，请重新发送验证邮件。",
  invalid_request: "请求无效，请重新操作。",
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token;
  const error = params.error;

  // If we have a token in the URL, auto-redirect via meta refresh to the API
  // handler. Same UX as before — just dressed up in the new layout.
  if (token && !error) {
    return (
      <AuthLayout title="正在验证邮箱…" subtitle="请稍候，几秒后将自动跳转">
        <meta
          httpEquiv="refresh"
          content={`0; url=/api/email/verify?token=${encodeURIComponent(token)}`}
        />
        <p className="text-center text-sm text-zinc-500">
          如果页面没有自动跳转，请{" "}
          <InlineLink href={`/api/email/verify?token=${encodeURIComponent(token)}`}>
            点击这里
          </InlineLink>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="邮箱验证"
      subtitle={error ? undefined : "我们已向你的邮箱发送一封验证邮件"}
      footer={
        <span className="text-zinc-500">
          已完成验证？<InlineLink href="/account">前往个人中心</InlineLink>
        </span>
      }
    >
      <div className="space-y-4">
        {error ? (
          <Alert variant="error">
            {errorMessages[error] ?? "发生未知错误，请重试。"}
          </Alert>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            请点击邮件中的验证链接完成验证。如果未收到邮件，可以重新发送。
          </p>
        )}

        <PostForm action="/api/email/send-verification">
          <PrimaryButton type="submit">重新发送验证邮件</PrimaryButton>
        </PostForm>
      </div>
    </AuthLayout>
  );
}
