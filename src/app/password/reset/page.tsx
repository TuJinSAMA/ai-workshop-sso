import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token) {
    redirect("/password/forgot");
  }

  const errorMessages: Record<string, string> = {
    invalid_or_expired_token: "重置链接已失效或已使用，请重新申请。",
    password_compromised: "该密码出现在已知数据泄露中，请换一个更安全的密码。",
    invalid_request: "请求无效，请重新提交。",
    account_disabled: "账户已被禁用，请联系支持。",
  };

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">重置密码</h1>

      {params.error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[params.error] ?? "发生未知错误，请重试。"}
        </div>
      )}

      <form method="POST" action="/api/password/reset" className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <label className="block">
          <span className="block text-sm text-gray-700">新密码（至少 8 位）</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          确认重置
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        链接有效期为 30 分钟。如已失效，请{" "}
        <a href="/password/forgot" className="underline">重新申请</a>。
      </p>
    </main>
  );
}
