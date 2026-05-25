interface Props {
  searchParams: Promise<{ sent?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">找回密码</h1>

      {sent ? (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-4 text-sm text-green-800">
          <p className="font-medium">邮件已发送</p>
          <p className="mt-1 text-green-700">
            如果该邮箱已注册，你将收到一封重置邮件，有效期 30 分钟。请检查收件箱（包括垃圾邮件）。
          </p>
        </div>
      ) : (
        <form method="POST" action="/api/password/forgot" className="space-y-4">
          <label className="block">
            <span className="block text-sm text-gray-700">注册邮箱</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
          >
            发送重置邮件
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-gray-500">
        想起密码了？<a href="/login" className="underline">返回登录</a>
      </p>
    </main>
  );
}
