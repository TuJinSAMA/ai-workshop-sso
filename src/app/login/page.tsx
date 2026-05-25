type SearchParams = Promise<{ uid?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { uid } = await searchParams;
  const registerHref = uid ? `/register?uid=${encodeURIComponent(uid)}` : "/register";
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">登录 ai-workshop-sso</h1>
      <form method="POST" action="/api/login" className="space-y-4">
        {uid && <input type="hidden" name="uid" value={uid} />}
        <label className="block">
          <span className="block text-sm text-gray-700">邮箱</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="block text-sm text-gray-700">密码</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          登录
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        没有账号？<a className="text-blue-600 hover:underline" href={registerHref}>立即注册</a>
        ｜<a className="text-blue-600 hover:underline" href="/password/forgot">忘记密码</a>
      </p>
    </main>
  );
}
