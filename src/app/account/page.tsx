import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { readSsoCookie } from "@/lib/cookies";

export const dynamic = "force-dynamic";

function truncate(value: string | null | undefined, max = 60): string {
  if (!value) return "—";
  return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

export default async function AccountPage() {
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

  return (
    <main className="mx-auto max-w-3xl p-8">
      <header className="mb-6 flex items-center justify-between">
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

      <section>
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
                  <form method="POST" action={`/api/sessions/${s.id}/revoke`}>
                    <button
                      type="submit"
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
                    >
                      撤销
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
