import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { readSsoCookie } from "@/lib/cookies";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ message?: string; error?: string }>;
}

function truncate(value: string | null | undefined, max = 60): string {
  if (!value) return "—";
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

const successMessages: Record<string, string> = {
  email_verified: "邮箱已验证成功！",
  verification_sent: "验证邮件已发送，请检查收件箱。",
  password_changed: "密码已修改，其他设备上的会话已注销。",
  email_change_sent: "验证邮件已发送到新邮箱，请点击链接完成更改。",
};

const errorMessages: Record<string, string> = {
  invalid_current_password: "当前密码错误，请重试。",
  same_password: "新密码不能与当前密码相同。",
  password_compromised: "该密码出现在已知数据泄露中，请换一个更安全的密码。",
  same_email: "新邮箱与当前邮箱相同。",
  email_taken: "该邮箱已被其他账号使用。",
  invalid_request: "请求无效，请重新提交。",
};

export default async function AccountPage({ searchParams }: Props) {
  const sid = await readSsoCookie();
  if (!sid) redirect("/login");

  const current = await prisma.session.findUnique({ where: { id: sid } });
  if (!current || current.revokedAt) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: current.userId } });
  if (!user) redirect("/login");

  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { lastActiveAt: "desc" },
  });

  const params = await searchParams;
  const successMsg = params.message ? (successMessages[params.message] ?? null) : null;
  const errorMsg = params.error ? (errorMessages[params.error] ?? "发生未知错误，请重试。") : null;

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-10">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">个人中心</h1>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
        <form method="POST" action="/api/logout">
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            退出登录
          </button>
        </form>
      </header>

      {/* Flash messages */}
      {successMsg && (
        <div className="rounded border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Profile section */}
      <section id="profile">
        <h2 className="mb-3 text-lg font-medium">邮箱</h2>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm">{user.email}</span>
          {user.emailVerified ? (
            <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">已验证</span>
          ) : (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">未验证</span>
          )}
          {!user.emailVerified && (
            <form method="POST" action="/api/email/send-verification" className="inline">
              <button type="submit" className="text-xs text-blue-600 underline">发送验证邮件</button>
            </form>
          )}
        </div>

        <details className="rounded border border-gray-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-gray-50">
            更改邮箱
          </summary>
          <form method="POST" action="/api/account/email" className="space-y-3 p-4">
            <label className="block">
              <span className="block text-sm text-gray-700">新邮箱</span>
              <input
                type="email"
                name="newEmail"
                required
                autoComplete="email"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700">当前密码（用于确认操作）</span>
              <input
                type="password"
                name="currentPassword"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              发送验证邮件到新邮箱
            </button>
          </form>
        </details>
      </section>

      {/* Security section */}
      <section id="security">
        <h2 className="mb-3 text-lg font-medium">密码与安全</h2>
        <details className="rounded border border-gray-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-gray-50">
            修改密码
          </summary>
          <form method="POST" action="/api/account/password" className="space-y-3 p-4">
            <label className="block">
              <span className="block text-sm text-gray-700">当前密码</span>
              <input
                type="password"
                name="currentPassword"
                required
                autoComplete="current-password"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-gray-700">新密码（至少 8 位）</span>
              <input
                type="password"
                name="newPassword"
                required
                minLength={8}
                autoComplete="new-password"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              更新密码
            </button>
          </form>
        </details>
      </section>

      {/* Devices section */}
      <section id="devices">
        <h2 className="mb-3 text-lg font-medium">活跃设备</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-600">暂无活跃会话。</p>
        ) : (
          <ul className="divide-y rounded border border-gray-200">
            {sessions.map((s) => {
              const isCurrent = s.id === current.id;
              return (
                <li key={s.id} className="flex items-center justify-between p-3">
                  <div className="min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{truncate(s.userAgent, 80)}</span>
                      {isCurrent && (
                        <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                          本机
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {s.ipAddress ?? "—"} · 最近活跃 {s.lastActiveAt.toISOString()}
                    </div>
                  </div>
                  {!isCurrent && (
                    <form method="POST" action={`/api/sessions/${s.id}/revoke`}>
                      <button
                        type="submit"
                        className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                      >
                        撤销
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
