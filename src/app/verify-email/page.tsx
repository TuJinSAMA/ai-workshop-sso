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

  // If we have a token in the URL, auto-submit via meta refresh to the API.
  if (token && !error) {
    return (
      <>
        {/* Auto-submit the GET verification */}
        <meta httpEquiv="refresh" content={`0; url=/api/email/verify?token=${encodeURIComponent(token)}`} />
        <main className="mx-auto max-w-md p-8 text-center">
          <h1 className="mb-4 text-2xl font-semibold">正在验证邮箱…</h1>
          <p className="text-sm text-gray-500">如果页面没有自动跳转，请{" "}
            <a href={`/api/email/verify?token=${encodeURIComponent(token)}`} className="underline">
              点击这里
            </a>
          </p>
        </main>
      </>
    );
  }

  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <h1 className="mb-4 text-2xl font-semibold">邮箱验证</h1>

      {error ? (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[error] ?? "发生未知错误，请重试。"}
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          验证邮件已发送至你的邮箱，请点击邮件中的链接完成验证。
        </p>
      )}

      <p className="mt-4 text-sm text-gray-500">
        没收到邮件？
        <form method="POST" action="/api/email/send-verification" className="inline">
          <button type="submit" className="ml-1 underline text-gray-700 hover:text-black">
            重新发送
          </button>
        </form>
      </p>
    </main>
  );
}
