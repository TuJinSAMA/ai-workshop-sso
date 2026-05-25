export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">找回密码</h1>
      <form method="POST" action="/api/password/forgot" className="space-y-4">
        <label className="block">
          <span className="block text-sm text-gray-700">注册邮箱</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          发送重置邮件
        </button>
      </form>
    </main>
  );
}
