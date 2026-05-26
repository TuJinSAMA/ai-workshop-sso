import { redirect } from "next/navigation";

import {
  Alert,
  AuthLayout,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
  TextInput,
} from "@/components/AuthLayout";
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

const infoMessages: Record<string, string> = {
  interaction_expired:
    "你已登录，但来自客户端产品的本次登录请求已过期。请回到原产品重新点击登录，即可被自动放行。",
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
  const infoMsg = params.message ? (infoMessages[params.message] ?? null) : null;
  const errorMsg = params.error ? (errorMessages[params.error] ?? "发生未知错误，请重试。") : null;

  return (
    <AuthLayout
      title="个人中心"
      subtitle={
        <span className="flex items-center gap-2">
          <span>{user.email}</span>
          {user.emailVerified ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
              已验证
            </span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
              未验证
            </span>
          )}
        </span>
      }
      width="wide"
      footer={
        <form method="POST" action="/api/logout" className="flex justify-center">
          <SecondaryButton type="submit">退出登录</SecondaryButton>
        </form>
      }
    >
      <div className="space-y-6">
        {successMsg && <Alert variant="success">{successMsg}</Alert>}
        {infoMsg && <Alert variant="info">{infoMsg}</Alert>}
        {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

        {/* Email */}
        <Section title="邮箱" description="登录账号使用的邮箱地址">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-700 dark:text-zinc-200">{user.email}</span>
            {!user.emailVerified && (
              <form method="POST" action="/api/email/send-verification">
                <SecondaryButton type="submit">发送验证邮件</SecondaryButton>
              </form>
            )}
          </div>

          <Disclosure summary="更改邮箱">
            <form method="POST" action="/api/account/email" className="space-y-3">
              <label className="block">
                <FieldLabel>新邮箱</FieldLabel>
                <TextInput type="email" name="newEmail" required autoComplete="email" />
              </label>
              <label className="block">
                <FieldLabel>当前密码（用于确认操作）</FieldLabel>
                <TextInput
                  type="password"
                  name="currentPassword"
                  required
                  autoComplete="current-password"
                />
              </label>
              <PrimaryButton type="submit">发送验证邮件到新邮箱</PrimaryButton>
            </form>
          </Disclosure>
        </Section>

        {/* Password */}
        <Section title="密码与安全" description="定期更换密码可有效降低账号风险">
          <Disclosure summary="修改密码">
            <form method="POST" action="/api/account/password" className="space-y-3">
              <label className="block">
                <FieldLabel>当前密码</FieldLabel>
                <TextInput
                  type="password"
                  name="currentPassword"
                  required
                  autoComplete="current-password"
                />
              </label>
              <label className="block">
                <FieldLabel>新密码（至少 8 位）</FieldLabel>
                <TextInput
                  type="password"
                  name="newPassword"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
              <PrimaryButton type="submit">更新密码</PrimaryButton>
            </form>
          </Disclosure>
        </Section>

        {/* Devices */}
        <Section title="活跃设备" description="可登出其他设备上的会话">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">暂无活跃会话。</p>
          ) : (
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {sessions.map((s) => {
                const isCurrent = s.id === current.id;
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-zinc-800 dark:text-zinc-100">
                          {truncate(s.userAgent, 80)}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                            本机
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {s.ipAddress ?? "—"} · 最近活跃{" "}
                        {s.lastActiveAt.toISOString()}
                      </div>
                    </div>
                    {!isCurrent && (
                      <form method="POST" action={`/api/sessions/${s.id}/revoke`}>
                        <SecondaryButton
                          type="submit"
                          className="border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          撤销
                        </SecondaryButton>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </AuthLayout>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Disclosure({
  summary,
  children,
}: {
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-900">
        {summary}
      </summary>
      <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">{children}</div>
    </details>
  );
}
