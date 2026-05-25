export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-semibold">重置密码</h1>
      <form method="POST" action="/api/password/reset" className="space-y-4">
        <input type="hidden" name="token" />
        <label className="block">
          <span className="block text-sm text-gray-700">新密码</span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          确认重置
        </button>
      </form>
    </main>
  );
}
